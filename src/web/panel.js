const express = require('express');
const { readJson } = require('../lib/store');
const { getGuildConfig, setGuildConfig } = require('../lib/config');
const { getTop } = require('../lib/levels');

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; background:#0f172a; color:#e2e8f0; }
      .card { background:#1e293b; border-radius:12px; padding:1rem; margin-bottom:1rem; }
      input, select, textarea, button { width:100%; padding:0.6rem; margin-top:0.4rem; margin-bottom:0.6rem; border-radius:8px; border:1px solid #475569; background:#0b1220; color:#e2e8f0; }
      button { cursor:pointer; background:#2563eb; border:0; }
      a { color:#93c5fd; }
      code { background:#0b1220; padding:0.2rem 0.4rem; border-radius:6px; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function guard(req, res, next) {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) {
    next();
    return;
  }

  if (req.query.token === token || req.headers['x-dashboard-token'] === token) {
    next();
    return;
  }

  res.status(401).send('Unauthorized. Pass ?token=... or x-dashboard-token header');
}

function selected(value, current) {
  return value === current ? 'selected' : '';
}

function startWebPanel(client) {
  if (global.__BOT_PANEL_STARTED__) return;
  global.__BOT_PANEL_STARTED__ = true;

  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(guard);

  app.get('/', (req, res) => {
    const guilds = [...client.guilds.cache.values()]
      .map((guild) => `<li><a href="/guild/${guild.id}?token=${req.query.token || ''}">${guild.name}</a> (${guild.id})</li>`)
      .join('');

    res.send(
      layout(
        'Discord Bot Panel',
        `<h1>Discord Bot Panel</h1>
         <div class="card"><p>Guilds:</p><ul>${guilds || '<li>No guilds yet</li>'}</ul></div>
         <div class="card"><a href="/health?token=${req.query.token || ''}">Health endpoint</a></div>`
      )
    );
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, guilds: client.guilds.cache.size, bot: client.user?.tag ?? null });
  });

  app.get('/guild/:guildId', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      res.status(404).send('Guild not found');
      return;
    }

    const config = getGuildConfig(guild.id);
    const channels = [...guild.channels.cache.values()]
      .filter((channel) => channel.isTextBased())
      .map((channel) => `<option value="${channel.id}">#${channel.name}</option>`)
      .join('');
    const roles = [...guild.roles.cache.values()]
      .filter((role) => role.name !== '@everyone')
      .map((role) => `<option value="${role.id}">@${role.name}</option>`)
      .join('');

    const events = readJson(`events-${guild.id}`, []).slice(-25).reverse();
    const logs = events
      .map((event) => `<li><code>${new Date(event.timestamp).toISOString()}</code> ${event.type} ${JSON.stringify(event)}</li>`)
      .join('');

    const top = getTop(guild.id, 10)
      .map((item) => `<li>#${item.rank} <@${item.userId}> — lvl ${item.level}, xp ${item.xp}</li>`)
      .join('');

    res.send(
      layout(
        `Guild ${guild.name}`,
        `<h1>${guild.name}</h1>
         <div class="card">
           <h2>Config</h2>
           <form method="post" action="/guild/${guild.id}/config?token=${req.query.token || ''}">
             <label>Welcome enabled</label>
             <select name="welcomeEnabled">
               <option value="true" ${config.welcomeEnabled ? 'selected' : ''}>true</option>
               <option value="false" ${!config.welcomeEnabled ? 'selected' : ''}>false</option>
             </select>
             <label>Welcome channel</label>
             <select name="welcomeChannelId"><option value="">(none)</option>${channels}</select>
             <label>Log channel</label>
             <select name="logChannelId"><option value="">(none)</option>${channels}</select>
             <label>Suggestions channel</label>
             <select name="suggestionsChannelId"><option value="">(none)</option>${channels}</select>
             <label>Autorole</label>
             <select name="autoRoleId"><option value="">(none)</option>${roles}</select>
             <label>Welcome message</label>
             <textarea name="welcomeMessage">${config.welcomeMessage}</textarea>
             <label>Block links</label>
             <select name="linksBlocked">
               <option value="true" ${config.automod.linksBlocked ? 'selected' : ''}>true</option>
               <option value="false" ${!config.automod.linksBlocked ? 'selected' : ''}>false</option>
             </select>
             <label>Blocked words (comma separated)</label>
             <textarea name="blockedWords">${config.automod.blockedWords.join(', ')}</textarea>
             <button type="submit">Save config</button>
           </form>
         </div>
         <div class="card"><h2>Level Top</h2><ol>${top || '<li>No data yet</li>'}</ol></div>
         <div class="card"><h2>Recent logs</h2><ul>${logs || '<li>No logs yet</li>'}</ul></div>
         <div class="card"><a href="/?token=${req.query.token || ''}">Back</a></div>`
      )
    );
  });

  app.post('/guild/:guildId/config', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      res.status(404).send('Guild not found');
      return;
    }

    setGuildConfig(guild.id, {
      welcomeEnabled: req.body.welcomeEnabled === 'true',
      welcomeChannelId: req.body.welcomeChannelId || null,
      logChannelId: req.body.logChannelId || null,
      suggestionsChannelId: req.body.suggestionsChannelId || null,
      autoRoleId: req.body.autoRoleId || null,
      welcomeMessage: req.body.welcomeMessage || 'Добро пожаловать, {user}, на сервер {server}!',
      automod: {
        linksBlocked: req.body.linksBlocked === 'true',
        blockedWords: (req.body.blockedWords || '')
          .split(',')
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean)
      }
    });

    res.redirect(`/guild/${guild.id}?token=${req.query.token || ''}`);
  });

  app.get('/api/guild/:guildId/compare/probot', (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const config = getGuildConfig(guild.id);
    const snapshot = {
      moderation: true,
      automodLinks: config.automod.linksBlocked,
      automodWords: config.automod.blockedWords.length > 0,
      welcome: config.welcomeEnabled,
      autorole: Boolean(config.autoRoleId),
      suggestions: Boolean(config.suggestionsChannelId),
      leveling: config.leveling.enabled,
      dashboard: true,
      music: false,
      giveaways: false,
      tempVoice: false
    };

    res.json({
      bot: 'our-bot',
      compareWith: 'probot',
      snapshot,
      missingLikeProBot: Object.entries(snapshot)
        .filter(([, enabled]) => enabled === false)
        .map(([feature]) => feature)
    });
  });

  const port = Number(process.env.WEB_PORT || process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Web panel running on :${port}`);
  });
}

module.exports = { startWebPanel };
