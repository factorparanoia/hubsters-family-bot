require('dotenv').config();

const {
  AuditLogEvent,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes
} = require('discord.js');
const { appendJsonArray, readJson, writeJson } = require('./lib/store');
const { buildGuildAnalytics } = require('./lib/analytics');
const { getGuildConfig, setGuildConfig, upsertReactionRole } = require('./lib/config');
const { addXp, getRank, getTop } = require('./lib/levels');
const { commandDefinitions } = require('./command-definitions');
const { startWebPanel } = require('./web/panel');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  throw new Error('DISCORD_TOKEN is not set in environment');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User]
});

function logEvent(guildIdValue, payload) {
  appendJsonArray(`events-${guildIdValue}`, {
    ...payload,
    timestamp: Date.now()
  });
}

async function registerCommandsOnStartup() {
  const autoSync = process.env.AUTO_SYNC_COMMANDS !== 'false';
  if (!autoSync) return;

  if (!clientId) {
    console.warn('[commands] DISCORD_CLIENT_ID is missing, auto-sync skipped');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = commandDefinitions.map((command) => command.toJSON());

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`[commands] synced ${body.length} guild commands to ${guildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`[commands] synced ${body.length} global commands`);
}

async function sendLogMessage(guild, title, fields) {
  const config = getGuildConfig(guild.id);
  if (!config.logChannelId) return;

  const channel = guild.channels.cache.get(config.logChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = new EmbedBuilder().setTitle(title).setColor(0x1f8b4c).addFields(fields).setTimestamp();
  await channel.send({ embeds: [embed] });
}

function hasLink(content) {
  return /(https?:\/\/|www\.)\S+/i.test(content);
}

const implementedCommands = new Set([
  'say','kick','ban','warn','warnings','purge','rank','leveltop','userinfo','safe','warehouse','archive','config','reactionrole','automod','analytics','commands_ua'
]);

client.once('clientReady', async () => {
  console.log(`Bot started as ${client.user.tag}`);
  await registerCommandsOnStartup().catch((error) => {
    console.error('[commands] startup sync failed:', error);
  });
  startWebPanel(client);
});

client.on('error', (error) => {
  console.error('[client-error]', error);
});

client.on('guildMemberAdd', async (member) => {
  logEvent(member.guild.id, {
    type: 'member_join',
    userId: member.id,
    username: member.user.tag
  });

  const config = getGuildConfig(member.guild.id);

  if (config.autoRoleId) {
    await member.roles.add(config.autoRoleId).catch(() => null);
  }

  if (config.welcomeEnabled && config.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (channel && channel.type === ChannelType.GuildText) {
      const text = config.welcomeMessage
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{server}', member.guild.name);
      await channel.send(text);
    }
  }
});

client.on('guildMemberRemove', (member) => {
  logEvent(member.guild.id, {
    type: 'member_leave',
    userId: member.id,
    username: member.user?.tag ?? member.id
  });
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const config = getGuildConfig(message.guild.id);
  const lower = message.content.toLowerCase();

  if (config.automod.linksBlocked && hasLink(message.content)) {
    await message.delete().catch(() => null);
    logEvent(message.guild.id, {
      type: 'automod_link_delete',
      userId: message.author.id,
      username: message.author.tag,
      content: message.content.slice(0, 180)
    });
    return;
  }

  const blockedWord = config.automod.blockedWords.find((word) => lower.includes(word.toLowerCase()));
  if (blockedWord) {
    await message.delete().catch(() => null);
    logEvent(message.guild.id, {
      type: 'automod_word_delete',
      word: blockedWord,
      userId: message.author.id,
      username: message.author.tag,
      content: message.content.slice(0, 180)
    });
    return;
  }

  if (config.suggestionsChannelId && message.channel.id === config.suggestionsChannelId) {
    await message.react('✅').catch(() => null);
    await message.react('❌').catch(() => null);
    logEvent(message.guild.id, {
      type: 'suggestion',
      userId: message.author.id,
      username: message.author.tag,
      content: message.content.slice(0, 250)
    });
  }

  if (config.leveling.enabled && message.content.length >= 3) {
    const gain = 10 + Math.floor(Math.random() * 16);
    const status = addXp(message.guild.id, message.author.id, gain);

    if (status.leveledUp) {
      const announceChannel =
        (config.leveling.levelUpChannelId && message.guild.channels.cache.get(config.leveling.levelUpChannelId)) ||
        message.channel;
      await announceChannel
        .send(`🎉 <@${message.author.id}> повысил уровень до **${status.level}**!`)
        .catch(() => null);
      logEvent(message.guild.id, {
        type: 'level_up',
        userId: message.author.id,
        username: message.author.tag,
        level: status.level
      });
    }
  }
});

client.on('messageDelete', (message) => {
  if (!message.guild || message.author?.bot) return;
  logEvent(message.guild.id, {
    type: 'message_delete',
    userId: message.author?.id,
    username: message.author?.tag,
    content: message.content?.slice(0, 180) || '[empty]'
  });
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;

  const config = getGuildConfig(reaction.message.guild.id);
  const bind = config.reactionRoles.find((item) => item.emoji === reaction.emoji.name);
  if (!bind) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  await member.roles.add(bind.roleId).catch(() => null);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;

  const config = getGuildConfig(reaction.message.guild.id);
  const bind = config.reactionRoles.find((item) => item.emoji === reaction.emoji.name);
  if (!bind) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  await member.roles.remove(bind.roleId).catch(() => null);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const guild = interaction.guild;
    const guildIdValue = guild.id;

    if (interaction.commandName === 'say') {
      const text = interaction.options.getString('text', true);
      await interaction.reply({ content: 'Message sent.', ephemeral: true });
      await interaction.channel.send(text);
      return;
    }

    if (interaction.commandName === 'kick') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        await interaction.reply({ content: 'No permission.', ephemeral: true });
        return;
      }

      const target = interaction.options.getMember('target');
      const reason = interaction.options.getString('reason') || 'No reason specified';

      if (!target) {
        await interaction.reply({ content: 'Member not found.', ephemeral: true });
        return;
      }

      await target.kick(reason);
      logEvent(guildIdValue, {
        type: 'kick',
        userId: target.id,
        username: target.user.tag,
        moderatorId: interaction.user.id,
        reason
      });

      await sendLogMessage(guild, 'Kick', [
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason }
      ]);

      await interaction.reply(`✅ ${target.user.tag} was kicked. Reason: ${reason}`);
      return;
    }

    if (interaction.commandName === 'ban') {
      const targetUser = interaction.options.getUser('target', true);
      const reason = interaction.options.getString('reason') || 'No reason specified';

      await guild.members.ban(targetUser.id, { reason });
      logEvent(guildIdValue, {
        type: 'ban',
        userId: targetUser.id,
        username: targetUser.tag,
        moderatorId: interaction.user.id,
        reason
      });

      await sendLogMessage(guild, 'Ban', [
        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason }
      ]);

      await interaction.reply(`⛔ ${targetUser.tag} banned. Reason: ${reason}`);
      return;
    }

    if (interaction.commandName === 'warn') {
      const targetUser = interaction.options.getUser('target', true);
      const reason = interaction.options.getString('reason', true);
      const key = `warnings-${guildIdValue}`;
      const warnings = readJson(key, []);

      warnings.push({
        userId: targetUser.id,
        username: targetUser.tag,
        reason,
        moderatorId: interaction.user.id,
        createdAt: new Date().toISOString()
      });
      writeJson(key, warnings);
      logEvent(guildIdValue, {
        type: 'warn',
        userId: targetUser.id,
        username: targetUser.tag,
        moderatorId: interaction.user.id,
        reason
      });

      await interaction.reply(`⚠️ Warning added to ${targetUser.tag}: ${reason}`);
      return;
    }

    if (interaction.commandName === 'warnings') {
      const targetUser = interaction.options.getUser('target', true);
      const warnings = readJson(`warnings-${guildIdValue}`, []).filter((row) => row.userId === targetUser.id);

      if (!warnings.length) {
        await interaction.reply(`No warnings for ${targetUser.tag}`);
        return;
      }

      const text = warnings
        .slice(-10)
        .map((row, idx) => `${idx + 1}. [${row.createdAt}] ${row.reason} (mod: <@${row.moderatorId}>)`)
        .join('\n');
      await interaction.reply(`Warnings for ${targetUser.tag}:\n${text}`);
      return;
    }

    if (interaction.commandName === 'purge') {
      const count = interaction.options.getInteger('count', true);
      const deleted = await interaction.channel.bulkDelete(count, true);

      logEvent(guildIdValue, {
        type: 'purge',
        moderatorId: interaction.user.id,
        count: deleted.size
      });

      await interaction.reply({ content: `🧹 Purged ${deleted.size} messages.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'rank') {
      const rank = getRank(guildIdValue, interaction.user.id);
      await interaction.reply(
        `🏅 ${interaction.user.tag}: level **${rank.level}**, xp **${rank.xp}**, rank **${rank.rank ?? '-'} / ${rank.totalRanked}**`
      );
      return;
    }

    if (interaction.commandName === 'leveltop') {
      const limit = interaction.options.getInteger('limit') || 10;
      const top = getTop(guildIdValue, limit);
      if (!top.length) {
        await interaction.reply('Leaderboard is empty yet.');
        return;
      }

      const text = top.map((row) => `${row.rank}. <@${row.userId}> — lvl ${row.level}, xp ${row.xp}`).join('\n');
      await interaction.reply(`🏆 Level Top:\n${text}`);
      return;
    }

    if (interaction.commandName === 'userinfo') {
      const target = interaction.options.getMember('target') || interaction.member;
      const embed = new EmbedBuilder()
        .setTitle(`User info: ${target.user.tag}`)
        .addFields(
          { name: 'ID', value: target.id },
          { name: 'Joined server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>` },
          { name: 'Created account', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:F>` },
          { name: 'Roles', value: `${target.roles.cache.size - 1}` }
        )
        .setThumbnail(target.user.displayAvatarURL())
        .setColor(0x5865f2);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'safe' || interaction.commandName === 'warehouse') {
      const section = interaction.commandName;
      const sub = interaction.options.getSubcommand();
      const key = `${section}-${guildIdValue}`;
      const existing = readJson(key, []);

      if (sub === 'add') {
        const name = interaction.options.getString('name', true);
        const amount = interaction.options.getInteger('amount', true);
        existing.push({ name, amount, updatedAt: new Date().toISOString(), by: interaction.user.tag });
        writeJson(key, existing);
        await interaction.reply(`Added: **${name}** x${amount} to ${section}.`);
        return;
      }

      if (!existing.length) {
        await interaction.reply(`${section} is empty.`);
        return;
      }

      const text = existing
        .slice(-15)
        .map((item, i) => `${i + 1}. ${item.name} — ${item.amount} (by ${item.by})`)
        .join('\n');

      await interaction.reply(`**${section.toUpperCase()}**\n${text}`);
      return;
    }

    if (interaction.commandName === 'archive') {
      const sub = interaction.options.getSubcommand();
      const key = `archive-${guildIdValue}`;
      const entries = readJson(key, []);

      if (sub === 'save') {
        const text = interaction.options.getString('text', true);
        entries.push({ text, by: interaction.user.tag, createdAt: new Date().toISOString() });
        writeJson(key, entries);
        await interaction.reply('Archive entry saved.');
        return;
      }

      if (!entries.length) {
        await interaction.reply('Archive is empty.');
        return;
      }

      const list = entries
        .slice(-10)
        .map((entry, i) => `${i + 1}. [${entry.createdAt}] ${entry.by}: ${entry.text}`)
        .join('\n');

      await interaction.reply(`**Archive (latest 10)**\n${list}`);
      return;
    }

    if (interaction.commandName === 'config') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'welcome') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        const patch = { welcomeEnabled: enabled };
        if (channel) patch.welcomeChannelId = channel.id;
        if (message) patch.welcomeMessage = message;

        const cfg = setGuildConfig(guildIdValue, patch);
        await interaction.reply(
          `Welcome config saved: enabled=${cfg.welcomeEnabled}, channel=${cfg.welcomeChannelId ?? 'none'}`
        );
        return;
      }

      if (sub === 'logchannel') {
        const channel = interaction.options.getChannel('channel', true);
        const cfg = setGuildConfig(guildIdValue, { logChannelId: channel.id });
        await interaction.reply(`Log channel set to <#${cfg.logChannelId}>`);
        return;
      }

      if (sub === 'autorole') {
        const role = interaction.options.getRole('role', true);
        const cfg = setGuildConfig(guildIdValue, { autoRoleId: role.id });
        await interaction.reply(`Autorole set to <@&${cfg.autoRoleId}>`);
        return;
      }

      if (sub === 'suggestions') {
        const channel = interaction.options.getChannel('channel', true);
        const cfg = setGuildConfig(guildIdValue, { suggestionsChannelId: channel.id });
        await interaction.reply(`Suggestions channel set to <#${cfg.suggestionsChannelId}>`);
        return;
      }
    }

    if (interaction.commandName === 'reactionrole') {
      const emoji = interaction.options.getString('emoji', true);
      const role = interaction.options.getRole('role', true);
      upsertReactionRole(guildIdValue, emoji, role.id);
      await interaction.reply(`Reaction-role configured: ${emoji} => ${role}`);
      return;
    }

    if (interaction.commandName === 'automod') {
      const sub = interaction.options.getSubcommand();
      const cfg = getGuildConfig(guildIdValue);

      if (sub === 'links') {
        const enabled = interaction.options.getBoolean('enabled', true);
        setGuildConfig(guildIdValue, { automod: { ...cfg.automod, linksBlocked: enabled } });
        await interaction.reply(`AutoMod links blocking: ${enabled ? 'enabled' : 'disabled'}`);
        return;
      }

      if (sub === 'word_add') {
        const word = interaction.options.getString('word', true).trim().toLowerCase();
        const words = [...new Set([...cfg.automod.blockedWords, word])];
        setGuildConfig(guildIdValue, { automod: { ...cfg.automod, blockedWords: words } });
        await interaction.reply(`Blocked word added: ${word}`);
        return;
      }

      if (sub === 'word_remove') {
        const word = interaction.options.getString('word', true).trim().toLowerCase();
        const words = cfg.automod.blockedWords.filter((item) => item !== word);
        setGuildConfig(guildIdValue, { automod: { ...cfg.automod, blockedWords: words } });
        await interaction.reply(`Blocked word removed: ${word}`);
        return;
      }

      if (sub === 'word_list') {
        await interaction.reply(
          cfg.automod.blockedWords.length
            ? `Blocked words:\n${cfg.automod.blockedWords.map((w, i) => `${i + 1}. ${w}`).join('\n')}`
            : 'Blocked words list is empty.'
        );
      }
      return;
    }

    if (interaction.commandName === 'commands_ua') {
      await interaction.reply(
        '🇺🇦 Доступні модулі: модерація, automod, рівні, reaction roles, welcome/autorole, архів, сейф/склад, веб-панель.\n' +
          'Сумісні команди ProBot/CarlBot також додані (частина як каркас). Для команд-каркасів бот відповість статусом впровадження.'
      );
      return;
    }

    if (!implementedCommands.has(interaction.commandName)) {
      await interaction.reply({
        content:
          `Команда /${interaction.commandName} додана для сумісності з ProBot/CarlBot, але повна бізнес-логіка ще в процесі впровадження.`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === 'analytics') {
      const events = readJson(`events-${guildIdValue}`, []);
      const analytics = buildGuildAnalytics(guild, events);

      const embed = new EmbedBuilder()
        .setTitle('Server analytics (24h)')
        .addFields(
          { name: 'Members', value: String(analytics.members), inline: true },
          { name: 'Channels', value: String(analytics.channels), inline: true },
          { name: 'Roles', value: String(analytics.roles), inline: true },
          { name: 'Joins', value: String(analytics.joins), inline: true },
          { name: 'Leaves', value: String(analytics.leaves), inline: true },
          { name: 'Deleted messages', value: String(analytics.messageDeletes), inline: true },
          { name: 'Warnings', value: String(analytics.warnings), inline: true },
          { name: 'Kicks', value: String(analytics.kicks), inline: true },
          { name: 'Bans', value: String(analytics.bans), inline: true },
          { name: 'Purges', value: String(analytics.purges), inline: true },
          { name: 'AutoMod(link)', value: String(analytics.automodLinkDeletes), inline: true },
          { name: 'AutoMod(word)', value: String(analytics.automodWordDeletes), inline: true }
        )
        .setFooter({ text: `Updated: ${analytics.generatedAt}` })
        .setColor(0x2b2d31);

      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('[interaction-error]', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Помилка виконання команди. Перевірте логи бота.', ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: 'Помилка виконання команди. Перевірте логи бота.', ephemeral: true }).catch(() => null);
    }
  }
});

client.on('guildBanAdd', async (ban) => {
  const executor = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
  const entry = executor.entries.first();
  logEvent(ban.guild.id, {
    type: 'ban',
    userId: ban.user.id,
    username: ban.user.tag,
    moderatorId: entry?.executor?.id ?? 'unknown',
    reason: entry?.reason || 'No reason'
  });
});

client.login(token);
