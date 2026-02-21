require('dotenv').config();

const {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  PermissionFlagsBits: Perms
} = require('discord.js');
const { appendJsonArray, readJson, writeJson } = require('./lib/store');
const { buildGuildAnalytics } = require('./lib/analytics');
const { getGuildConfig, setGuildConfig, upsertReactionRole } = require('./lib/config');
const { addXp, getRank, getTop } = require('./lib/levels');
const { commandDefinitions } = require('./command-definitions');
const { startWebPanel } = require('./web/panel');
const music = require('./lib/music');
const {
  trackMessage,
  trackCommand,
  trackVoiceJoin,
  trackVoiceLeave,
  getUserActivity,
  getChannelActivity
} = require('./lib/activity');
const { nextTicketNumber, saveTicket, getTicketByChannel, closeTicket } = require('./lib/tickets');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token) throw new Error('DISCORD_TOKEN is not set in environment');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.User]
});

const runtime = { giveaways: new Map(), reminders: new Map() };

function logEvent(gid, payload) {
  appendJsonArray(`events-${gid}`, { ...payload, timestamp: Date.now() });
}

function getJson(name, fallback) {
  return readJson(name, fallback);
}

function setJson(name, value) {
  writeJson(name, value);
}

function hasLink(content) {
  return /(https?:\/\/|www\.)\S+/i.test(content);
}


async function countUserMentionsInChannel(channel, userId) {
  let before;
  let total = 0;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;

    for (const message of batch.values()) {
      if (message.mentions?.users?.has(userId)) {
        total += 1;
      }
    }

    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return total;
}



async function countAllMentionsInChannel(channel) {
  let before;
  const counters = new Map();

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;

    for (const message of batch.values()) {
      const users = message.mentions?.users;
      if (!users || users.size === 0) continue;

      for (const user of users.values()) {
        counters.set(user.id, (counters.get(user.id) || 0) + 1);
      }
    }

    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return counters;
}

async function syncSlashCommands(forceGuild = false) {
  if (!clientId) throw new Error('DISCORD_CLIENT_ID не задано');

  const rest = new REST({ version: '10' }).setToken(token);
  const body = commandDefinitions.map((c) => c.toJSON());

  if (guildId || forceGuild) {
    if (!guildId) throw new Error('DISCORD_GUILD_ID не задано для guild sync');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    return { scope: 'guild', count: body.length, guildId };
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  return { scope: 'global', count: body.length };
}

async function registerCommandsOnStartup() {
  if (process.env.AUTO_SYNC_COMMANDS === 'false') return;
  const result = await syncSlashCommands(false);
  if (result.scope === 'guild') {
    console.log(`[commands] synced ${result.count} guild commands to ${result.guildId}`);
  } else {
    console.log(`[commands] synced ${result.count} global commands`);
  }
}

async function sendLogMessage(guild, title, fields) {
  const config = getGuildConfig(guild.id);
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const embed = new EmbedBuilder().setTitle(title).addFields(fields).setColor(0x1f8b4c).setTimestamp();
  await channel.send({ embeds: [embed] });
}

function getEconomy(gid) {
  return getJson(`economy-${gid}`, {});
}

function setEconomy(gid, data) {
  setJson(`economy-${gid}`, data);
}

function getTriggers(gid) {
  return getJson(`triggers-${gid}`, {});
}

function setTriggers(gid, data) {
  setJson(`triggers-${gid}`, data);
}

client.once('clientReady', async () => {
  console.log(`Bot started as ${client.user.tag}`);
  await registerCommandsOnStartup().catch((e) => console.error('[commands] startup sync failed:', e));
  startWebPanel(client);
});

client.on('error', (error) => console.error('[client-error]', error));

client.on('guildMemberAdd', async (member) => {
  logEvent(member.guild.id, { type: 'member_join', userId: member.id, username: member.user.tag });
  const config = getGuildConfig(member.guild.id);
  if (config.autoRoleId) await member.roles.add(config.autoRoleId).catch(() => null);
  if (config.welcomeEnabled && config.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (channel?.type === ChannelType.GuildText) {
      const text = config.welcomeMessage.replaceAll('{user}', `<@${member.id}>`).replaceAll('{server}', member.guild.name);
      await channel.send(text);
    }
  }
});

client.on('guildMemberRemove', (member) => {
  logEvent(member.guild.id, { type: 'member_leave', userId: member.id, username: member.user?.tag ?? member.id });
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (!newState.guild || newState.member?.user?.bot) return;
  const gid = newState.guild.id;
  const uid = newState.id;

  if (!oldState.channelId && newState.channelId) {
    trackVoiceJoin(gid, uid, newState.channelId);
  }

  if (oldState.channelId && !newState.channelId) {
    trackVoiceLeave(gid, uid);
  }

  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    trackVoiceLeave(gid, uid);
    trackVoiceJoin(gid, uid, newState.channelId);
  }
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  const gid = message.guild.id;
  trackMessage(gid, message);
  const config = getGuildConfig(gid);
  const lower = message.content.toLowerCase();

  if (config.automod.linksBlocked && hasLink(message.content)) {
    await message.delete().catch(() => null);
    logEvent(gid, { type: 'automod_link_delete', userId: message.author.id, content: message.content.slice(0, 180) });
    return;
  }
  const blockedWord = config.automod.blockedWords.find((word) => lower.includes(word.toLowerCase()));
  if (blockedWord) {
    await message.delete().catch(() => null);
    logEvent(gid, { type: 'automod_word_delete', userId: message.author.id, word: blockedWord });
    return;
  }

  const triggers = getTriggers(gid);
  const triggerKey = Object.keys(triggers).find((k) => lower.includes(k.toLowerCase()));
  if (triggerKey) await message.reply(triggers[triggerKey]).catch(() => null);

  if (config.suggestionsChannelId && message.channel.id === config.suggestionsChannelId) {
    await message.react('✅').catch(() => null);
    await message.react('❌').catch(() => null);
    logEvent(gid, { type: 'suggestion', userId: message.author.id, content: message.content.slice(0, 250) });
  }

  if (config.leveling.enabled && message.content.length >= 3) {
    const status = addXp(gid, message.author.id, 10 + Math.floor(Math.random() * 16));
    if (status.leveledUp) {
      await message.channel.send(`🎉 <@${message.author.id}> підвищив рівень до **${status.level}**!`).catch(() => null);
      logEvent(gid, { type: 'level_up', userId: message.author.id, level: status.level });
    }
  }
});

