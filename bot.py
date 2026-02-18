import discord
from discord.ext import commands
from discord import app_commands
import json
import aiosqlite
from database import init_db, DB_NAME
from PIL import Image, ImageDraw, ImageFont
import aiohttp
import io

with open("config.json") as f:
    config = json.load(f)

TOKEN = config["token"]
GUILD_ID = config["guild_id"]
WELCOME_CHANNEL = config["welcome_channel_id"]
LOG_CHANNEL = config["log_channel_id"]
CONTROL_CHANNEL = config["control_channel_id"]
FAMILY_ROLE = config["family_role_id"]

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ---------- READY ----------

@bot.event
async def on_ready():
    await init_db()
    await bot.tree.sync(guild=discord.Object(id=GUILD_ID))
    print(f"✅ HUBsters Family Bot запущен как {bot.user}")

# ---------- WELCOME SYSTEM ----------

async def generate_welcome(member):

    async with aiohttp.ClientSession() as session:
        async with session.get(member.display_avatar.url) as resp:
            avatar = await resp.read()

    base = Image.new("RGB", (800, 300), (20, 20, 20))
    draw = ImageDraw.Draw(base)

    avatar_img = Image.open(io.BytesIO(avatar)).resize((150,150))
    base.paste(avatar_img, (50,75))

    draw.text((250, 100), f"Добро пожаловать,", fill=(255,255,255))
    draw.text((250, 150), member.name, fill=(0,255,150))

    buffer = io.BytesIO()
    base.save(buffer, "PNG")
    buffer.seek(0)

    return buffer

@bot.event
async def on_member_join(member):

    channel = bot.get_channel(WELCOME_CHANNEL)
    image = await generate_welcome(member)

    file = discord.File(image, "welcome.png")

    embed = discord.Embed(
        title="Добро пожаловать в HUBsters Family",
        description=f"{member.mention} теперь часть семьи.",
        color=0x00ff88
    )

    embed.set_image(url="attachment://welcome.png")

    await channel.send(file=file, embed=embed)

# ---------- SAFE COMMANDS ----------

@bot.tree.command(name="safe_balance", guild=discord.Object(id=GUILD_ID))
async def safe_balance(interaction: discord.Interaction):

    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT balance FROM safe WHERE id=1")
        balance = (await cursor.fetchone())[0]

    await interaction.response.send_message(f"💰 Сейф: {balance}$")

@bot.tree.command(name="safe_add", guild=discord.Object(id=GUILD_ID))
async def safe_add(interaction: discord.Interaction, amount:int, reason:str):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("UPDATE safe SET balance = balance + ?", (amount,))
        await db.execute(
            "INSERT INTO safe_logs VALUES (?,?,?, ?, CURRENT_TIMESTAMP)",
            (interaction.user.name, amount, "ADD", reason)
        )
        await db.commit()

    await interaction.response.send_message(f"Добавлено {amount}$")

# ---------- WAREHOUSE ----------

@bot.tree.command(name="warehouse_add", guild=discord.Object(id=GUILD_ID))
async def warehouse_add(interaction: discord.Interaction, name:str, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("""
        INSERT INTO warehouse VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """, (name, amount, amount))

        await db.commit()

    await interaction.response.send_message(f"Добавлено {name} x{amount}")

# ---------- GUNS ----------

@bot.tree.command(name="gun_add", guild=discord.Object(id=GUILD_ID))
async def gun_add(interaction: discord.Interaction, name:str, amount:int):

    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("""
        INSERT INTO guns VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """, (name, amount, amount))

        await db.commit()

    await interaction.response.send_message(f"Добавлено оружие {name} x{amount}")

# ---------- CONTROL PANEL ----------

class HubPanel(discord.ui.View):

    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe(self, interaction:discord.Interaction, button:discord.ui.Button):
