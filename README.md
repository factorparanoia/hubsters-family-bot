# Discord Management Bot (Railway) + Web Panel

Расширенный модульный Discord-бот в стиле ProBot/Carl-bot (production-ready scaffold для Railway).

## Что добавлено по сравнению с прошлой версией

### ProBot-style функционал, который теперь есть
- Модерация: `/kick`, `/ban`, `/warn`, `/warnings`, `/purge`
- AutoMod:
  - блокировка ссылок (`/automod links`)
  - блокировка слов (`/automod word_add`, `word_remove`, `word_list`)
- Leveling / rank system:
  - начисление XP за сообщения
  - авто-level up уведомления
  - `/rank`, `/leveltop`
- Engagement:
  - suggestions-канал (`/config suggestions`) c ✅/❌ реакциями
- Community setup:
  - welcome messages (`/config welcome`)
  - auto-role (`/config autorole`)
  - reaction roles (`/reactionrole`)
- Веб-панель:
  - настройка guild config
  - просмотр логов
  - leaderboard
  - API сравнения с ProBot `GET /api/guild/:guildId/compare/probot`

### Что всё ещё обычно есть в ProBot, но здесь пока не реализовано
- giveaways
- music
- temp voice
- web OAuth2 Discord login (вместо dashboard token)

## Технологии
- Node.js 20+
- discord.js v14
- Express (веб-панель)
- Railway (Nixpacks)

## Быстрый старт

```bash
npm install
cp .env.example .env
# заполните .env
npm run register
npm start
```

## Переменные окружения
- `DISCORD_TOKEN` — токен бота
- `DISCORD_CLIENT_ID` — Application ID
- `DISCORD_GUILD_ID` — ID сервера для регистрации slash-команд
- `WEB_PORT` — порт веб-панели (локально)
- `PORT` — Railway runtime порт (подхватывается автоматически)
- `DASHBOARD_TOKEN` — токен доступа к панели (`?token=...`)

## Railway-ready структура
В репозитории уже есть:
- `railway.json` — деплой-конфиг Railway
- `nixpacks.toml` — build/install/start шаги
- `Procfile` — fallback web process

## Веб-панель
После старта откройте:
- `/` — список серверов бота
- `/guild/:guildId` — конфигурация и логи
- `/health` — healthcheck
- `/api/guild/:guildId/compare/probot` — snapshot сравнения с ProBot

Если задан `DASHBOARD_TOKEN`, добавляйте `?token=YOUR_TOKEN` в URL.

## Важно
Это не 1:1 клон ProBot, а расширенная совместимая база с ключевыми ProBot-подобными модулями и готовой структурой для Railway.