client.on('messageDelete', (message) => {
  if (!message.guild || message.author?.bot) return;
  logEvent(message.guild.id, { type: 'message_delete', userId: message.author?.id, content: message.content?.slice(0, 180) || '' });
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;
  const bind = getGuildConfig(reaction.message.guild.id).reactionRoles.find((x) => x.emoji === reaction.emoji.name);
  if (!bind) return;
  const member = await reaction.message.guild.members.fetch(user.id);
  await member.roles.add(bind.roleId).catch(() => null);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;
  const bind = getGuildConfig(reaction.message.guild.id).reactionRoles.find((x) => x.emoji === reaction.emoji.name);
  if (!bind) return;
  const member = await reaction.message.guild.members.fetch(user.id);
  await member.roles.remove(bind.roleId).catch(() => null);
});

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;
  const guild = interaction.guild;
  const gid = guild.id;

  if (interaction.commandName === 'say') {
    const text = interaction.options.getString('text', true);
    await interaction.reply({ content: 'Надіслано.', ephemeral: true });
    await interaction.channel.send(text);
    return;
  }
  if (interaction.commandName === 'kick') {
    const target = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'Без причини';
    if (!target) return interaction.reply({ content: 'Користувача не знайдено.', ephemeral: true });
    await target.kick(reason);
    logEvent(gid, { type: 'kick', userId: target.id, moderatorId: interaction.user.id, reason });
    return interaction.reply(`✅ Вигнано ${target.user.tag}`);
  }
  if (interaction.commandName === 'ban') {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'Без причини';
    await guild.members.ban(target.id, { reason });
    logEvent(gid, { type: 'ban', userId: target.id, moderatorId: interaction.user.id, reason });
    return interaction.reply(`⛔ Забанено ${target.tag}`);
  }
  if (interaction.commandName === 'warn') {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason', true);
    const key = `warnings-${gid}`;
    const warnings = getJson(key, []);
    warnings.push({ userId: target.id, reason, moderatorId: interaction.user.id, createdAt: new Date().toISOString() });
    setJson(key, warnings);
    return interaction.reply(`⚠️ Попередження видано ${target.tag}`);
  }
  if (interaction.commandName === 'warnings') {
    const target = interaction.options.getUser('target', true);
    const warnings = getJson(`warnings-${gid}`, []).filter((x) => x.userId === target.id);
    if (!warnings.length) return interaction.reply('Попереджень немає.');
    return interaction.reply(warnings.map((x, i) => `${i + 1}. ${x.reason}`).join('\n'));
  }
  if (interaction.commandName === 'clearwarns') {
    const target = interaction.options.getUser('target', true);
    const list = getJson(`warnings-${gid}`, []).filter((x) => x.userId !== target.id);
    setJson(`warnings-${gid}`, list);
    return interaction.reply(`Попередження для ${target.tag} очищено.`);
  }
  if (interaction.commandName === 'purge') {
    const c = interaction.options.getInteger('count', true);
    const deleted = await interaction.channel.bulkDelete(c, true);
    return interaction.reply({ content: `🧹 Видалено ${deleted.size} повідомлень`, ephemeral: true });
  }
  if (interaction.commandName === 'rank') {
    const rank = getRank(gid, interaction.user.id);
    return interaction.reply(`🏅 Рівень: ${rank.level}, XP: ${rank.xp}, місце: ${rank.rank ?? '-'} / ${rank.totalRanked}`);
  }
  if (interaction.commandName === 'leveltop') {
    const top = getTop(gid, interaction.options.getInteger('limit') || 10);
    if (!top.length) return interaction.reply('Поки що порожньо.');
    return interaction.reply(top.map((x) => `${x.rank}. <@${x.userId}> — lvl ${x.level}, xp ${x.xp}`).join('\n'));
  }
  if (interaction.commandName === 'userinfo') {
    const m = interaction.options.getMember('target') || interaction.member;
    const stats = getUserActivity(gid, m.id);

    const questChannelId = process.env.QUEST_CHANNEL_ID;
    const eventChannelId = process.env.EVENT_CHANNEL_ID;

    await interaction.deferReply({ ephemeral: true });

    let questCountText = 'Канал квестів не налаштовано';
    let eventCountText = 'Канал івентів не налаштовано';

    if (questChannelId) {
      const questChannel = guild.channels.cache.get(questChannelId);
      if (questChannel?.isTextBased()) {
        const count = await countUserMentionsInChannel(questChannel, m.id);
        questCountText = `${count} (канал <#${questChannelId}>)`;
      } else {
        questCountText = 'Канал квестів не знайдено';
      }
    }

    if (eventChannelId) {
      const eventChannel = guild.channels.cache.get(eventChannelId);
      if (eventChannel?.isTextBased()) {
        const count = await countUserMentionsInChannel(eventChannel, m.id);
        eventCountText = `${count} (канал <#${eventChannelId}>)`;
      } else {
        eventCountText = 'Канал івентів не знайдено';
      }
    }

    const topChannels = stats
      ? Object.entries(stats.channels || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, c]) => `<#${id}>: ${c}`)
          .join('\n')
      : 'Немає даних';

    const embed = new EmbedBuilder()
      .setTitle(`Користувач: ${m.user.tag}`)
      .addFields(
        { name: 'ID', value: m.id, inline: true },
        { name: 'Створено акаунт', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:F>`, inline: false },
        { name: 'Приєднався до сервера', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:F>`, inline: false },
        { name: 'Ролей', value: String(m.roles.cache.size - 1), inline: true },
        { name: 'Повідомлень', value: String(stats?.messages || 0), inline: true },
        { name: 'Команд', value: String(stats?.commands || 0), inline: true },
        { name: 'Голос (сек)', value: String(stats?.voiceSeconds || 0), inline: true },
        { name: 'Заходів у voice', value: String(stats?.voiceJoins || 0), inline: true },
        { name: 'Вкладень', value: String(stats?.attachments || 0), inline: true },
        { name: 'Квести (згадки)', value: questCountText, inline: false },
        { name: 'Івенти (згадки)', value: eventCountText, inline: false },
        { name: 'Останнє повідомлення', value: stats?.lastMessageAt || '—', inline: false },
        { name: 'Топ активних каналів', value: topChannels || '—', inline: false }
      )
      .setThumbnail(m.user.displayAvatarURL({ size: 512 }))
      .setColor(0x5865f2);

    return interaction.editReply({ embeds: [embed] });
  }
  if (interaction.commandName === 'serverinfo') {
    const channels = guild.channels.cache;
    const textCount = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    return interaction.reply(
      `Сервер: **${guild.name}**\nID: **${guild.id}**\nУчасників: **${guild.memberCount}**\nКаналів: **${channels.size}** (text: ${textCount}, voice: ${voiceCount})\nРолей: **${guild.roles.cache.size}**`
    );
  }
  if (interaction.commandName === 'avatar') {
    const u = interaction.options.getUser('target') || interaction.user;
    return interaction.reply(u.displayAvatarURL({ size: 1024 }));
  }
  if (interaction.commandName === 'roleinfo') {
    const r = interaction.options.getRole('role', true);
    return interaction.reply(`Роль: ${r.name}\nID: ${r.id}\nКолір: ${r.hexColor}`);
  }
  if (interaction.commandName === 'channelinfo') {
    const c = interaction.options.getChannel('channel', true);
    const stats = getChannelActivity(gid, c.id);
    const topUsers = stats
      ? Object.entries(stats.users || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id, count]) => `<@${id}>: ${count}`)
          .join('\n')
      : 'Немає даних';

    return interaction.reply(
      `Канал: **${c.name}**\nID: **${c.id}**\nТип: **${c.type}**\nПовідомлень: **${stats?.messages || 0}**\nНайактивніші користувачі:\n${topUsers}`
    );
  }
  if (interaction.commandName === 'lock') {
    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    return interaction.reply('🔒 Канал закрито.');
  }
  if (interaction.commandName === 'unlock') {
    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
    return interaction.reply('🔓 Канал відкрито.');
  }
  if (interaction.commandName === 'slowmode') {
    const s = interaction.options.getInteger('seconds', true);
    await interaction.channel.setRateLimitPerUser(Math.max(0, Math.min(21600, s)));
    return interaction.reply(`🐢 Slowmode: ${s} сек.`);
  }
  if (interaction.commandName === 'mute') {
    const m = interaction.options.getMember('target');
    const min = interaction.options.getInteger('minutes', true);
    if (!m) return interaction.reply({ content: 'Користувача не знайдено.', ephemeral: true });
    await m.timeout(min * 60 * 1000, interaction.options.getString('reason') || 'Таймаут');
    return interaction.reply(`🔇 Таймаут для ${m.user.tag} на ${min} хв.`);
  }
  if (interaction.commandName === 'unmute') {
    const m = interaction.options.getMember('target');
    if (!m) return interaction.reply({ content: 'Користувача не знайдено.', ephemeral: true });
    await m.timeout(null);
    return interaction.reply(`🔊 Таймаут знято з ${m.user.tag}`);
  }
  if (interaction.commandName === 'unban') {
    const uid = interaction.options.getString('userid', true);
    await guild.members.unban(uid);
    return interaction.reply(`✅ Розбанено ${uid}`);
  }
  if (interaction.commandName === 'poll') {
    const q = interaction.options.getString('question', true);
    const opts = interaction.options.getString('options', true).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 9);
    if (opts.length < 2) return interaction.reply({ content: 'Мінімум 2 варіанти.', ephemeral: true });
    const nums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
    const embed = new EmbedBuilder().setTitle('Опитування').setDescription(`${q}\n\n${opts.map((o,i)=>`${nums[i]} ${o}`).join('\n')}`);
    const msg = await interaction.channel.send({ embeds: [embed] });
    for (let i=0;i<opts.length;i++) await msg.react(nums[i]);
    return interaction.reply({ content: 'Опитування створено.', ephemeral: true });
  }
  if (interaction.commandName === 'reminder') {
    const min = interaction.options.getInteger('minutes', true);
    const text = interaction.options.getString('text', true);
    const key = `${gid}-${interaction.user.id}-${Date.now()}`;
    const timer = setTimeout(async () => {
      await interaction.channel.send(`⏰ <@${interaction.user.id}> нагадування: ${text}`).catch(() => null);
      runtime.reminders.delete(key);
    }, min * 60 * 1000);
    runtime.reminders.set(key, timer);
    return interaction.reply({ content: `Нагадування встановлено через ${min} хв.`, ephemeral: true });
  }
  if (interaction.commandName === 'ticket') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const ch = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [Perms.ViewChannel] },
          { id: interaction.user.id, allow: [Perms.ViewChannel, Perms.SendMessages] }
        ]
      });
      return interaction.reply({ content: `Тікет створено: ${ch}`, ephemeral: true });
    }
    if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: 'Це не тікет-канал.', ephemeral: true });
    await interaction.reply('Тікет буде закрито через 3 секунди...');
    setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
    return;
  }
  if (interaction.commandName === 'giveaway') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const minutes = interaction.options.getInteger('minutes', true);
      const prize = interaction.options.getString('prize', true);
      const winnersCount = interaction.options.getInteger('winners') || 1;
      const msg = await interaction.channel.send(`🎉 Розіграш: **${prize}**\nТисни 🎉 для участі!\nЗавершення через ${minutes} хв.`);
      await msg.react('🎉');
      const key = `${gid}-${msg.id}`;
      const timer = setTimeout(async () => {
        const fresh = await interaction.channel.messages.fetch(msg.id).catch(() => null);
        const users = fresh ? (await fresh.reactions.cache.get('🎉')?.users.fetch()).filter((u) => !u.bot) : new Map();
        const arr = users ? [...users.values()] : [];
        const picks = arr.sort(() => Math.random() - 0.5).slice(0, winnersCount);
        await interaction.channel.send(
          picks.length ? `🏆 Переможці (${prize}): ${picks.map((u) => `<@${u.id}>`).join(', ')}` : 'Немає учасників для розіграшу.'
        );
        runtime.giveaways.delete(key);
      }, minutes * 60 * 1000);
      runtime.giveaways.set(key, { timer, prize, winnersCount, messageId: msg.id, channelId: interaction.channel.id });
      return interaction.reply({ content: 'Розіграш створено.', ephemeral: true });
    }
    const messageId = interaction.options.getString('messageid', true);
    const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return interaction.reply({ content: 'Повідомлення не знайдено.', ephemeral: true });
    const users = (await msg.reactions.cache.get('🎉')?.users.fetch())?.filter((u) => !u.bot);
    const arr = users ? [...users.values()] : [];
    const pick = arr.sort(() => Math.random() - 0.5)[0];
    return interaction.reply(pick ? `🎉 Новий переможець: <@${pick.id}>` : 'Немає учасників.');
  }
  if (interaction.commandName === 'backup_create') {
    const name = interaction.options.getString('name', true);
    const cfg = getGuildConfig(gid);
    const payload = {
      createdAt: new Date().toISOString(),
      guildId: gid,
      guildName: guild.name,
      config: cfg,
      roles: guild.roles.cache.map((r) => ({ id: r.id, name: r.name, color: r.color })),
      channels: guild.channels.cache.map((c) => ({ id: c.id, name: c.name, type: c.type }))
    };
    setJson(`backup-${gid}-${name}`, payload);
    return interaction.reply(`Бекап **${name}** створено.`);
  }
  if (interaction.commandName === 'backup_load') {
    const name = interaction.options.getString('name', true);
    const backup = getJson(`backup-${gid}-${name}`, null);
    if (!backup) return interaction.reply({ content: 'Бекап не знайдено.', ephemeral: true });
    setGuildConfig(gid, backup.config || {});
    return interaction.reply(`Бекап **${name}** застосовано (конфіг).`);
  }
  if (interaction.commandName === 'trigger') {
    const sub = interaction.options.getSubcommand();
    const triggers = getTriggers(gid);
    if (sub === 'add') {
      const key = interaction.options.getString('key', true);
      triggers[key] = interaction.options.getString('response', true);
      setTriggers(gid, triggers);
      return interaction.reply(`Тригер **${key}** додано.`);
    }
    if (sub === 'remove') {
      const key = interaction.options.getString('key', true);
      delete triggers[key];
      setTriggers(gid, triggers);
      return interaction.reply(`Тригер **${key}** видалено.`);
    }
    const keys = Object.keys(triggers);
    return interaction.reply(keys.length ? keys.join(', ') : 'Тригерів немає.');
  }
  if (interaction.commandName === 'autoresponse') {
    const key = interaction.options.getString('key', true);
    const resp = getTriggers(gid)[key];
    return interaction.reply(resp || 'Автовідповідь не знайдено.');
  }
  if (interaction.commandName === 'economy_balance') {
    const eco = getEconomy(gid);
    const me = eco[interaction.user.id] || { balance: 0, lastDaily: 0 };
    return interaction.reply(`💰 Ваш баланс: ${me.balance}`);
  }
  if (interaction.commandName === 'economy_daily') {
    const eco = getEconomy(gid);
    const now = Date.now();
    const me = eco[interaction.user.id] || { balance: 0, lastDaily: 0 };
    if (now - me.lastDaily < 24 * 60 * 60 * 1000) return interaction.reply({ content: 'Щоденну вже отримано.', ephemeral: true });
    me.balance += 100;
    me.lastDaily = now;
    eco[interaction.user.id] = me;
    setEconomy(gid, eco);
    return interaction.reply('🎁 Ви отримали 100 монет.');
  }
  if (interaction.commandName === 'music_play') {
    const q = interaction.options.getString('query', true);
    const me = await guild.members.fetch(interaction.user.id);

    if (!me.voice?.channelId) {
      return interaction.reply({ content: 'Спочатку зайдіть у голосовий канал.', ephemeral: true });
    }

    try {
      const result = await music.enqueue(me, q, interaction.channel.id);
      return interaction.reply(`🎵 Додано: **${result.title}**`);
    } catch (error) {
      return interaction.reply({ content: `Не вдалося запустити музику: ${error.message}`, ephemeral: true });
    }
  }
  if (interaction.commandName === 'music_skip') {
    const ok = music.skip(gid);
    return interaction.reply(ok ? '⏭ Трек пропущено.' : 'Немає активного відтворення.');
  }
  if (interaction.commandName === 'music_stop') {
    const ok = music.stop(gid);
    return interaction.reply(ok ? '⏹ Відтворення зупинено, чергу очищено.' : 'Немає активного відтворення.');
  }
  if (interaction.commandName === 'tempvoice') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const ch = await guild.channels.create({ name: `voice-${interaction.user.username}`, type: ChannelType.GuildVoice });
      return interaction.reply({ content: `Створено: ${ch.name}`, ephemeral: true });
    }
    if (interaction.channel.type !== ChannelType.GuildVoice) return interaction.reply({ content: 'Команда працює в голосовому каналі.', ephemeral: true });
    await interaction.channel.delete().catch(() => null);
    return;
  }
  if (interaction.commandName === 'suggest') {
    const text = interaction.options.getString('text', true);
    const cfg = getGuildConfig(gid);
    const ch = (cfg.suggestionsChannelId && guild.channels.cache.get(cfg.suggestionsChannelId)) || interaction.channel;
    const msg = await ch.send(`💡 Пропозиція від <@${interaction.user.id}>:\n${text}`);
    await msg.react('✅').catch(() => null);
    await msg.react('❌').catch(() => null);
    return interaction.reply({ content: 'Пропозицію надіслано.', ephemeral: true });
  }
  if (interaction.commandName === 'report') {
    const target = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason', true);
    await sendLogMessage(guild, 'Скарга', [
      { name: 'Від', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'На', value: `<@${target.id}>`, inline: true },
      { name: 'Причина', value: reason }
    ]);
    return interaction.reply({ content: 'Скаргу передано модерації.', ephemeral: true });
  }
  if (interaction.commandName === 'verify') {
    const member = interaction.options.getMember('target') || interaction.member;
    const cfg = getGuildConfig(gid);
    if (!cfg.autoRoleId) return interaction.reply({ content: 'AutoRole не налаштована.', ephemeral: true });
    await member.roles.add(cfg.autoRoleId).catch(() => null);
    return interaction.reply(`✅ Верифіковано ${member.user.tag}`);
  }
  if (interaction.commandName === 'autorole_list') {
    const cfg = getGuildConfig(gid);
    return interaction.reply(cfg.autoRoleId ? `Активна авто-роль: <@&${cfg.autoRoleId}>` : 'Авто-роль не налаштована.');
  }
  if (interaction.commandName === 'logstats') {
    const events = getJson(`events-${gid}`, []);
    const map = {};
    for (const e of events) map[e.type] = (map[e.type] || 0) + 1;
    const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return interaction.reply(rows.length ? rows.map(([k, v]) => `${k}: ${v}`).join('\n') : 'Логів поки немає.');
  }
  if (interaction.commandName === 'safe' || interaction.commandName === 'warehouse') {
    const section = interaction.commandName;
    const sub = interaction.options.getSubcommand();
    const key = `${section}-${gid}`;
    const existing = getJson(key, []);
    if (sub === 'add') {
      existing.push({
        name: interaction.options.getString('name', true),
        amount: interaction.options.getInteger('amount', true),
        by: interaction.user.tag,
        updatedAt: new Date().toISOString()
      });
      setJson(key, existing);
      return interaction.reply('Додано.');
    }
    return interaction.reply(existing.length ? existing.map((x, i) => `${i + 1}. ${x.name}: ${x.amount}`).join('\n') : 'Порожньо.');
  }
  if (interaction.commandName === 'archive') {
    const key = `archive-${gid}`;
    const data = getJson(key, []);
    if (interaction.options.getSubcommand() === 'save') {
      data.push({ text: interaction.options.getString('text', true), by: interaction.user.tag, createdAt: new Date().toISOString() });
      setJson(key, data);
      return interaction.reply('Архів збережено.');
    }
    return interaction.reply(data.length ? data.slice(-10).map((x, i) => `${i + 1}. ${x.text}`).join('\n') : 'Архів порожній.');
  }
  if (interaction.commandName === 'config') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'welcome') {
      const patch = { welcomeEnabled: interaction.options.getBoolean('enabled', true) };
      const ch = interaction.options.getChannel('channel');
      const msg = interaction.options.getString('message');
      if (ch) patch.welcomeChannelId = ch.id;
      if (msg) patch.welcomeMessage = msg;
      const cfg = setGuildConfig(gid, patch);
      return interaction.reply(`Welcome: ${cfg.welcomeEnabled}`);
    }
    if (sub === 'logchannel') {
      const cfg = setGuildConfig(gid, { logChannelId: interaction.options.getChannel('channel', true).id });
      return interaction.reply(`Log channel: <#${cfg.logChannelId}>`);
    }
    if (sub === 'autorole') {
      const cfg = setGuildConfig(gid, { autoRoleId: interaction.options.getRole('role', true).id });
      return interaction.reply(`AutoRole: <@&${cfg.autoRoleId}>`);
    }
    if (sub === 'suggestions') {
      const cfg = setGuildConfig(gid, { suggestionsChannelId: interaction.options.getChannel('channel', true).id });
      return interaction.reply(`Suggestions: <#${cfg.suggestionsChannelId}>`);
    }
  }
  if (interaction.commandName === 'reactionrole') {
    upsertReactionRole(gid, interaction.options.getString('emoji', true), interaction.options.getRole('role', true).id);
    return interaction.reply('Reaction role збережено.');
  }
  if (interaction.commandName === 'automod') {
    const sub = interaction.options.getSubcommand();
    const cfg = getGuildConfig(gid);
    if (sub === 'links') {
      setGuildConfig(gid, { automod: { ...cfg.automod, linksBlocked: interaction.options.getBoolean('enabled', true) } });
      return interaction.reply('Оновлено.');
    }
    if (sub === 'word_add') {
      const word = interaction.options.getString('word', true).toLowerCase();
      setGuildConfig(gid, { automod: { ...cfg.automod, blockedWords: [...new Set([...cfg.automod.blockedWords, word])] } });
      return interaction.reply('Слово додано.');
    }
    if (sub === 'word_remove') {
      const word = interaction.options.getString('word', true).toLowerCase();
      setGuildConfig(gid, { automod: { ...cfg.automod, blockedWords: cfg.automod.blockedWords.filter((x) => x !== word) } });
      return interaction.reply('Слово видалено.');
    }
    return interaction.reply(cfg.automod.blockedWords.join(', ') || 'Список порожній.');
  }
  if (interaction.commandName === 'ticket_panel') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('Відкрити').setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setTitle('Панель тікетів')
      .setDescription(
        'Натисніть кнопку **Відкрити**, щоб створити персональний тікет.\n\n' +
          '**Умови тікета:**\n- Один тікет на проблему.\n- Опишіть суть детально.\n- Дотримуйтесь правил сервера.'
      )
      .setColor(0x2b2d31);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: 'Панель тікетів опубликована.', ephemeral: true });
  }

  if (interaction.commandName === 'activity_user') {
    const user = interaction.options.getUser('target') || interaction.user;
    const stats = getUserActivity(gid, user.id);
    if (!stats) return interaction.reply('Дані активності відсутні.');
    return interaction.reply(
      `Активність <@${user.id}>\nПовідомлень: ${stats.messages}\nКоманд: ${stats.commands}\nВкладень: ${stats.attachments}\nVoice секунд: ${stats.voiceSeconds}\nVoice входів: ${stats.voiceJoins}\nОстаннє повідомлення: ${stats.lastMessageAt || '—'}`
    );
  }


  if (interaction.commandName === 'quest_count') {
    const target = interaction.options.getUser('target') || interaction.user;
    const questChannelId = process.env.QUEST_CHANNEL_ID;

    if (!questChannelId) {
      return interaction.reply({ content: 'Не задано QUEST_CHANNEL_ID у змінних середовища.', ephemeral: true });
    }

    const questChannel = guild.channels.cache.get(questChannelId);
    if (!questChannel || !questChannel.isTextBased()) {
      return interaction.reply({ content: 'Квест-канал не знайдено або він не текстовий.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const mentionsCount = await countUserMentionsInChannel(questChannel, target.id);
    return interaction.editReply(
      `У квест-каналі <#${questChannelId}> користувача <@${target.id}> згадали **${mentionsCount}** раз(ів).`
    );
  }



  if (interaction.commandName === 'quest_stats') {
    const questChannelId = process.env.QUEST_CHANNEL_ID;

    if (!questChannelId) {
      return interaction.reply({ content: 'Не задано QUEST_CHANNEL_ID у змінних середовища.', ephemeral: true });
    }

    const questChannel = guild.channels.cache.get(questChannelId);
    if (!questChannel || !questChannel.isTextBased()) {
      return interaction.reply({ content: 'Квест-канал не знайдено або він не текстовий.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const counters = await countAllMentionsInChannel(questChannel);
    if (counters.size === 0) {
      return interaction.editReply('У квест-каналі не знайдено згадок користувачів.');
    }

    const sorted = [...counters.entries()].sort((a, b) => b[1] - a[1]);
    const rows = sorted.map(([userId, count]) => `<@${userId}> — ${count}`).join('\n');

    const chunks = [];
    let current = '';
    for (const line of rows.split('\n')) {
      if ((current + line + '\n').length > 1800) {
        chunks.push(current);
        current = '';
      }
      current += `${line}\n`;
    }
    if (current) chunks.push(current);

    await interaction.editReply(`Квести (згадки) у каналі <#${questChannelId}>:
${chunks[0]}`);
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === 'event_count') {
    const target = interaction.options.getUser('target') || interaction.user;
    const eventChannelId = process.env.EVENT_CHANNEL_ID;

    if (!eventChannelId) {
      return interaction.reply({ content: 'Не задано EVENT_CHANNEL_ID у змінних середовища.', ephemeral: true });
    }

    const eventChannel = guild.channels.cache.get(eventChannelId);
    if (!eventChannel || !eventChannel.isTextBased()) {
      return interaction.reply({ content: 'Канал івентів не знайдено або він не текстовий.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const mentionsCount = await countUserMentionsInChannel(eventChannel, target.id);
    return interaction.editReply(
      `У каналі івентів <#${eventChannelId}> користувача <@${target.id}> згадали **${mentionsCount}** раз(ів).`
    );
  }

  if (interaction.commandName === 'activity_channel') {
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    const stats = getChannelActivity(gid, ch.id);
    if (!stats) return interaction.reply('По каналу ще немає статистики.');
    const users = Object.entries(stats.users || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, c]) => `<@${id}>: ${c}`)
      .join('\n');
    return interaction.reply(`Активність каналу ${ch}:\nПовідомлень: ${stats.messages}\nТоп користувачів:\n${users || '—'}`);
  }

  if (interaction.commandName === 'analytics') {
    const analytics = buildGuildAnalytics(guild, getJson(`events-${gid}`, []));
    return interaction.reply(`Учасники: ${analytics.members}\nJoins: ${analytics.joins}\nLeaves: ${analytics.leaves}\nWarn: ${analytics.warnings}`);
  }

  if (interaction.commandName === 'sync_commands') {
    const result = await syncSlashCommands(true);
    return interaction.reply({
      content: `✅ Синхронізовано ${result.count} команд у guild scope (${result.guildId}).`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'commands_ua') {
    return interaction.reply('Усі ключові модулі реалізовані: модерація, automod, тікети, розіграші, економіка, backup, trigger, tempvoice, verify, логи, аналітика, квести та івенти.');
  }

  return interaction.reply({ content: 'Команда не підтримується.', ephemeral: true });
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const guild = interaction.guild;
      if (!guild) return;

      if (interaction.customId === 'ticket_open') {
        const number = String(nextTicketNumber(guild.id)).padStart(4, '0');
        const channel = await guild.channels.create({
          name: `ticket-${number}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [Perms.ViewChannel] },
            { id: interaction.user.id, allow: [Perms.ViewChannel, Perms.SendMessages, Perms.ReadMessageHistory] },
            { id: guild.members.me.id, allow: [Perms.ViewChannel, Perms.SendMessages, Perms.ManageChannels, Perms.ReadMessageHistory] }
          ]
        });

        saveTicket(guild.id, {
          number,
          channelId: channel.id,
          creatorId: interaction.user.id,
          creatorTag: interaction.user.tag,
          createdAt: new Date().toISOString(),
          status: 'open'
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_close').setLabel('Закрити').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setTitle(`Тікет #${number}`)
          .setDescription(
            'Вітаємо! Це ваш приватний тікет.\n\n' +
              '**Умови:**\n- Опишіть проблему детально.\n- Не спамте.\n- Дотримуйтесь правил сервера.\n\n' +
              'Нижче є кнопка закриття тікета.'
          )
          .addFields(
            { name: 'Автор', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Номер', value: `#${number}`, inline: true }
          )
          .setColor(0x5865f2);

        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [closeRow] });
        await interaction.reply({ content: `Тікет створено: ${channel}`, ephemeral: true });
        return;
      }

      if (interaction.customId === 'ticket_close') {
        const ticket = getTicketByChannel(guild.id, interaction.channel.id);
        if (!ticket) {
          await interaction.reply({ content: 'Це не тікет-канал.', ephemeral: true });
          return;
        }

        const isOwner = ticket.creatorId === interaction.user.id;
        const hasMod = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        if (!isOwner && !hasMod) {
          await interaction.reply({ content: 'Закрити тікет може автор або модератор.', ephemeral: true });
          return;
        }

        closeTicket(guild.id, interaction.channel.id, interaction.user.id);
        await interaction.reply('Тікет закривається через 3 секунди...');
        setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
        return;
      }
      return;
    }

    if (interaction.isChatInputCommand() && interaction.guild) {
      trackCommand(interaction.guild.id, interaction.user.id, interaction.commandName);
    }

    await handleInteraction(interaction);
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
  const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
  const entry = logs.entries.first();
  logEvent(ban.guild.id, {
    type: 'ban',
    userId: ban.user.id,
    moderatorId: entry?.executor?.id ?? 'unknown',
    reason: entry?.reason || 'No reason'
  });
});

client.login(token);
