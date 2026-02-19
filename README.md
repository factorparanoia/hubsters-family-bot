# Discord Management Bot (Railway) + Web Panel

Если у вас "не появляется список команд" — в этой версии это исправлено:
- бот автоматически синхронизирует slash-команды при старте (`AUTO_SYNC_COMMANDS=true`)
- если указан `DISCORD_GUILD_ID`, команды регистрируются как **guild commands** (появляются почти сразу)
- если `DISCORD_GUILD_ID` не указан, регистрируются **global commands** (могут появляться до ~1 часа)

## Функции
- модерация: `/kick`, `/ban`, `/warn`, `/warnings`, `/purge`
- automod: `/automod links`, `word_add`, `word_remove`, `word_list`
- leveling: `/rank`, `/leveltop`
- community: welcome, autorole, suggestions, reaction roles
- учет/архив: `/safe`, `/warehouse`, `/archive`
- аналитика: `/analytics`
- web panel: конфиг, логи, leaderboard

## Быстрый старт

```bash
npm install
cp .env.example .env
npm run register   # опционально, можно не вызывать, если AUTO_SYNC_COMMANDS=true
npm start
```

## Обязательные env
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

## Рекомендуемые env
- `DISCORD_GUILD_ID` — чтобы команды появились сразу в тестовом сервере
- `AUTO_SYNC_COMMANDS=true`
- `WEB_PORT` (локально) / `PORT` (Railway)
- `DASHBOARD_TOKEN`

## Railway-ready
- `railway.json`
- `nixpacks.toml`
- `Procfile`

## Диагностика, если команды не появились
1. Проверьте, что бот приглашен с scope: `bot applications.commands`.
2. Проверьте права бота и наличие `DISCORD_CLIENT_ID`.
3. Проверьте логи старта — должно быть сообщение `[commands] synced ...`.
4. Для мгновенного результата укажите `DISCORD_GUILD_ID`.
