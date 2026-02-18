# ================================
# FULL DISCORD MANAGEMENT BOT
# 100+ READY STRUCTURE + WEB GUI
# discord.py 2.4+
# Flask Dashboard Included
# Railway / VPS READY
# ================================

import discord
from discord.ext import commands, tasks
from discord import app_commands
import sqlite3
import asyncio
import os
import datetime
import threading
from flask import Flask, render_template_string, request, redirect

# ================================
# CONFIG
# ================================

TOKEN = os.getenv("TOKEN") or "YOUR_TOKEN_HERE"
PREFIX = "!"
DB_NAME = "bot.db"
OWNER_ID = 1234567890

# ================================
# INTENTS
# ================================

intents = discord.Intents.all()

bot = commands.Bot(
    command_prefix=PREFIX,
    intents=intents,
    help_command=None
)

# ================================
# DATABASE
# ================================

def db():
    return sqlite3.connect(DB_NAME)

def init_db():
    with db() as conn:
        c = conn.cursor()

        c.execute("""
        CREATE TABLE IF NOT EXISTS warnings(
            user_id INTEGER,
            guild_id INTEGER,
            reason TEXT,
            time TEXT
        )
        """)

        c.execute("""
        CREATE TABLE IF NOT EXISTS settings(
            guild_id INTEGER,
            key TEXT,
            value TEXT
        )
        """)

        c.execute("""
        CREATE TABLE IF NOT EXISTS economy(
            user_id INTEGER,
            balance INTEGER
        )
        """)

init_db()

# ================================
# WEB DASHBOARD (GUI)
# ================================

app = Flask(__name__)

HTML = """
<html>
<head>
<title>Bot Control Panel</title>
<style>
body {background:#111;color:white;font-family:Arial}
button {padding:10px;margin:5px;background:#5865F2;color:white;border:none}
</style>
</head>
<body>

<h1>Bot Dashboard</h1>

<form method="post">
<button name="action" value="shutdown">Shutdown Bot</button>
<button name="action" value="restart">Restart Bot</button>
</form>

</body>
</html>
"""

@app.route("/", methods=["GET","POST"])
def panel():
    if request.method == "POST":
        if request.form["action"] == "shutdown":
            asyncio.run_coroutine_threadsafe(bot.close(), bot.loop)
    return render_template_string(HTML)

def run_web():
    app.run(host="0.0.0.0", port=8080)

# ================================
# EVENTS
# ================================

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"Slash synced: {len(synced)}")
    except:
        pass

# ================================
# HELP
# ================================

@bot.command()
async def help(ctx):
    embed = discord.Embed(title="Bot Commands", color=0x5865F2)

    embed.add_field(name="Moderation",
    value="""
!ban
!kick
!mute
!unmute
!warn
!clear
!lock
!unlock
""", inline=False)

    embed.add_field(name="Roles",
    value="""
!addrole
!removerole
!createrole
!deleterole
""", inline=False)

    embed.add_field(name="Channels",
    value="""
!createchannel
!deletechannel
!slowmode
""", inline=False)

    embed.add_field(name="Economy",
    value="""
!balance
!addmoney
!removemoney
""", inline=False)

    await ctx.send(embed=embed)

# ================================
# MODERATION
# ================================

@bot.command()
@commands.has_permissions(ban_members=True)
async def ban(ctx, member: discord.Member, *, reason="No reason"):
    await member.ban(reason=reason)
    await ctx.send(f"Banned {member}")

@bot.command()
@commands.has_permissions(kick_members=True)
async def kick(ctx, member: discord.Member, *, reason="No reason"):
    await member.kick(reason=reason)
    await ctx.send(f"Kicked {member}")

@bot.command()
@commands.has_permissions(manage_messages=True)
async def clear(ctx, amount: int):
    await ctx.channel.purge(limit=amount)
    await ctx.send(f"Deleted {amount}", delete_after=3)

# ================================
# WARN SYSTEM
# ================================

@bot.command()
async def warn(ctx, member: discord.Member, *, reason="No reason"):
    with db() as conn:
        conn.execute(
            "INSERT INTO warnings VALUES(?,?,?,?)",
            (member.id, ctx.guild.id, reason, str(datetime.datetime.now()))
        )
    await ctx.send(f"Warned {member}")

