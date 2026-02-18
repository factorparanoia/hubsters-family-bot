import discord
from discord.ext import commands
from discord import app_commands
import aiosqlite
import os
import io
import aiohttp
from PIL import Image, ImageDraw
import datetime
import asyncio

# ================= CONFIG =================

TOKEN = os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID"))
LOG_CHANNEL_ID = int(os.getenv("LOG_CHANNEL_ID"))
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
        CREATE TABLE IF NOT EXISTS ranks (
            user_id INTEGER,
            rank TEXT
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            text TEXT,
            date TEXT
        )
        """)

        cursor = await db.execute("SELECT COUNT(*) FROM safe")

        if (await cursor.fetchone())[0] == 0:
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

    print(f"🔥 HUBsters GOD EDITION READY: {bot.user}")

# ================= WELCOME =================

async def welcome_image(member):

    async with aiohttp.ClientSession() as session:

        async with session.get(member.display_avatar.url) as resp:

            avatar = Image.open(io.BytesIO(await resp.read())).resize((128,128))

    bg = Image.new("RGB", (600,200), (20,20,20))

    bg.paste(avatar, (30,40))

    draw = ImageDraw.Draw(bg)

    draw.text((200,70), member.name, fill=(0,255,150))
    draw.text((200,110), "Добро пожаловать в HUBsters Family", fill=(255,255,255))

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

    await log(f"{member} joined")

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

        await db.execute("UPDATE safe SET balance = balance + ?", (amount,))
        await db.commit()

    await log(f"{interaction.user} added {amount}$")

    await interaction.response.send_message("Добавлено")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_remove(interaction: discord.Interaction, amount:int):

    async with aiosqlite.connect(DB) as db:

        await db.execute("UPDATE safe SET balance = balance - ?", (amount,))
        await db.commit()

    await log(f"{interaction.user} removed {amount}$")

    await interaction.response.send_message("Убрано")

# ================= WAREHOUSE =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse(interaction: discord.Interaction):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT * FROM warehouse")

        rows = await cursor.fetchall()

    text = "\n".join(f"{i}: {a}" for i,a in rows) or "Пусто"

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

    await log(f"{interaction.user} added {item}")

    await interaction.response.send_message("Добавлено")

# ================= GUNS =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def guns(interaction: discord.Interaction):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT * FROM guns")

        rows = await cursor.fetchall()

    text = "\n".join(f"{g}: {a}" for g,a in rows) or "Нет оружия"

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

    await interaction.response.send_message("Добавлено")

# ================= MODERATION =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def kick(interaction: discord.Interaction, member:discord.Member):

    await member.kick()

    await log(f"{member} kicked")

    await interaction.response.send_message("Кикнут")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def ban(interaction: discord.Interaction, member:discord.Member):

    await member.ban()

    await log(f"{member} banned")

    await interaction.response.send_message("Забанен")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def unban(interaction: discord.Interaction, user_id:int):

    user = await bot.fetch_user(user_id)

    await interaction.guild.unban(user)

    await log(f"{user} unbanned")

    await interaction.response.send_message("Разбанен")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def purge(interaction: discord.Interaction, amount:int):

    await interaction.channel.purge(limit=amount)

    await interaction.response.send_message("Очищено", ephemeral=True)

# ================= WARN =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def warn(interaction: discord.Interaction, member:discord.Member, reason:str):

    async with aiosqlite.connect(DB) as db:

        await db.execute("INSERT INTO warns VALUES (?,?)",(member.id,reason))

        await db.commit()

    await log(f"{member} warned")

    await interaction.response.send_message("Warn выдан")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def warns(interaction: discord.Interaction, member:discord.Member):

    async with aiosqlite.connect(DB) as db:

        cursor = await db.execute("SELECT reason FROM warns WHERE user_id=?",(member.id,))
        rows = await cursor.fetchall()

    text = "\n".join(r[0] for r in rows) or "Нет варнов"

    await interaction.response.send_message(text)

# ================= ROLE =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def role_add(interaction: discord.Interaction, member:discord.Member, role:discord.Role):

    await member.add_roles(role)

    await log(f"{member} got role {role}")

    await interaction.response.send_message("Роль выдана")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def role_remove(interaction: discord.Interaction, member:discord.Member, role:discord.Role):

    await member.remove_roles(role)

    await log(f"{member} removed role {role}")

    await interaction.response.send_message("Роль снята")

# ================= CHANNEL =================

@tree.command(guild=discord.Object(id=GUILD_ID))
async def lock(interaction: discord.Interaction):

    await interaction.channel.set_permissions(
        interaction.guild.default_role,
        send_messages=False
    )

    await interaction.response.send_message("Канал закрыт")

@tree.command(guild=discord.Object(id=GUILD_ID))
async def unlock(interaction: discord.Interaction):

    await interaction.channel.set_permissions(
        interaction.guild.default_role,
        send_messages=True
    )

    await interaction.response.send_message("Канал открыт")

# ================= PANEL =================

class Panel(discord.ui.View):

    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):

        async with aiosqlite.connect(DB) as db:

            cursor = await db.execute("SELECT balance FROM safe")

            bal = (await cursor.fetchone())[0]

        await interaction.response.send_message(f"{bal}$", ephemeral=True)

@tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):

    embed = discord.Embed(
        title="HUBsters GOD CONTROL",
        description="Панель управления",
        color=0x00ff88
    )

    await interaction.response.send_message(embed=embed, view=Panel())

# ================= START =================

bot.run(TOKEN)
