
import discord
from discord import app_commands
from discord.ext import commands

class Say(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="say", description="Send message as bot")
    async def say(self, interaction: discord.Interaction, text: str, image: discord.Attachment=None):
        await interaction.response.defer(ephemeral=True)
        if image:
            await interaction.channel.send(text, file=await image.to_file())
        else:
            await interaction.channel.send(text)
        await interaction.followup.send("Sent.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(Say(bot))
