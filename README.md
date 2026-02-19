# Discord Management Bot (Railway) + Web Panel

Оновлення: додано великий сумісний набір slash-команд у стилі **ProBot + CarlBot** та українізовані описи команд.

## Що зроблено
- Команди та описи перекладені українською для зручності адміністраторів.
- Додано розширений compatibility-набір команд (модерація, utility, tickets, giveaways, music, backups, verify, reports тощо).
- Для ключових модулів логіка вже працює: модерація, automod, рівні, welcome/autorole, reaction roles, analytics, архів, сейф/склад.
- Для частини compatibility-команд додано безпечний fallback-відповідач (бот не мовчить, а пояснює, що команда в процесі повної реалізації).

## Чому це важливо
В ProBot/CarlBot дуже великий обсяг команд і модулів. У цій версії:
1. Командний інтерфейс максимально наближений за набором.
2. Критичні модулі вже робочі.
3. Решта модулів має сумісні entry points і зрозумілий статус впровадження.

## Якщо не з'являються команди
- Перевірте `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`.
- Переконайтесь, що бот запрошений із scope: `bot applications.commands`.
- Подивіться логи старта: має бути `[commands] synced ...`.
- Для миттєвого оновлення команд залишайте `DISCORD_GUILD_ID` (guild commands).

## Швидкий старт
```bash
npm install
cp .env.example .env
npm start
```