@bot.command()
async def warnings(ctx, member: discord.Member):
    with db() as conn:
        rows = conn.execute(
            "SELECT reason FROM warnings WHERE user_id=?",
            (member.id,)
        ).fetchall()

    text = "\n".join([r[0] for r in rows]) or "None"
    await ctx.send(text)

# ================================
# MUTE SYSTEM
# ================================

@bot.command()
@commands.has_permissions(manage_roles=True)
async def mute(ctx, member: discord.Member):

    role = discord.utils.get(ctx.guild.roles, name="Muted")

    if not role:
        role = await ctx.guild.create_role(name="Muted")

        for ch in ctx.guild.channels:
            await ch.set_permissions(role, send_messages=False)

    await member.add_roles(role)
    await ctx.send("Muted")

@bot.command()
async def unmute(ctx, member: discord.Member):
    role = discord.utils.get(ctx.guild.roles, name="Muted")
    await member.remove_roles(role)
    await ctx.send("Unmuted")

# ================================
# ROLES
# ================================

@bot.command()
async def addrole(ctx, member: discord.Member, role: discord.Role):
    await member.add_roles(role)

@bot.command()
async def removerole(ctx, member: discord.Member, role: discord.Role):
    await member.remove_roles(role)

@bot.command()
async def createrole(ctx, name):
    await ctx.guild.create_role(name=name)

@bot.command()
async def deleterole(ctx, role: discord.Role):
    await role.delete()

# ================================
# CHANNELS
# ================================

@bot.command()
async def createchannel(ctx, name):
    await ctx.guild.create_text_channel(name)

@bot.command()
async def deletechannel(ctx, channel: discord.TextChannel):
    await channel.delete()

@bot.command()
async def lock(ctx):
    await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=False)

@bot.command()
async def unlock(ctx):
    await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=True)

# ================================
# ECONOMY
# ================================

def get_balance(user):
    with db() as conn:
        row = conn.execute(
            "SELECT balance FROM economy WHERE user_id=?",
            (user,)
        ).fetchone()

        if row:
            return row[0]

        conn.execute(
            "INSERT INTO economy VALUES(?,?)",
            (user, 0)
        )

        return 0

def add_balance(user, amount):
    bal = get_balance(user)
    with db() as conn:
        conn.execute(
            "UPDATE economy SET balance=? WHERE user_id=?",
            (bal + amount, user)
        )

@bot.command()
async def balance(ctx, member: discord.Member=None):
    member = member or ctx.author
    await ctx.send(get_balance(member.id))

@bot.command()
async def addmoney(ctx, member: discord.Member, amount:int):
    add_balance(member.id, amount)

@bot.command()
async def removemoney(ctx, member: discord.Member, amount:int):
    add_balance(member.id, -amount)

# ================================
# MASS CONTROL
# ================================

@bot.command()
async def massrole(ctx, role: discord.Role):
    for member in ctx.guild.members:
        await member.add_roles(role)

@bot.command()
async def masskick(ctx):
    for member in ctx.guild.members:
        if member != ctx.author:
            await member.kick()

# ================================
# AUTO TASKS
# ================================

@tasks.loop(minutes=10)
async def auto_save():
    print("Autosave")

auto_save.start()

# ================================
# ADMIN
# ================================

@bot.command()
async def shutdown(ctx):
    if ctx.author.id == OWNER_ID:
        await bot.close()

@bot.command()
async def restart(ctx):
    if ctx.author.id == OWNER_ID:
        os.execv(__file__, ["python"] + [__file__])

# ================================
# 100+ COMMAND STRUCTURE READY
# ADD MORE MODULES HERE
# ================================

# placeholders
for i in range(1,101):

    async def cmd(ctx, i=i):
        await ctx.send(f"Function {i} working")

    bot.command(name=f"func{i}")(cmd)

# ================================
# START WEB PANEL
# ================================

threading.Thread(target=run_web).start()

# ================================
# RUN BOT
# ================================

bot.run(TOKEN)
