const { readJson, writeJson } = require('./store');

function defaultGuildConfig() {
  return {
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: 'Добро пожаловать, {user}, на сервер {server}!',
    logChannelId: null,
    reactionRoles: [],
    autoRoleId: null,
    suggestionsChannelId: null,
    automod: {
      linksBlocked: false,
      blockedWords: []
    },
    leveling: {
      enabled: true,
      levelUpChannelId: null
    }
  };
}

function getGuildConfig(guildId) {
  const base = defaultGuildConfig();
  const loaded = readJson(`config-${guildId}`, base);
  return {
    ...base,
    ...loaded,
    automod: {
      ...base.automod,
      ...(loaded.automod || {})
    },
    leveling: {
      ...base.leveling,
      ...(loaded.leveling || {})
    }
  };
}

function setGuildConfig(guildId, patch) {
  const current = getGuildConfig(guildId);
  const next = {
    ...current,
    ...patch,
    automod: {
      ...current.automod,
      ...(patch.automod || {})
    },
    leveling: {
      ...current.leveling,
      ...(patch.leveling || {})
    }
  };
  writeJson(`config-${guildId}`, next);
  return next;
}

function upsertReactionRole(guildId, emoji, roleId) {
  const config = getGuildConfig(guildId);
  const existing = config.reactionRoles.filter((item) => item.emoji !== emoji);
  existing.push({ emoji, roleId });
  return setGuildConfig(guildId, { reactionRoles: existing });
}

module.exports = {
  defaultGuildConfig,
  getGuildConfig,
  setGuildConfig,
  upsertReactionRole
};
