require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commandDefinitions } = require('./command-definitions');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID (DISCORD_GUILD_ID is optional)');
}

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  const body = commandDefinitions.map((command) => command.toJSON());

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Guild slash commands registered (${body.length}) for guild ${guildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Global slash commands registered (${body.length})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
