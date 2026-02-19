const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Надіслати повідомлення від імені бота')
    .addStringOption((option) => option.setName('text').setDescription('Текст повідомлення').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Вигнати учасника із сервера')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Причина').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Забанити учасника')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Причина').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Видати попередження')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Причина').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Список попереджень користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Видалити останні повідомлення')
    .addIntegerOption((option) =>
      option.setName('count').setDescription('Кількість 2-100').setRequired(true).setMinValue(2).setMaxValue(100)
    ),
  new SlashCommandBuilder().setName('rank').setDescription('Показати ваш рівень та рейтинг'),
  new SlashCommandBuilder()
    .setName('leveltop')
    .setDescription('Топ користувачів за рівнем')
    .addIntegerOption((option) => option.setName('limit').setDescription('Кількість').setRequired(false)),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Інформація про користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Інформація про сервер'),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Аватар користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
  new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Інформація про роль')
    .addRoleOption((option) => option.setName('role').setDescription('Роль').setRequired(true)),
  new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Інформація про канал')
    .addChannelOption((option) => option.setName('channel').setDescription('Канал').setRequired(true)),
  new SlashCommandBuilder().setName('lock').setDescription('Закрити поточний канал для написання'),
  new SlashCommandBuilder().setName('unlock').setDescription('Відкрити поточний канал для написання'),
  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Встановити slowmode в поточному каналі')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Секунди').setRequired(true)),
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Видати таймаут користувачу')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true))
    .addIntegerOption((option) => option.setName('minutes').setDescription('Хвилини').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Причина').setRequired(false)),
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Зняти таймаут з користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true)),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Розбанити користувача за ID')
    .addStringOption((option) => option.setName('userid').setDescription('ID користувача').setRequired(true)),
  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Очистити попередження користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true)),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Створити опитування')
    .addStringOption((option) => option.setName('question').setDescription('Питання').setRequired(true))
    .addStringOption((option) => option.setName('options').setDescription('Варіанти через кому').setRequired(true)),
  new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Нагадування')
    .addIntegerOption((option) => option.setName('minutes').setDescription('Через скільки хвилин').setRequired(true))
    .addStringOption((option) => option.setName('text').setDescription('Текст').setRequired(true)),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Система тікетів')
    .addSubcommand((sub) => sub.setName('create').setDescription('Створити тікет'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Закрити тікет')),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Керування розіграшами')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Створити розіграш')
        .addIntegerOption((option) => option.setName('minutes').setDescription('Тривалість').setRequired(true))
        .addStringOption((option) => option.setName('prize').setDescription('Приз').setRequired(true))
        .addIntegerOption((option) => option.setName('winners').setDescription('Кількість переможців').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Переобрати переможця')
        .addStringOption((option) => option.setName('messageid').setDescription('ID повідомлення').setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName('backup_create')
    .setDescription('Створити бекап сервера')
    .addStringOption((option) => option.setName('name').setDescription('Назва бекапу').setRequired(true)),
  new SlashCommandBuilder()
    .setName('backup_load')
    .setDescription('Застосувати бекап конфігурації')
    .addStringOption((option) => option.setName('name').setDescription('Назва бекапу').setRequired(true)),
  new SlashCommandBuilder()
    .setName('trigger')
    .setDescription('Тригер-команди')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Додати тригер')
        .addStringOption((option) => option.setName('key').setDescription('Ключ').setRequired(true))
        .addStringOption((option) => option.setName('response').setDescription('Відповідь').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Видалити тригер')
        .addStringOption((option) => option.setName('key').setDescription('Ключ').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Список тригерів')),
  new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Автовідповідь за ключем')
    .addStringOption((option) => option.setName('key').setDescription('Ключ').setRequired(true)),
  new SlashCommandBuilder().setName('economy_balance').setDescription('Баланс економіки'),
  new SlashCommandBuilder().setName('economy_daily').setDescription('Щоденна нагорода'),
  new SlashCommandBuilder()
    .setName('music_play')
    .setDescription('Додати трек у чергу')
    .addStringOption((option) => option.setName('query').setDescription('Назва або посилання').setRequired(true)),
  new SlashCommandBuilder().setName('music_stop').setDescription('Зупинити музику та очистити чергу'),
  new SlashCommandBuilder().setName('music_skip').setDescription('Пропустити поточний трек'),
  new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Тимчасові голосові кімнати')
    .addSubcommand((sub) => sub.setName('create').setDescription('Створити кімнату'))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Видалити поточну кімнату')),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Створити пропозицію')
    .addStringOption((option) => option.setName('text').setDescription('Текст').setRequired(true)),
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Надіслати скаргу модерації')
    .addUserOption((option) => option.setName('target').setDescription('На кого скарга').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Причина').setRequired(true)),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Верифікувати користувача (видача авто-ролі)')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
  new SlashCommandBuilder().setName('autorole_list').setDescription('Показати активну авто-роль'),
  new SlashCommandBuilder().setName('logstats').setDescription('Статистика логів за типами'),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Налаштування бота')
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Налаштувати привітання')
        .addBooleanOption((option) => option.setName('enabled').setDescription('Увімкнути').setRequired(true))
        .addChannelOption((option) => option.setName('channel').setDescription('Канал').setRequired(false))
        .addStringOption((option) => option.setName('message').setDescription('Шаблон').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('logchannel')
        .setDescription('Канал логів')
        .addChannelOption((option) => option.setName('channel').setDescription('Канал').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('autorole')
        .setDescription('Авто-роль для новачків')
        .addRoleOption((option) => option.setName('role').setDescription('Роль').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('suggestions')
        .setDescription('Канал пропозицій')
        .addChannelOption((option) => option.setName('channel').setDescription('Канал').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Привʼязати емодзі до ролі')
    .addStringOption((option) => option.setName('emoji').setDescription('Емодзі').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Роль').setRequired(true)),
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Авто-модерація')
    .addSubcommand((sub) =>
      sub
        .setName('links')
        .setDescription('Блокування посилань')
        .addBooleanOption((option) => option.setName('enabled').setDescription('Увімкнути').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('word_add')
        .setDescription('Додати заборонене слово')
        .addStringOption((option) => option.setName('word').setDescription('Слово').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('word_remove')
        .setDescription('Видалити заборонене слово')
        .addStringOption((option) => option.setName('word').setDescription('Слово').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('word_list').setDescription('Список заборонених слів')),
  new SlashCommandBuilder().setName('analytics').setDescription('Аналітика сервера за 24 години'),
  new SlashCommandBuilder().setName('ticket_panel').setDescription('Опублікувати панель відкриття тікетів'),
  new SlashCommandBuilder()
    .setName('activity_user')
    .setDescription('Детальна активність користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
  new SlashCommandBuilder()
    .setName('activity_channel')
    .setDescription('Детальна активність каналу')
    .addChannelOption((option) => option.setName('channel').setDescription('Канал').setRequired(false)),
  new SlashCommandBuilder()
    .setName('quest_count')
    .setDescription('Порахувати, скільки разів користувача згадали у квест-каналі')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
  new SlashCommandBuilder()
    .setName('event_count')
    .setDescription('Порахувати, скільки разів користувача згадали у каналі івентів')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),
    new SlashCommandBuilder()
    .setName('sync_commands')
    .setDescription('Примусово синхронізувати slash-команди')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('commands_ua').setDescription('Довідка по командах (UA)')
];

module.exports = { commandDefinitions };
