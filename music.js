function count(dayEvents, type) {
  return dayEvents.filter((event) => event.type === type).length;
}

function buildGuildAnalytics(guild, eventLog = []) {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  const dayEvents = eventLog.filter((event) => event.timestamp >= last24h);

  return {
    members: guild.memberCount,
    channels: guild.channels.cache.size,
    roles: guild.roles.cache.size,
    joins: count(dayEvents, 'member_join'),
    leaves: count(dayEvents, 'member_leave'),
    messageDeletes: count(dayEvents, 'message_delete'),
    warnings: count(dayEvents, 'warn'),
    kicks: count(dayEvents, 'kick'),
    bans: count(dayEvents, 'ban'),
    purges: count(dayEvents, 'purge'),
    automodLinkDeletes: count(dayEvents, 'automod_link_delete'),
    automodWordDeletes: count(dayEvents, 'automod_word_delete'),
    suggestions: count(dayEvents, 'suggestion'),
    levelUps: count(dayEvents, 'level_up'),
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = { buildGuildAnalytics };
