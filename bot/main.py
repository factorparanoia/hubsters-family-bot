
import discord
from discord.ext import commands
from bot.config import TOKEN, GUILD_ID

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print("Bot ready:", bot.user)
    guild = discord.Object(id=GUILD_ID)
    bot.tree.copy_global_to(guild=guild)
    await bot.tree.sync(guild=guild)

async def main():
    async with bot:
        await bot.load_extension("bot.cogs.ai_chat")
        await bot.load_extension("bot.cogs.say")
        await bot.start(TOKEN)

import asyncio
asyncio.run(main())
