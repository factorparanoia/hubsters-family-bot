const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message to the current channel via bot')
    .addStringOption((option) =>
      option.setName('text').setDescription('Message text').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((option) =>
      option.setName('target').setDescription('User to kick').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((option) =>
      option.setName('target').setDescription('User to ban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Add warning to user')
    .addUserOption((option) =>
      option.setName('target').setDescription('User to warn').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Warning reason').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('List user warnings')
    .addUserOption((option) =>
      option.setName('target').setDescription('User').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete latest N messages in current channel')
    .addIntegerOption((option) =>
      option.setName('count').setDescription('2-100').setRequired(true).setMinValue(2).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder().setName('rank').setDescription('Show your level/rank'),

  new SlashCommandBuilder()
    .setName('leveltop')
    .setDescription('Show top level leaderboard')
    .addIntegerOption((option) =>
      option.setName('limit').setDescription('Top size 3-20').setRequired(false).setMinValue(3).setMaxValue(20)
    ),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show user profile summary')
    .addUserOption((option) =>
      option.setName('target').setDescription('User').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('safe')
    .setDescription('Manage server safe records')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add safe item')
        .addStringOption((option) =>
          option.setName('name').setDescription('Item name').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('Item amount').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List safe items')),

  new SlashCommandBuilder()
    .setName('warehouse')
    .setDescription('Manage warehouse records')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add warehouse item')
        .addStringOption((option) =>
          option.setName('name').setDescription('Item name').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('Item amount').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List warehouse items')),

  new SlashCommandBuilder()
    .setName('archive')
    .setDescription('Archive notes and decisions')
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription('Save text entry to archive')
        .addStringOption((option) =>
          option.setName('text').setDescription('Archive text').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Show latest archive entries')),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot features for this guild')
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Set welcome channel and message')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable welcome messages').setRequired(true)
        )
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Welcome channel').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('message').setDescription('Use {user} and {server} placeholders').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('logchannel')
        .setDescription('Set moderation/event log channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Log channel').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('autorole')
        .setDescription('Set auto-role for new members')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to auto assign').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('suggestions')
        .setDescription('Set suggestions channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('Suggestions channel').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Bind emoji to role for reaction-role workflow')
    .addStringOption((option) =>
      option.setName('emoji').setDescription('Emoji, e.g. ✅').setRequired(true)
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Role to assign').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Auto moderation settings')
    .addSubcommand((sub) =>
      sub
        .setName('links')
        .setDescription('Enable/disable link blocking')
        .addBooleanOption((option) => option.setName('enabled').setDescription('true/false').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('word_add')
        .setDescription('Add blocked word')
        .addStringOption((option) => option.setName('word').setDescription('Word').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('word_remove')
        .setDescription('Remove blocked word')
        .addStringOption((option) => option.setName('word').setDescription('Word').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('word_list').setDescription('List blocked words'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Server analytics overview')
];

module.exports = { commandDefinitions };
