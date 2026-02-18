import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import os
import io
import aiohttp
from PIL import Image, ImageDraw
import random
import asyncio
from datetime import datetime

# ================= ENV =================

TOKEN = os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID"))
LOG_CHANNEL_ID = int(os.getenv("LOG_CHANNEL_ID"))
CONTROL_CHANNEL_ID = int(os.getenv("CONTROL_CHANNEL_ID"))
OWNER_ID = int(os.getenv("OWNER_ID"))

DB_NAME = "hubsters.db"

# ================= INTENTS =================

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ================= DATABASE =================

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("CREATE TABLE IF NOT EXISTS safe (balance INTEGER)")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS warehouse (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )""")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS guns (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )""")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            text TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            responsible TEXT,
            status TEXT
        )""")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS warnings (
            user_id INTEGER,
            count INTEGER
        )""")

        cursor = await db.execute("SELECT COUNT(*) FROM safe")
        count = await cursor.fetchone()
        if count[0] == 0:
            await db.execute("INSERT INTO safe VALUES (0)")

        await db.commit()

async def log_action(text):
    channel = bot.get_channel(LOG_CHANNEL_ID)
    if channel:
        await channel.send(f"📋 {text}")
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("INSERT INTO logs (text) VALUES (?)", (text,))
        await db.commit()

# ================= READY =================

@bot.event
async def on_ready():
    await init_db()
    await bot.tree.sync(guild=discord.Object(id=GUILD_ID))
    weekly_report.start()
    print(f"✅ HUBsters Family PRO ONLINE: {bot.user}")

# ================= WELCOME =================

async def create_welcome(member):
    async with aiohttp.ClientSession() as session:
        async with session.get(member.display_avatar.url) as resp:
            avatar_bytes = await resp.read()

    avatar = Image.open(io.BytesIO(avatar_bytes)).resize((128,128))
    img = Image.new("RGB", (700,250), (25,25,25))
    img.paste(avatar, (40,60))
    draw = ImageDraw.Draw(img)
    draw.text((220,90), "Добро пожаловать в HUBsters Family", fill=(255,255,255))
    draw.text((220,130), member.name, fill=(0,255,150))
    buffer = io.BytesIO()
    img.save(buffer, "PNG")
    buffer.seek(0)
    return buffer

@bot.event
async def on_member_join(member):
    channel = bot.get_channel(WELCOME_CHANNEL_ID)
    image = await create_welcome(member)
    file = discord.File(image, "welcome.png")
    embed = discord.Embed(
        title="👑 Новый участник семьи",
        description=f"{member.mention} теперь с нами.",
        color=0x00ff88
    )
    embed.set_image(url="attachment://welcome.png")
    await channel.send(file=file, embed=embed)

# ================= SAFE =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def safe(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT balance FROM safe")
        balance = (await cursor.fetchone())[0]
    await interaction.response.send_message(f"💰 Баланс сейфа: {balance}$")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_add(interaction: discord.Interaction, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE safe SET balance = balance + ?", (amount,))
        await db.commit()
    await log_action(f"{interaction.user} добавил {amount}$ в сейф")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_remove(interaction: discord.Interaction, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE safe SET balance = balance - ?", (amount,))
        await db.commit()
    await log_action(f"{interaction.user} изъял {amount}$ из сейфа")
    await interaction.response.send_message("Изъято")

# ================= WAREHOUSE =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse_add(interaction: discord.Interaction, name:str, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
        INSERT INTO warehouse VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))
        await db.commit()
    await log_action(f"{interaction.user} добавил {name} x{amount}")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM warehouse")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}: {r[1]}" for r in rows]) or "Пусто"
    await interaction.response.send_message(f"📦 Склад:\n{text}")

# ================= GUNS =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def gun_add(interaction: discord.Interaction, name:str, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
        INSERT INTO guns VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))
        await db.commit()
    await log_action(f"{interaction.user} добавил оружие {name} x{amount}")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def guns(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM guns")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}: {r[1]}" for r in rows]) or "Нет оружия"
    await interaction.response.send_message(f"🔫 Оружие:\n{text}")

# ================= TASK SYSTEM =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def task_create(interaction: discord.Interaction, title:str, user:discord.Member):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("INSERT INTO tasks (title,responsible,status) VALUES (?,?,?)",
                         (title,str(user),"В процессе"))
        await db.commit()
    await interaction.response.send_message("Задача создана")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def tasks_list(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM tasks")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}. {r[1]} — {r[3]}" for r in rows]) or "Нет задач"
    await interaction.response.send_message(text)

# ================= WARN SYSTEM =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warn(interaction: discord.Interaction, user:discord.Member):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT count FROM warnings WHERE user_id=?",(user.id,))
        row = await cursor.fetchone()
        if row:
            await db.execute("UPDATE warnings SET count=count+1 WHERE user_id=?",(user.id,))
        else:
            await db.execute("INSERT INTO warnings VALUES (?,1)",(user.id,))
        await db.commit()
    await interaction.response.send_message("Выдан выговор")

# ================= GIVEAWAY =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def giveaway(interaction: discord.Interaction, minutes:int, winners:int, prize:str):
    await interaction.response.send_message(f"🎉 Розыгрыш: {prize} через {minutes} минут")
    await asyncio.sleep(minutes*60)
    members = interaction.guild.members
    winners_list = random.sample(members, min(winners, len(members)))
    text = "\n".join([w.mention for w in winners_list])
    await interaction.followup.send(f"🏆 Победители:\n{text}")

# ================= WEEKLY REPORT =================

@tasks.loop(hours=168)
async def weekly_report():
    channel = bot.get_channel(LOG_CHANNEL_ID)
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT balance FROM safe")
        balance = (await cursor.fetchone())[0]
    await channel.send(f"📊 Недельный отчёт\nБаланс сейфа: {balance}$")

# ================= CONTROL PANEL =================

class MainPanel(discord.ui.View):
    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):
        await interaction.response.send_message("Используй /safe", ephemeral=True)

    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def wh_btn(self, interaction, button):
        await interaction.response.send_message("Используй /warehouse", ephemeral=True)

    @discord.ui.button(label="Оружие", style=discord.ButtonStyle.red)
    async def gun_btn(self, interaction, button):
        await interaction.response.send_message("Используй /guns", ephemeral=True)

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):
    embed = discord.Embed(
        title="👑 HUBsters Family PRO",
        description="Центр управления семьёй",
        color=0x00ff88
    )
    await interaction.response.send_message(embed=embed, view=MainPanel())

# ================= START =================

bot.run(TOKEN)
