import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import io
from PIL import Image, ImageDraw
import datetime

# ================= CONFIG =================
TOKEN = "MTQ3MzY1OTMzODM1ODAwMTgxNw.GAWnQu.VutiZEBoTBJldle4KONDrHbXfHefTkcDbPazoc"  # вставь свой токен
GUILD_ID = 1473397177576329219      # твой сервер
WELCOME_CHANNEL_ID = 1234567890
LOG_CHANNEL_ID = 1234567890

DB = "hubsters_ui.db"

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree

# ================= DATABASE =================
async def init_db():
    async with aiosqlite.connect(DB) as db_conn:
        await db_conn.execute("""CREATE TABLE IF NOT EXISTS safe(balance INTEGER)""")
        await db_conn.execute("""CREATE TABLE IF NOT EXISTS warehouse(item TEXT PRIMARY KEY, amount INTEGER)""")
        await db_conn.execute("""CREATE TABLE IF NOT EXISTS guns(gun TEXT PRIMARY KEY, amount INTEGER)""")
        await db_conn.execute("""CREATE TABLE IF NOT EXISTS warns(user_id INTEGER, reason TEXT)""")
        cursor = await db_conn.execute("SELECT COUNT(*) FROM safe")
        if (await cursor.fetchone())[0] == 0:
            await db_conn.execute("INSERT INTO safe VALUES(0)")
        await db_conn.commit()

# ================= LOG =================
async def log(text):
    ch = bot.get_channel(LOG_CHANNEL_ID)
    if ch:
        await ch.send(f"📋 {text}")
    async with aiosqlite.connect(DB) as db_conn:
        await db_conn.execute("INSERT INTO logs VALUES (?,?)", (text, str(datetime.datetime.now())))
        await db_conn.commit()

# ================= WELCOME IMAGE =================
async def welcome_image(member):
    avatar_bytes = await member.display_avatar.read()
    avatar = Image.open(io.BytesIO(avatar_bytes)).resize((128,128))
    bg = Image.new("RGB",(600,200),(20,20,20))
    bg.paste(avatar,(30,40))
    draw = ImageDraw.Draw(bg)
    draw.text((200,80), member.name, fill=(0,255,150))
    draw.text((200,120), "Добро пожаловать в HUBsters Family", fill=(255,255,255))
    buf=io.BytesIO()
    bg.save(buf,"PNG")
    buf.seek(0)
    return buf

@bot.event
async def on_member_join(member):
    ch = bot.get_channel(WELCOME_CHANNEL_ID)
    if not ch:
        return
    img = await welcome_image(member)
    file = discord.File(img, "welcome.png")
    embed = discord.Embed(title="Новый участник", description=member.mention, color=0x00ff88)
    embed.set_image(url="attachment://welcome.png")
    await ch.send(embed=embed, file=file)
    await log(f"{member} joined")

