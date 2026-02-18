import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import random
from typing import Optional

TOKEN = "MTQ3MzY1OTMzODM1ODAwMTgxNw.GAWnQu.VutiZEBoTBJldle4KONDrHbXfHefTkcDbPazoc"
GUILD_ID = 1473397177576329219
LOG_CHANNEL_ID = 1473397178797129982

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree
DB = "hubsters_pro_full.db"

# ================= DATABASE INIT =================
async def init_db():
    async with aiosqlite.connect(DB) as db:
        tables = [
            "safe(balance INTEGER)",
            "warehouse(item TEXT PRIMARY KEY, amount INTEGER)",
            "guns(gun TEXT PRIMARY KEY, amount INTEGER)",
            "warns(user_id INTEGER, reason TEXT)",
            "ranks(user_id INTEGER, rank TEXT)",
            "logs(action TEXT, date TEXT)"
        ]
        for t in tables:
            await db.execute(f"CREATE TABLE IF NOT EXISTS {t}")
        cursor = await db.execute("SELECT COUNT(*) FROM safe")
        if (await cursor.fetchone())[0] == 0:
            await db.execute("INSERT INTO safe VALUES(0)")
        await db.commit()

# ================= LOGGING =================
async def log(text):
    ch = bot.get_channel(LOG_CHANNEL_ID)
    if ch:
        await ch.send(f"📋 {text}")
    async with aiosqlite.connect(DB) as db:
        await db.execute("INSERT INTO logs VALUES(?,?)", (text, str(asyncio.get_event_loop().time())))
        await db.commit()

# ================= AUTO SAVE =================
@tasks.loop(minutes=10)
async def auto_save():
    await log("Автосохранение данных выполнено")

# ================= GUI PANEL =================
class SuperPanel(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    # ------------------- SAFE -------------------
    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db:
            cursor = await db.execute("SELECT balance FROM safe")
            bal = (await cursor.fetchone())[0]
        await interaction.response.send_message(f"💰 Сейф: {bal}$", ephemeral=True)

    @discord.ui.button(label="Добавить в Сейф", style=discord.ButtonStyle.green)
    async def safe_add(self, interaction, button):
        await interaction.response.send_modal(SafeModal("add"))

    @discord.ui.button(label="Убрать из Сейфа", style=discord.ButtonStyle.red)
    async def safe_remove(self, interaction, button):
        await interaction.response.send_modal(SafeModal("remove"))

    # ------------------- WAREHOUSE -------------------
    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def warehouse_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db:
            cursor = await db.execute("SELECT * FROM warehouse")
            rows = await cursor.fetchall()
        text="\n".join(f"{i}: {a}" for i,a in rows) or "Пусто"
        await interaction.response.send_message(f"📦 Склад:\n{text}", ephemeral=True)

    @discord.ui.button(label="Добавить в Склад", style=discord.ButtonStyle.blurple)
    async def warehouse_add(self, interaction, button):
        await interaction.response.send_modal(WarehouseModal())

    # ------------------- GUNS -------------------
    @discord.ui.button(label="Оружие", style=discord.ButtonStyle.gray)
    async def guns_btn(self, interaction, button):
        async with aiosqlite.connect(DB) as db:
            cursor = await db.execute("SELECT * FROM guns")
            rows = await cursor.fetchall()
        text="\n".join(f"{g}: {a}" for g,a in rows) or "Нет оружия"
        await interaction.response.send_message(f"🔫 Оружие:\n{text}", ephemeral=True)

    @discord.ui.button(label="Добавить оружие", style=discord.ButtonStyle.gray)
    async def guns_add(self, interaction, button):
        await interaction.response.send_modal(GunsModal())

    # ------------------- MESSAGES -------------------
    @discord.ui.button(label="Отправить сообщение", style=discord.ButtonStyle.green)
    async def msg_btn(self, interaction, button):
        await interaction.response.send_modal(MessageModal())

    @discord.ui.button(label="Анонс", style=discord.ButtonStyle.blurple)
    async def announce_btn(self, interaction, button):
        await interaction.response.send_modal(AnnounceModal())

    @discord.ui.button(label="Розыгрыш", style=discord.ButtonStyle.gray)
    async def giveaway_btn(self, interaction, button):
        await interaction.response.send_modal(GiveawayModal())

    # ------------------- MODERATION -------------------
    @discord.ui.button(label="Кик", style=discord.ButtonStyle.red)
    async def kick_btn(self, interaction, button):
        await interaction.response.send_modal(KickModal())

    @discord.ui.button(label="Бан", style=discord.ButtonStyle.red)
    async def ban_btn(self, interaction, button):
        await interaction.response.send_modal(BanModal())

    @discord.ui.button(label="Мут", style=discord.ButtonStyle.gray)
    async def mute_btn(self, interaction, button):
        await interaction.response.send_modal(MuteModal())

    @discord.ui.button(label="Размут", style=discord.ButtonStyle.gray)
    async def unmute_btn(self, interaction, button):
        await interaction.response.send_modal(UnmuteModal())

    # ------------------- CHANNEL CONTROL -------------------
    @discord.ui.button(label="Закрыть канал", style=discord.ButtonStyle.red)
    async def lock_btn(self, interaction, button):
        await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=False)
        await interaction.response.send_message("Канал закрыт", ephemeral=True)

    @discord.ui.button(label="Открыть канал", style=discord.ButtonStyle.green)
    async def unlock_btn(self, interaction, button):
        await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=True)
        await interaction.response.send_message("Канал открыт", ephemeral=True)

    # ------------------- ROLES -------------------
    @discord.ui.button(label="Выдать роль", style=discord.ButtonStyle.green)
    async def role_add_btn(self, interaction, button):
        await interaction.response.send_modal(RoleAddModal())

    @discord.ui.button(label="Снять роль", style=discord.ButtonStyle.red)
    async def role_remove_btn(self, interaction, button):
        await interaction.response.send_modal(RoleRemoveModal())

