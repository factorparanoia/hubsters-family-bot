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
- **Music playback**: `music_play`, `music_skip`, `music_stop`
  - `music_play` приймає URL або пошуковий запит, бот приєднується в ваш voice-канал і відтворює звук
  - бот підключається з `selfDeaf: true` (не слухає людей у каналі)
- Аналітика і логи: `analytics`, `logstats`

## Якщо бот не підключається до voice
1. Переконайтесь, що бот має права **Connect** і **Speak** у voice-каналі.
2. Переконайтесь, що voice-канал не повний (або є право Move Members).
3. Запустіть `/music_play` тільки коли ви вже в голосовому каналі.
4. Подивіться відповідь бота: він тепер віддає точну причину помилки підключення.

## Railway
- Налаштуйте `.env` (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`)
- Запуск: `npm start`
- Команди синхронізуються автоматично при старті бота.