# ================= UI PANEL =================
class MainPanel(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    # ---------- SAFE ----------
    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db_conn:
            cursor = await db_conn.execute("SELECT balance FROM safe")
            bal = (await cursor.fetchone())[0]
        await interaction.response.send_message(f"💰 Сейф: {bal}$", ephemeral=True)

    @discord.ui.button(label="Добавить в Сейф", style=discord.ButtonStyle.green)
    async def safe_add_btn(self, interaction, button):
        await interaction.response.send_modal(SafeModal(action="add"))

    @discord.ui.button(label="Убрать из Сейфа", style=discord.ButtonStyle.red)
    async def safe_remove_btn(self, interaction, button):
        await interaction.response.send_modal(SafeModal(action="remove"))

    # ---------- WAREHOUSE ----------
    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def warehouse_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db_conn:
            cursor = await db_conn.execute("SELECT * FROM warehouse")
            rows = await cursor.fetchall()
        text = "\n".join(f"{i}: {a}" for i,a in rows) or "Пусто"
        await interaction.response.send_message(f"📦 Склад:\n{text}", ephemeral=True)

    @discord.ui.button(label="Добавить в Склад", style=discord.ButtonStyle.blurple)
    async def warehouse_add_btn(self, interaction, button):
        await interaction.response.send_modal(WarehouseModal(action="add"))

    # ---------- GUNS ----------
    @discord.ui.button(label="Оружие", style=discord.ButtonStyle.gray)
    async def guns_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db_conn:
            cursor = await db_conn.execute("SELECT * FROM guns")
            rows = await cursor.fetchall()
        text = "\n".join(f"{g}: {a}" for g,a in rows) or "Нет оружия"
        await interaction.response.send_message(f"🔫 Оружие:\n{text}", ephemeral=True)

    @discord.ui.button(label="Добавить оружие", style=discord.ButtonStyle.gray)
    async def guns_add_btn(self, interaction, button):
        await interaction.response.send_modal(GunsModal(action="add"))

# ================= MODALS =================
class SafeModal(discord.ui.Modal, title="Сейф"):
    def __init__(self, action):
        super().__init__()
        self.action = action
    amount = discord.ui.TextInput(label="Сумма", placeholder="Введите сумму", required=True)
    async def on_submit(self, interaction: discord.Interaction):
        amt = int(self.amount.value)
        async with aiosqlite.connect(DB) as db_conn:
            if self.action == "add":
                await db_conn.execute("UPDATE safe SET balance=balance+?",(amt,))
            else:
                await db_conn.execute("UPDATE safe SET balance=balance-?",(amt,))
            await db_conn.commit()
        await interaction.response.send_message(f"{'Добавлено' if self.action=='add' else 'Убрано'} {amt}$", ephemeral=True)

class WarehouseModal(discord.ui.Modal, title="Склад"):
    def __init__(self, action):
        super().__init__()
        self.action = action
    item = discord.ui.TextInput(label="Название предмета")
    amount = discord.ui.TextInput(label="Количество")
    async def on_submit(self, interaction: discord.Interaction):
        amt = int(self.amount.value)
        async with aiosqlite.connect(DB) as db_conn:
            await db_conn.execute("""
            INSERT INTO warehouse VALUES(?,?)
            ON CONFLICT(item) DO UPDATE SET amount=amount+?
            """,(self.item.value, amt, amt))
            await db_conn.commit()
        await interaction.response.send_message(f"📦 Добавлено {self.item.value} x{amt}", ephemeral=True)

class GunsModal(discord.ui.Modal, title="Оружие"):
    def __init__(self, action):
        super().__init__()
        self.action = action
    gun = discord.ui.TextInput(label="Название оружия")
    amount = discord.ui.TextInput(label="Количество")
    async def on_submit(self, interaction: discord.Interaction):
        amt = int(self.amount.value)
        async with aiosqlite.connect(DB) as db_conn:
            await db_conn.execute("""
            INSERT INTO guns VALUES(?,?)
            ON CONFLICT(gun) DO UPDATE SET amount=amount+?
            """,(self.gun.value, amt, amt))
            await db_conn.commit()
        await interaction.response.send_message(f"🔫 Добавлено {self.gun.value} x{amt}", ephemeral=True)

# ================= PANEL COMMAND =================
@tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):
    embed = discord.Embed(title="HUBsters CONTROL PANEL", description="Управление семьёй через кнопки", color=0x00ff88)
    await interaction.response.send_message(embed=embed, view=MainPanel())

# ================= AUTO SAVE =================
@tasks.loop(minutes=10)
async def auto_save():
    await log("Автосохранение данных выполнено")

# ================= ON READY =================
@bot.event
async def on_ready():
    await init_db()
    print(f"BOT READY: {bot.user}")
    if not auto_save.is_running():
        auto_save.start()
    await tree.sync(guild=discord.Object(id=GUILD_ID))

# ================= START BOT =================
bot.run(TOKEN)