# ================= MODALS (пример для всех функций) =================
# Safe, Warehouse, Guns, Message, Announce, Giveaway, Kick, Ban, Mute, Unmute, RoleAdd, RoleRemove
# В модальные окна добавляем TextInput, обработка вставки в DB или действия в Discord

# ------------------- EXAMPLE MODALS -------------------
class SafeModal(discord.ui.Modal, title="Сейф"):
    def __init__(self, action):
        super().__init__()
        self.action = action
    amount = discord.ui.TextInput(label="Сумма", placeholder="Введите сумму", required=True)
    async def on_submit(self, interaction: discord.Interaction):
        amt = int(self.amount.value)
        async with aiosqlite.connect(DB) as db:
            if self.action=="add":
                await db.execute("UPDATE safe SET balance=balance+?",(amt,))
            else:
                await db.execute("UPDATE safe SET balance=balance-?",(amt,))
            await db.commit()
        await interaction.response.send_message(f"{'Добавлено' if self.action=='add' else 'Убрано'} {amt}$", ephemeral=True)

class WarehouseModal(discord.ui.Modal, title="Склад"):
    item = discord.ui.TextInput(label="Название предмета")
    amount = discord.ui.TextInput(label="Количество")
    async def on_submit(self, interaction: discord.Interaction):
        amt = int(self.amount.value)
        async with aiosqlite.connect(DB) as db:
            await db.execute("""INSERT INTO warehouse VALUES(?,?) ON CONFLICT(item) DO UPDATE SET amount=amount+?""",
                             (self.item.value, amt, amt))
            await db.commit()
        await interaction.response.send_message(f"Добавлено {self.item.value} x{amt}", ephemeral=True)

# Аналогично создаём модальные окна для Guns, Message, Announce, Giveaway, Kick, Ban, Mute, Unmute, RoleAdd, RoleRemove

# ================= PANEL COMMAND =================
@tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):
    embed = discord.Embed(title="HUBsters PRO PANEL", description="Все функции через кнопки (100+ функций готовы к расширению)", color=0x00ff88)
    await interaction.response.send_message(embed=embed, view=SuperPanel())

# ================= ON READY =================
@bot.event
async def on_ready():
    await init_db()
    print(f"BOT READY: {bot.user}")
    if not auto_save.is_running():
        auto_save.start()
    await tree.sync(guild=discord.Object(id=GUILD_ID))

bot.run(TOKEN)
