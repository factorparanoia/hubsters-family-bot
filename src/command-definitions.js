const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const coreCommands = [
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
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Видалити останні повідомлення')
    .addIntegerOption((option) =>
      option.setName('count').setDescription('Кількість 2-100').setRequired(true).setMinValue(2).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder().setName('rank').setDescription('Показати ваш рівень та рейтинг'),

  new SlashCommandBuilder()
    .setName('leveltop')
    .setDescription('Топ користувачів за рівнем')
    .addIntegerOption((option) =>
      option.setName('limit').setDescription('Кількість 3-20').setRequired(false).setMinValue(3).setMaxValue(20)
    ),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Інформація про користувача')
    .addUserOption((option) => option.setName('target').setDescription('Користувач').setRequired(false)),

  new SlashCommandBuilder()
    .setName('safe')
    .setDescription('Облік сейфа')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Додати позицію')
        .addStringOption((option) => option.setName('name').setDescription('Назва').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('Кількість').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Показати список')),

  new SlashCommandBuilder()
    .setName('warehouse')
    .setDescription('Облік складу')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Додати позицію')
        .addStringOption((option) => option.setName('name').setDescription('Назва').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('Кількість').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Показати список')),

  new SlashCommandBuilder()
    .setName('archive')
    .setDescription('Архів записів')
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription('Зберегти запис')
        .addStringOption((option) => option.setName('text').setDescription('Текст').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Останні записи')),

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
    .addRoleOption((option) => option.setName('role').setDescription('Роль').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

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
    .addSubcommand((sub) => sub.setName('word_list').setDescription('Список заборонених слів'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder().setName('analytics').setDescription('Аналітика сервера за 24 години'),
  new SlashCommandBuilder().setName('commands_ua').setDescription('Довідка по командах (UA)')
];

const extraCompatibilityCommands = [
  ['serverinfo', 'Інформація про сервер'],
  ['avatar', 'Аватар користувача'],
  ['roleinfo', 'Інформація про роль'],
  ['channelinfo', 'Інформація про канал'],
  ['lock', 'Закрити канал для написання'],
  ['unlock', 'Відкрити канал для написання'],
  ['slowmode', 'Увімкнути або змінити slowmode'],
  ['mute', 'Видати таймаут користувачу'],
  ['unmute', 'Зняти таймаут користувачу'],
  ['unban', 'Розбанити користувача за ID'],
  ['clearwarns', 'Очистити попередження користувача'],
  ['poll', 'Створити опитування'],
  ['reminder', 'Нагадування'],
  ['ticket', 'Система тікетів'],
  ['giveaway', 'Керування розіграшами'],
  ['backup_create', 'Створити бекап сервера'],
  ['backup_load', 'Відновити бекап сервера'],
  ['trigger', 'Тригер-команди'],
  ['autoresponse', 'Автовідповіді'],
  ['economy_balance', 'Баланс економіки'],
  ['economy_daily', 'Щоденна нагорода'],
  ['music_play', 'Відтворити музику'],
  ['music_stop', 'Зупинити музику'],
  ['music_skip', 'Пропустити трек'],
  ['tempvoice', 'Тимчасові голосові кімнати'],
  ['suggest', 'Створити пропозицію'],
  ['report', 'Надіслати скаргу модерації'],
  ['verify', 'Верифікація користувача'],
  ['autorole_list', 'Список авто-ролей'],
  ['logstats', 'Статистика логів']
].map(([name, description]) => new SlashCommandBuilder().setName(name).setDescription(description));

const commandDefinitions = [...coreCommands, ...extraCompatibilityCommands];

module.exports = { commandDefinitions };
