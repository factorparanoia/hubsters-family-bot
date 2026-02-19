const { appendJsonArray, readJson, writeJson } = require('./store');

function userStatsKey(guildId) {
  return `user-stats-${guildId}`;
}

function voiceSessionsKey(guildId) {
  return `voice-sessions-${guildId}`;
}

function channelStatsKey(guildId) {
  return `channel-stats-${guildId}`;
}

function ensureUser(stats, userId) {
  if (!stats[userId]) {
    stats[userId] = {
      messages: 0,
      commands: 0,
      attachments: 0,
      lastMessageAt: null,
      lastCommandAt: null,
      voiceSeconds: 0,
      voiceJoins: 0,
      channels: {}
    };
  }
  return stats[userId];
}

function trackMessage(guildId, message) {
  const userStats = readJson(userStatsKey(guildId), {});
  const channelStats = readJson(channelStatsKey(guildId), {});

  const user = ensureUser(userStats, message.author.id);
  user.messages += 1;
  user.lastMessageAt = new Date().toISOString();
  user.attachments += message.attachments?.size || 0;
  user.channels[message.channel.id] = (user.channels[message.channel.id] || 0) + 1;

  if (!channelStats[message.channel.id]) {
    channelStats[message.channel.id] = { messages: 0, users: {} };
  }
  channelStats[message.channel.id].messages += 1;
  channelStats[message.channel.id].users[message.author.id] =
    (channelStats[message.channel.id].users[message.author.id] || 0) + 1;

  writeJson(userStatsKey(guildId), userStats);
  writeJson(channelStatsKey(guildId), channelStats);

  appendJsonArray(`messages-${guildId}`, {
    userId: message.author.id,
    channelId: message.channel.id,
    content: (message.content || '').slice(0, 300),
    createdAt: Date.now()
  });
}

function trackCommand(guildId, userId, commandName) {
  const userStats = readJson(userStatsKey(guildId), {});
  const user = ensureUser(userStats, userId);
  user.commands += 1;
  user.lastCommandAt = new Date().toISOString();
  writeJson(userStatsKey(guildId), userStats);

  appendJsonArray(`commands-${guildId}`, {
    userId,
    commandName,
    createdAt: Date.now()
  });
}

function trackVoiceJoin(guildId, userId, channelId) {
  const sessions = readJson(voiceSessionsKey(guildId), {});
  sessions[userId] = { joinedAt: Date.now(), channelId };
  writeJson(voiceSessionsKey(guildId), sessions);

  const userStats = readJson(userStatsKey(guildId), {});
  const user = ensureUser(userStats, userId);
  user.voiceJoins += 1;
  writeJson(userStatsKey(guildId), userStats);
}

function trackVoiceLeave(guildId, userId) {
  const sessions = readJson(voiceSessionsKey(guildId), {});
  const session = sessions[userId];
  if (!session) return;

  const delta = Math.max(0, Math.floor((Date.now() - session.joinedAt) / 1000));
  delete sessions[userId];
  writeJson(voiceSessionsKey(guildId), sessions);

  const userStats = readJson(userStatsKey(guildId), {});
  const user = ensureUser(userStats, userId);
  user.voiceSeconds += delta;
  writeJson(userStatsKey(guildId), userStats);
}

function getUserActivity(guildId, userId) {
  const userStats = readJson(userStatsKey(guildId), {});
  return userStats[userId] || null;
}

function getChannelActivity(guildId, channelId) {
  const channelStats = readJson(channelStatsKey(guildId), {});
  return channelStats[channelId] || null;
}

module.exports = {
  trackMessage,
  trackCommand,
  trackVoiceJoin,
  trackVoiceLeave,
  getUserActivity,
  getChannelActivity
};
