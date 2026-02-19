# HUB Bot (UA) — повнофункціональна заміна ProBot/CarlBot

У цій версії додано повну бізнес-логіку модулів, щоб сервер міг працювати без ProBot/CarlBot.

## Реалізовано модулі
- Модерація: `kick`, `ban`, `unban`, `warn`, `warnings`, `clearwarns`, `mute`, `unmute`, `purge`, `lock`, `unlock`, `slowmode`
- Utility: `userinfo`, `serverinfo`, `avatar`, `roleinfo`, `channelinfo`, `poll`, `reminder`
- Community: `welcome`, `autorole`, `reactionrole`, `verify`, `suggest`, `report`, `ticket`
- AutoMod: блокування посилань і заборонених слів
- Економіка: `economy_balance`, `economy_daily`
- Рівні: `rank`, `leveltop`
- Giveaway: створення і reroll
- Backup: `backup_create`, `backup_load` (конфіг+снапшот)
- Trigger/Autoresponse: `trigger`, `autoresponse`
- Temp Voice: `tempvoice create/delete`
- Music queue (черга): `music_play`, `music_skip`, `music_stop`
- Аналітика і логи: `analytics`, `logstats`

## Railway
- Налаштуйте `.env` (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`)
- Запуск: `npm start`
- Команди синхронізуються автоматично при старті бота.
