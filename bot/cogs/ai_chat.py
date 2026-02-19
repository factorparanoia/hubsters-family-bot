
import discord
from discord import app_commands
from discord.ext import commands
from bot.ai import ask_ai

class AIChat(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="ai", description="Ask AI")
    async def ai(self, interaction: discord.Interaction, prompt: str):
        await interaction.response.defer()
        reply = await ask_ai(prompt)
        await interaction.followup.send(reply[:2000])

async def setup(bot):
    await bot.add_cog(AIChat(bot))
