const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} = require('@discordjs/voice');
const { PermissionFlagsBits } = require('discord.js');
const play = require('play-dl');

const guildPlayers = new Map();

function ensureGuildState(guildId) {
  if (!guildPlayers.has(guildId)) {
    guildPlayers.set(guildId, {
      player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }),
      queue: [],
      connection: null,
      playing: false
    });
  }
  return guildPlayers.get(guildId);
}

function assertVoicePermissions(member, channel) {
  const me = channel.guild.members.me;
  if (!me) throw new Error('Бот ще не ініціалізований у цьому сервері.');
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.Connect)) throw new Error('У бота немає права Connect у voice-каналі.');
  if (!perms?.has(PermissionFlagsBits.Speak)) throw new Error('У бота немає права Speak у voice-каналі.');
  if (channel.full && !perms?.has(PermissionFlagsBits.MoveMembers)) {
    throw new Error('Voice-канал заповнений і бот не має MoveMembers.');
  }
}

async function ensureVoiceReady(connection) {
  const statuses = [VoiceConnectionStatus.Signalling, VoiceConnectionStatus.Connecting, VoiceConnectionStatus.Ready];
  let lastError;

  for (let i = 0; i < 3; i++) {
    for (const status of statuses) {
      try {
        await entersState(connection, status, 8_000);
        if (status === VoiceConnectionStatus.Ready) return;
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw new Error(`Не вдалося підключитися до voice (${lastError?.message || 'unknown'})`);
}

async function connectToVoiceChannel(member) {
  const channel = member.voice?.channel;
  if (!channel) throw new Error('Спочатку зайдіть у голосовий канал.');

  assertVoicePermissions(member, channel);

  const state = ensureGuildState(channel.guild.id);
  let connection = getVoiceConnection(channel.guild.id);

  if (!connection || connection.joinConfig.channelId !== channel.id) {
    if (connection) connection.destroy();
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });
  }

  await ensureVoiceReady(connection);

  state.connection = connection;
  connection.subscribe(state.player);

  state.player.removeAllListeners(AudioPlayerStatus.Idle);
  state.player.on(AudioPlayerStatus.Idle, async () => {
    state.playing = false;
    await playNext(channel.guild.id);
  });

  return state;
}

async function resolveTrack(query) {
  const isUrl = /^https?:\/\//i.test(query);
  let target = query;

  if (!isUrl) {
    const search = await play.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!search.length) throw new Error('Нічого не знайдено за запитом.');
    target = search[0].url;
  }

  const stream = await play.stream(target, { discordPlayerCompatibility: true, quality: 2 });
  const details = await play.video_info(target).catch(() => null);

  return {
    url: target,
    title: details?.video_details?.title || target,
    sourceStream: stream.stream,
    streamType: stream.type === 'opus' ? StreamType.Opus : StreamType.Arbitrary
  };
}

async function createPlayableResource(track) {
  try {
    const probed = await demuxProbe(track.sourceStream);
    return createAudioResource(probed.stream, { inputType: probed.type, inlineVolume: true });
  } catch {
    return createAudioResource(track.sourceStream, { inputType: track.streamType, inlineVolume: true });
  }
}

async function playNext(guildId) {
  const state = guildPlayers.get(guildId);
  if (!state || state.playing) return;

  const next = state.queue.shift();
  if (!next) {
    if (state.connection) {
      state.connection.destroy();
      state.connection = null;
    }
    return;
  }

  state.playing = true;

  const resource = await createPlayableResource(next);
  if (resource.volume) resource.volume.setVolume(0.7);
  state.player.play(resource);

  const channel = next.guild.channels.cache.get(next.notifyChannelId);
  channel?.send(`🎶 Зараз грає: **${next.title}**`).catch(() => null);
}

async function enqueue(member, query, notifyChannelId) {
  const state = await connectToVoiceChannel(member);
  const track = await resolveTrack(query);
  state.queue.push({ ...track, guild: member.guild, notifyChannelId });
  if (!state.playing) await playNext(member.guild.id);
  return { title: track.title, queueSize: state.queue.length };
}

function skip(guildId) {
  const state = guildPlayers.get(guildId);
  if (!state?.playing) return false;
  state.player.stop();
  return true;
}

function stop(guildId) {
  const state = guildPlayers.get(guildId);
  if (!state) return false;
  state.queue = [];
  state.player.stop();
  if (state.connection) {
    state.connection.destroy();
    state.connection = null;
  }
  state.playing = false;
  return true;
}

module.exports = { enqueue, skip, stop };
