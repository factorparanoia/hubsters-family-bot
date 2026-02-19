require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commandDefinitions } = require('./command-definitions');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID');
}

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandDefinitions.map((command) => command.toJSON())
  });
  console.log('Guild slash commands registered');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
