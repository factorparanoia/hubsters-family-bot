import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import os
import io
import aiohttp
from PIL import Image, ImageDraw, ImageFont
import datetime
import asyncio
import random

# ================= CONFIG =================

TOKEN = os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID"))
LOG_CHANNEL_ID = int(os.getenv("LOG_CHANNEL_ID"))
CONTROL_CHANNEL_ID = int(os.getenv("CONTROL_CHANNEL_ID"))
OWNER_ID = int(os.getenv("OWNER_ID"))

DB = "hubsters.db"

# ================= INTENTS =================

intents = discord.Intents.all()

bot = commands.Bot(
    command_prefix="!",
    intents=intents
)

tree = bot.tree

# ================= DATABASE =================

async def init_db():

    async with aiosqlite.connect(DB) as db:

        await db.execute("""
        CREATE TABLE IF NOT EXISTS safe (
            balance INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS warehouse (
            item TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS guns (
            gun TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS warns (
            user_id INTEGER,
            reason TEXT
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            text TEXT,
            date TEXT
        )
        """)

        cursor = await db.execute("SELECT COUNT(*) FROM safe")
        count = await cursor.fetchone()

        if count[0] == 0:
            await db.execute("INSERT INTO safe VALUES (0)")

        await db.commit()

# ================= LOG =================

async def log(text):

    channel = bot.get_channel(LOG_CHANNEL_ID)

    if channel:
        await channel.send(f"📋 {text}")

    async with aiosqlite.connect(DB) as db:

        await db.execute(
            "INSERT INTO logs VALUES (?,?)",
            (text, str(datetime.datetime.now()))
        )

        await db.commit()

# ================= READY =================

@bot.event
async def on_ready():

    await init_db()

    await tree.sync(
        guild=discord.Object(id=GUILD_ID)
    )

    print(f"✅ HUBsters Family ULTRA PRO READY: {bot.user}")

# ================= WELCOME IMAGE =================

async def welcome_image(member):

    async with aiohttp.ClientSession() as session:

        async with session.get(member.display_avatar.url) as resp:
            avatar_bytes = await resp.read()

    avatar = Image.open(io.BytesIO(avatar_bytes)).resize((150,150))

    bg = Image.new("RGB", (600,250), (15,15,15))

    bg.paste(avatar, (30,50))

    draw = ImageDraw.Draw(bg)

    draw.text(
        (200,80),
        f"{member.name}",
        fill=(0,255,150)
    )

    draw.text(
        (200,130),
        "Добро пожаловать в HUBsters Family",
        fill=(255,255,255)
    )

    buffer = io.BytesIO()

    bg.save(buffer, "PNG")

    buffer.seek(0)

    return buffer

@bot.event
async def on_member_join(member):

    channel = bot.get_channel(WELCOME_CHANNEL_ID)

    if not channel:
        return

    img = await welcome_image(member)

    file = discord.File(img, "welcome.png")

    embed = discord.Embed(
        title="Новый участник",
        description=member.mention,
        color=0x00ff88
    )

    embed.set_image(url="attachment://welcome.png")

    await channel.send(embed=embed, file=file)

    await log(f"{member} joined server")

# ================= SAFE =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def safe(interaction: discord.Interaction):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT balance FROM safe")

        bal = (await cursor.fetchone())[0]

    await interaction.response.send_message(f"💰 Сейф: {bal}$")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_add(interaction: discord.Interaction, amount:int):
    async with aiosqlite.connect(DB) as db:

        await db.execute(
            "UPDATE safe SET balance = balance + ?",
            (amount,)
        )

        await db.commit()

    await log(f"{interaction.user} added {amount}$ to safe")

    await interaction.response.send_message("✅ Добавлено")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_remove(interaction: discord.Interaction, amount:int):

    async with aiosqlite.connect(DB) as db:

        await db.execute(
            "UPDATE safe SET balance = balance - ?",
            (amount,)
        )

        await db.commit()

    await log(f"{interaction.user} removed {amount}$ from safe")

    await interaction.response.send_message("✅ Убрано")

# ================= WAREHOUSE =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse(interaction: discord.Interaction):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT * FROM warehouse")

        rows = await cursor.fetchall()

    if not rows:

        await interaction.response.send_message("Пусто")
        return

    text = ""

    for item, amount in rows:
        text += f"{item}: {amount}\n"

    await interaction.response.send_message(text)

@tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse_add(interaction: discord.Interaction, item:str, amount:int):

    async with aiosqlite.connect(DB) as db:

        await db.execute("""
        INSERT INTO warehouse VALUES (?,?)
        ON CONFLICT(item)
        DO UPDATE SET amount = amount + ?
        """,(item,amount,amount))

        await db.commit()

    await log(f"{interaction.user} added {item} {amount}")

    await interaction.response.send_message("Добавлено")

# ================= GUNS =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def guns(interaction: discord.Interaction):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT * FROM guns")

        rows = await cursor.fetchall()

    if not rows:

        await interaction.response.send_message("Нет оружия")
        return

    text=""

    for gun, amount in rows:

        text+=f"{gun}: {amount}\n"

    await interaction.response.send_message(text)

@tree.command(guild=discord.Object(id=GUILD_ID))
async def gun_add(interaction: discord.Interaction, gun:str, amount:int):

    async with aiosqlite.connect(DB) as db:

        await db.execute("""
        INSERT INTO guns VALUES (?,?)
        ON CONFLICT(gun)
        DO UPDATE SET amount = amount + ?
        """,(gun,amount,amount))

        await db.commit()

    await log(f"{interaction.user} added gun {gun}")

    await interaction.response.send_message("Оружие добавлено")

# ================= MODERATION =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def kick(interaction: discord.Interaction, member:discord.Member, reason:str=""):

    await member.kick(reason=reason)

    await log(f"{member} kicked")

    await interaction.response.send_message("Кикнут")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def ban(interaction: discord.Interaction, member:discord.Member, reason:str=""):

    await member.ban(reason=reason)

    await log(f"{member} banned")

    await interaction.response.send_message("Забанен")

# ================= SAY =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def say(interaction: discord.Interaction, text:str):

    await interaction.channel.send(text)

    await interaction.response.send_message("Отправлено", ephemeral=True)

# ================= EMBED =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def embed(interaction: discord.Interaction, title:str, text:str):

    emb = discord.Embed(
        title=title,
        description=text,
        color=0x00ff88
    )

    await interaction.channel.send(embed=emb)

    await interaction.response.send_message("Embed отправлен", ephemeral=True)

# ================= PANEL =================

class Control(discord.ui.View):

    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):

        async with aiosqlite.connect(DB) as db:

            cursor = await db.execute("SELECT balance FROM safe")

            bal = (await cursor.fetchone())[0]

        await interaction.response.send_message(f"💰 {bal}$", ephemeral=True)

    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def wh_btn(self, interaction, button):

        async with aiosqlite.connect(DB) as db:

            cursor = await db.execute("SELECT * FROM warehouse")

            rows = await cursor.fetchall()

        text=""

        for i,a in rows:

            text+=f"{i}:{a}\n"

        if text=="": text="Пусто"

        await interaction.response.send_message(text, ephemeral=True)

@tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):

    embed=discord.Embed(
        title="HUBsters Family CONTROL",
        description="Панель управления",
        color=0x00ff88
    )

    await interaction.response.send_message(
        embed=embed,
        view=Control()
    )

# ================= START =================

bot.run(TOKEN)
