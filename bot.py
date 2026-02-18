import discord
from discord.ext import commands
from discord import app_commands
import aiosqlite
import os
import io
import aiohttp
from PIL import Image, ImageDraw

# ========= ENV VARIABLES =========

TOKEN = os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID"))
LOG_CHANNEL_ID = int(os.getenv("LOG_CHANNEL_ID"))

DB_NAME = "hubsters.db"

# ========= INTENTS =========

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ========= DATABASE INIT =========

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("""
        CREATE TABLE IF NOT EXISTS safe (
            balance INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS warehouse (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS guns (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            text TEXT
        )
        """)

        cursor = await db.execute("SELECT COUNT(*) FROM safe")
        count = await cursor.fetchone()

        if count[0] == 0:
            await db.execute("INSERT INTO safe VALUES (0)")

        await db.commit()

# ========= READY =========

@bot.event
async def on_ready():
    await init_db()
    await bot.tree.sync(guild=discord.Object(id=GUILD_ID))
    print(f"✅ HUBsters Family Bot ONLINE: {bot.user}")

# ========= WELCOME IMAGE =========

async def create_welcome(member):

    async with aiohttp.ClientSession() as session:
        async with session.get(member.display_avatar.url) as resp:
            avatar_bytes = await resp.read()

    avatar = Image.open(io.BytesIO(avatar_bytes)).resize((128,128))

    img = Image.new("RGB", (600,200), (30,30,30))
    img.paste(avatar, (30,36))

    draw = ImageDraw.Draw(img)
    draw.text((180,70), f"Добро пожаловать,", fill=(255,255,255))
    draw.text((180,100), member.name, fill=(0,255,150))

    buffer = io.BytesIO()
    img.save(buffer, "PNG")
    buffer.seek(0)

    return buffer

# ========= MEMBER JOIN =========

@bot.event
async def on_member_join(member):

    channel = bot.get_channel(WELCOME_CHANNEL_ID)

    image = await create_welcome(member)

    file = discord.File(image, "welcome.png")

    embed = discord.Embed(
        title="👑 HUBsters Family",
        description=f"{member.mention} вступил в семью",
        color=0x00ff88
    )

    embed.set_image(url="attachment://welcome.png")

    await channel.send(file=file, embed=embed)

# ========= SAFE =========

@bot.tree.command(name="safe", description="Баланс сейфа", guild=discord.Object(id=GUILD_ID))
async def safe(interaction: discord.Interaction):

    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT balance FROM safe")
        balance = await cursor.fetchone()

    await interaction.response.send_message(f"💰 Баланс сейфа: {balance[0]}$")

@bot.tree.command(name="safe_add", guild=discord.Object(id=GUILD_ID))
async def safe_add(interaction: discord.Interaction, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("UPDATE safe SET balance = balance + ?", (amount,))
        await db.commit()

    await interaction.response.send_message(f"Добавлено {amount}$")

@bot.tree.command(name="safe_remove", guild=discord.Object(id=GUILD_ID))
async def safe_remove(interaction: discord.Interaction, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("UPDATE safe SET balance = balance - ?", (amount,))
        await db.commit()

    await interaction.response.send_message(f"Изъято {amount}$")

# ========= WAREHOUSE =========

@bot.tree.command(name="warehouse_add", guild=discord.Object(id=GUILD_ID))
async def warehouse_add(interaction: discord.Interaction, name:str, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
        INSERT INTO warehouse VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))

        await db.commit()

    await interaction.response.send_message(f"📦 Добавлено {name} x{amount}")

@bot.tree.command(name="warehouse", guild=discord.Object(id=GUILD_ID))
async def warehouse(interaction: discord.Interaction):

    async with aiosqlite.connect(DB_NAME) as db:

        cursor = await db.execute("SELECT * FROM warehouse")
        rows = await cursor.fetchall()

    text = ""

    for row in rows:
        text += f"{row[0]}: {row[1]}\n"

    if text == "":
        text = "Пусто"

    await interaction.response.send_message(f"📦 Склад:\n{text}")

# ========= GUNS =========

@bot.tree.command(name="gun_add", guild=discord.Object(id=GUILD_ID))
async def gun_add(interaction: discord.Interaction, name:str, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("""
        INSERT INTO guns VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))

        await db.commit()

    await interaction.response.send_message(f"🔫 Добавлено {name} x{amount}")

@bot.tree.command(name="guns", guild=discord.Object(id=GUILD_ID))
async def guns(interaction: discord.Interaction):

    async with aiosqlite.connect(DB_NAME) as db:

        cursor = await db.execute("SELECT * FROM guns")
        rows = await cursor.fetchall()

    text = ""

    for row in rows:
        text += f"{row[0]}: {row[1]}\n"

    if text == "":
        text = "Нет оружия"

    await interaction.response.send_message(f"🔫 Оружие:\n{text}")

# ========= PANEL =========

class Panel(discord.ui.View):

    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):
        await interaction.response.send_message("Используй команду /safe", ephemeral=True)

    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def wh_btn(self, interaction, button):
        await interaction.response.send_message("Используй /warehouse", ephemeral=True)

    @discord.ui.button(label="Оружие", style=discord.ButtonStyle.red)
    async def gun_btn(self, interaction, button):
        await interaction.response.send_message("Используй /guns", ephemeral=True)

@bot.tree.command(name="panel", guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):

    embed = discord.Embed(
        title="HUBsters Family Control Panel",
        description="Панель управления",
        color=0x00ff88
    )

    await interaction.response.send_message(embed=embed, view=Panel())

# ========= START =========

bot.run(TOKEN)
