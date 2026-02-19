const { readJson, writeJson } = require('./store');

function levelFromXp(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

function key(guildId) {
  return `levels-${guildId}`;
}

function getLevels(guildId) {
  return readJson(key(guildId), {});
}

function addXp(guildId, userId, amount) {
  const levels = getLevels(guildId);
  const current = levels[userId] || { xp: 0, level: 0, lastGainAt: 0 };
  const nextXp = current.xp + amount;
  const nextLevel = levelFromXp(nextXp);
  const leveledUp = nextLevel > current.level;

  levels[userId] = {
    xp: nextXp,
    level: nextLevel,
    lastGainAt: Date.now()
  };

  writeJson(key(guildId), levels);
  return { ...levels[userId], leveledUp };
}

function getRank(guildId, userId) {
  const levels = getLevels(guildId);
  const sorted = Object.entries(levels).sort((a, b) => b[1].xp - a[1].xp);
  const index = sorted.findIndex(([id]) => id === userId);
  const user = levels[userId] || { xp: 0, level: 0 };

  return {
    xp: user.xp,
    level: user.level,
    rank: index >= 0 ? index + 1 : null,
    totalRanked: sorted.length
  };
}

function getTop(guildId, limit = 10) {
  const levels = getLevels(guildId);
  return Object.entries(levels)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, limit)
    .map(([userId, data], idx) => ({
      rank: idx + 1,
      userId,
      xp: data.xp,
      level: data.level
    }));
}

module.exports = {
  addXp,
  getRank,
  getTop,
  levelFromXp
};
