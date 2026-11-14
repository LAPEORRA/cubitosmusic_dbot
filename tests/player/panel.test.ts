import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from 'discord.js';
import type { GuildQueue, Track } from 'discord-player';
import {
  buildPanelEmbed,
  buildPanelRows,
  formatPanelProgress,
  getPanelMessage,
  getPanelRowState,
  setPanelMessage,
  updateEmptyPanel,
  updatePanel,
} from '../../src/player/panel/panel.js';
import { handlePanelButton } from '../../src/player/panel/panel-buttons.js';

function fakeQueue(volume = 70): GuildQueue {
  return {
    node: { createProgressBar: () => '0:00 / 3:00', volume },
    tracks: { data: [] },
  } as unknown as GuildQueue;
}

type FakeTimestamp = {
  current: { label: string; value: number };
  total: { label: string; value: number };
};

function fakeTimedQueue(options: {
  paused?: boolean;
  timestamp?: FakeTimestamp | null;
}, volume = 70): GuildQueue {
  return {
    node: {
      isPaused: () => options.paused ?? false,
      getTimestamp: () => options.timestamp ?? null,
      volume,
    },
    tracks: { data: [] },
  } as unknown as GuildQueue;
}

function fakeTrack(requestedBy: unknown = null): Track {
  return {
    title: 'One More Time',
    url: 'https://example.com/track',
    author: 'Daft Punk',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '3:45',
    requestedBy,
  } as unknown as Track;
}

function buttonIds(row: ActionRowBuilder<ButtonBuilder>): Array<string | undefined> {
  return row.components.map((button) => (button.data as { custom_id?: string }).custom_id);
}

function findButton(rows: ActionRowBuilder<ButtonBuilder>[], customId: string): ButtonBuilder | undefined {
  for (const row of rows) {
    const button = row.components.find(
      (component) => (component.data as { custom_id?: string }).custom_id === customId,
    );
    if (button) return button;
  }
  return undefined;
}

test('an empty-queue panel update is not overwritten by a pending playback update', async () => {
  const guildId = `panel-test-${Date.now()}`;
  let description: string | undefined;
  let title: string | undefined;

  const message = {
    editable: true,
    deletable: false,
    components: [],
    async edit(payload: { embeds: EmbedBuilder[] }) {
      await Promise.resolve();
      description = payload.embeds[0].data.description;
      title = payload.embeds[0].data.title;
      return message;
    },
  } as unknown as Message;

  setPanelMessage(guildId, message);

  const activeUpdate = updatePanel(
    { guildId },
    new EmbedBuilder().setTitle('Reproduciendo'),
    [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('panel_pause').setLabel('Pausar').setStyle(1),
      ),
    ],
  );
  const emptyUpdate = updateEmptyPanel({ guildId });

  await Promise.all([activeUpdate, emptyUpdate]);

  assert.equal(
    description,
    'Me desconecté del canal de voz porque no quedan canciones en la cola.\n'
    + 'Usa `/play` cuando quieras volver a escuchar música.',
  );
  assert.equal(title, '📭 Cola finalizada');

  // El panel deshabilitado ya no se retiene en memoria: la próxima sesión crea uno nuevo.
  assert.equal(getPanelMessage(guildId), undefined);

  const newMessage = { editable: true, deletable: false, components: [] } as unknown as Message;
  let sent = 0;
  await updatePanel(
    {
      guildId,
      send: async () => {
        sent += 1;
        return newMessage;
      },
    },
    new EmbedBuilder().setTitle('Nueva sesión'),
    [new ActionRowBuilder<ButtonBuilder>()],
  );
  assert.equal(sent, 1);
  assert.equal(getPanelMessage(guildId), newMessage);
});

test('el panel menciona al solicitante cuando conoce su id', () => {
  const embed = buildPanelEmbed(
    fakeTrack({ id: '123456789', username: 'nuevo-usuario' }),
    fakeQueue(),
    new Date(),
    'usuario-viejo',
  );
  const description = embed.data.description ?? '';

  assert.ok(description.includes('<@123456789>'), description);
  assert.ok(!description.includes('usuario-viejo'), 'no debe usar el fallback de la cola');
});

test('el panel usa el username del solicitante cuando la pista no trae id', () => {
  const embed = buildPanelEmbed(fakeTrack({ username: 'nuevo-usuario' }), fakeQueue(), new Date(), 'usuario-viejo');
  const description = embed.data.description ?? '';

  assert.ok(description.includes('• nuevo-usuario'), description);
  assert.ok(!description.includes('<@'), description);
});

test('el panel cae al solicitante de la cola y luego a Desconocido', () => {
  const fallback = buildPanelEmbed(fakeTrack(null), fakeQueue(), new Date(), 'usuario-viejo');
  assert.ok((fallback.data.description ?? '').includes('usuario-viejo'));

  const unknown = buildPanelEmbed(fakeTrack(null), fakeQueue(), new Date());
  assert.ok((unknown.data.description ?? '').includes('Desconocido'));
});

test('la descripción del panel es compacta: progreso • solicitante y autor', () => {
  const embed = buildPanelEmbed(fakeTrack({ id: '42' }), fakeQueue(), new Date());
  const lines = (embed.data.description ?? '').split('\n');

  assert.equal(lines.length, 2);
  assert.equal(lines[0], '3:45 • <@42>');
  assert.equal(lines[1], 'Por **Daft Punk**');
  assert.equal(embed.data.fields, undefined, 'el panel ya no usa campos');
});

test('el panel omite URL y miniatura cuando no son http(s) válidas', () => {
  const track = { ...fakeTrack(), url: 'javascript:alert(1)', thumbnail: 'no-es-url' } as unknown as Track;
  const embed = buildPanelEmbed(track, fakeQueue(), new Date());

  assert.equal(embed.data.url, undefined);
  assert.equal(embed.data.thumbnail, undefined);
});

test('el panel omite URL y miniatura vacías sin lanzar', () => {
  const track = { ...fakeTrack(), url: '', thumbnail: undefined } as unknown as Track;
  const embed = buildPanelEmbed(track, fakeQueue(), new Date());

  assert.equal(embed.data.url, undefined);
  assert.equal(embed.data.thumbnail, undefined);
});

test('el panel conserva URL y miniatura http(s) válidas', () => {
  const embed = buildPanelEmbed(fakeTrack(), fakeQueue(), new Date());

  assert.equal(embed.data.url, 'https://example.com/track');
  assert.equal(embed.data.thumbnail?.url, 'https://example.com/thumb.jpg');
});

test('formatPanelProgress al reproducir muestra la duración y la cuenta regresiva nativa', () => {
  const nowMs = 1_700_000_000_000;
  const queue = fakeTimedQueue({
    // Prioriza el label del timestamp sobre `track.duration` ('3:45').
    timestamp: { current: { label: '1:00', value: 60_000 }, total: { label: '4:00', value: 240_000 } },
  });

  const progress = formatPanelProgress(fakeTrack(), queue, nowMs);
  const endUnix = Math.floor((nowMs + 180_000) / 1000);

  assert.equal(progress, `4:00 • termina <t:${endUnix}:R>`);
  assert.ok(!progress.includes('/'), 'no debe conservar la barra ASCII');
});

test('formatPanelProgress al reanudar tras progreso parcial calcula el fin real restante', () => {
  const nowMs = 1_700_000_123_456;
  const queue = fakeTimedQueue({
    timestamp: { current: { label: '2:14', value: 134_000 }, total: { label: '5:00', value: 300_000 } },
  });

  const progress = formatPanelProgress(fakeTrack(), queue, nowMs);
  const expectedEndUnix = Math.floor((nowMs + (300_000 - 134_000)) / 1000);

  assert.equal(progress, `5:00 • termina <t:${expectedEndUnix}:R>`);
  // El fin debe ser `nowMs + restante`, no `nowMs + duración total`.
  assert.ok(!progress.includes(`<t:${Math.floor((nowMs + 300_000) / 1000)}:R>`));
});

test('formatPanelProgress en pausa congela el tiempo con los timecodes actuales', () => {
  const queue = fakeTimedQueue({
    paused: true,
    timestamp: { current: { label: '1:20', value: 80_000 }, total: { label: '3:45', value: 225_000 } },
  });

  assert.equal(formatPanelProgress(fakeTrack(), queue, 1_700_000_000_000), '⏸️ 1:20 / 3:45');
});

test('formatPanelProgress en pausa sin timestamp cae a la duración de la pista', () => {
  const queue = fakeTimedQueue({ paused: true, timestamp: null });

  assert.equal(formatPanelProgress(fakeTrack(), queue), '⏸️ 3:45');
});

test('formatPanelProgress sin timestamp usa la duración de la pista', () => {
  const queue = fakeTimedQueue({ timestamp: null });

  assert.equal(formatPanelProgress(fakeTrack(), queue), '3:45');
});

test('formatPanelProgress en stream en vivo sin duración devuelve En vivo', () => {
  const track = { ...fakeTrack(), duration: '', durationMS: 0 } as unknown as Track;
  const queue = fakeTimedQueue({ timestamp: null });

  assert.equal(formatPanelProgress(track, queue), 'En vivo');
});

test('la descripción del panel usa formatPanelProgress con cuenta regresiva y sin barra ASCII', () => {
  const queue = fakeTimedQueue({
    timestamp: { current: { label: '0:10', value: 10_000 }, total: { label: '3:00', value: 180_000 } },
  });

  const embed = buildPanelEmbed(fakeTrack({ id: '7' }), queue, new Date());
  const [firstLine] = (embed.data.description ?? '').split('\n');

  assert.match(firstLine, /^3:00 • termina <t:\d+:R> • <@7>$/, firstLine);
  assert.ok(!firstLine.includes('/'), `no debe usar la barra ASCII: ${firstLine}`);
});

test('el autor del panel muestra Reproduciendo con GIF animado y En pausa sin icono', () => {
  const playing = buildPanelEmbed(fakeTrack(), fakeQueue(), new Date());
  assert.equal(playing.data.author?.name, 'Reproduciendo');
  assert.match(playing.data.author?.icon_url ?? '', /^https:\/\//);

  const paused = buildPanelEmbed(fakeTrack(), fakeTimedQueue({ paused: true }), new Date());
  assert.equal(paused.data.author?.name, 'En pausa');
  assert.equal(paused.data.author?.icon_url, undefined, 'sin GIF al pausar');
});

test('el footer del panel resume estado, volumen, cola y loop', () => {
  const makeQueue = (paused: boolean, repeatMode: number) => ({
    node: { isPaused: () => paused, getTimestamp: () => null, volume: 55 },
    tracks: { data: [{}, {}] },
    repeatMode,
  } as unknown as GuildQueue);

  const playing = buildPanelEmbed(fakeTrack(), makeQueue(false, 1), new Date());
  assert.equal(playing.data.footer?.text, 'Reproduciendo • Vol 55% • Cola: 2 • Loop: on');
  assert.ok(playing.data.timestamp, 'el embed lleva timestamp');

  const paused = buildPanelEmbed(fakeTrack(), makeQueue(true, 0), new Date());
  assert.equal(paused.data.footer?.text, 'En pausa • Vol 55% • Cola: 2 • Loop: off');
});

test('los botones llevan etiqueta corta y conservan sus customIds', () => {
  const [row1, row2] = buildPanelRows(false);
  const labels = (row: ActionRowBuilder<ButtonBuilder>) =>
    row.components.map((button) => (button.data as { label?: string }).label);

  assert.deepEqual(labels(row1), ['Atrás', 'Pausar', 'Saltar', 'Stop', 'Cola']);
  assert.deepEqual(labels(row2), ['Loop', 'Mezclar']);
  assert.deepEqual(buttonIds(row1).concat(buttonIds(row2)), [
    'panel_back', 'panel_pause', 'panel_skip', 'panel_stop', 'panel_queue', 'panel_loop', 'panel_shuffle',
  ]);

  const [pausedRow] = buildPanelRows(true);
  const pauseButton = findButton([pausedRow], 'panel_pause');
  assert.equal((pauseButton?.data as { label?: string }).label, 'Reanudar');
  assert.equal((pauseButton?.data as { emoji?: { name?: string } }).emoji?.name, '▶️');
});

test('buildPanelRows devuelve dos filas con los controles y los botones nuevos', () => {
  const rows = buildPanelRows(false);
  assert.equal(rows.length, 2);

  const ids = rows.map(buttonIds);
  assert.deepEqual(ids[0], ['panel_back', 'panel_pause', 'panel_skip', 'panel_stop', 'panel_queue']);
  assert.deepEqual(ids[1], ['panel_loop', 'panel_shuffle']);
});

test('el botón loop se marca en Success con repeatMode distinto de 0', () => {
  const [, active] = buildPanelRows(false, 1);
  assert.deepEqual(buttonIds(active), ['panel_loop', 'panel_shuffle']);
  assert.equal(active.components[0].data.style, ButtonStyle.Success);
  assert.equal(active.components[1].data.style, ButtonStyle.Secondary);

  const [, idle] = buildPanelRows(false, 0);
  assert.equal(idle.components[0].data.style, ButtonStyle.Secondary);
});

test('buildPanelRows deshabilita back, shuffle y queue cuando el estado lo indica', () => {
  const rows = buildPanelRows(false, 0, { canBack: false, canShuffle: false, hasQueue: false });

  assert.equal(findButton(rows, 'panel_back')?.data.disabled, true);
  assert.equal(findButton(rows, 'panel_shuffle')?.data.disabled, true);
  assert.equal(findButton(rows, 'panel_queue')?.data.disabled, true);

  // Los controles que no dependen del contexto siguen operativos.
  for (const customId of ['panel_pause', 'panel_skip', 'panel_stop', 'panel_loop']) {
    assert.notEqual(findButton(rows, customId)?.data.disabled, true, `${customId} no debe estar deshabilitado`);
  }
});

test('buildPanelRows habilita back, shuffle y queue cuando hay historial y cola', () => {
  const rows = buildPanelRows(false, 0, { canBack: true, canShuffle: true, hasQueue: true });

  for (const customId of ['panel_back', 'panel_shuffle', 'panel_queue']) {
    assert.notEqual(findButton(rows, customId)?.data.disabled, true, `${customId} debe estar habilitado`);
  }
});

test('buildPanelRows sin estado mantiene todos los botones habilitados (retrocompatible)', () => {
  const rows = buildPanelRows(false);

  for (const customId of ['panel_back', 'panel_shuffle', 'panel_queue']) {
    assert.notEqual(findButton(rows, customId)?.data.disabled, true);
  }
});

test('buildPanelRows solo deshabilita los botones indicados en un estado parcial', () => {
  const rows = buildPanelRows(false, 0, { canBack: false });

  assert.equal(findButton(rows, 'panel_back')?.data.disabled, true);
  assert.notEqual(findButton(rows, 'panel_shuffle')?.data.disabled, true);
  assert.notEqual(findButton(rows, 'panel_queue')?.data.disabled, true);
});

test('getPanelRowState deriva canBack, canShuffle y hasQueue desde la cola', () => {
  const withHistory = {
    tracks: { size: 2 },
    history: { isEmpty: () => false, tracks: { size: 1 } },
  } as unknown as GuildQueue;
  assert.deepEqual(getPanelRowState(withHistory), {
    canBack: true,
    canShuffle: true,
    hasQueue: true,
  });

  const empty = {
    tracks: { size: 0 },
    history: { isEmpty: () => true, tracks: { size: 0 } },
  } as unknown as GuildQueue;
  assert.deepEqual(getPanelRowState(empty), {
    canBack: false,
    canShuffle: false,
    hasQueue: false,
  });
});

test('updateEmptyPanel deshabilita los botones de todas las filas', async () => {
  const guildId = `panel-empty-${Date.now()}-${Math.random()}`;
  let edited: any;

  const apiRow = (customIds: string[]) => ({
    type: ComponentType.ActionRow,
    components: customIds.map((customId) => ({
      type: ComponentType.Button,
      custom_id: customId,
      style: ButtonStyle.Secondary,
    })),
  });

  const message = {
    editable: true,
    deletable: false,
    components: [
      apiRow(['panel_pause', 'panel_skip']),
      apiRow(['panel_loop', 'panel_shuffle']),
    ],
    async edit(payload: unknown) {
      edited = payload;
      return message;
    },
  } as unknown as Message;

  setPanelMessage(guildId, message);
  await updateEmptyPanel({ guildId });

  assert.equal(edited.components.length, 2);
  const disabled = edited.components.flatMap((row: any) =>
    row.components.map((component: any) => component.data.disabled),
  );
  assert.deepEqual(disabled, [true, true, true, true]);
  assert.equal(getPanelMessage(guildId), undefined);
});

test('panel_shuffle avisa cuando no hay canciones en espera y no re-renderiza', async () => {
  const followUps: any[] = [];
  let sends = 0;

  const interaction = {
    guildId: 'guild-shuffle-empty',
    customId: 'panel_shuffle',
    channel: {
      name: 'musica',
      guildId: 'guild-shuffle-empty',
      send: async () => {
        sends += 1;
      },
    },
    member: { voice: { channel: { id: 'voice-1' }, channelId: 'voice-1' } },
    reply: async () => {},
    deferUpdate: async () => {},
    followUp: async (payload: any) => {
      followUps.push(payload);
    },
  };

  const queue = {
    channel: { id: 'voice-1' },
    currentTrack: { title: 'One More Time' },
    repeatMode: 0,
    node: { isPaused: () => false },
    tracks: { data: [], shuffle: () => {} },
  } as unknown as GuildQueue;

  const originalLog = console.log;
  console.log = () => {};
  try {
    await handlePanelButton(interaction, () => queue);
  } finally {
    console.log = originalLog;
  }

  assert.equal(followUps.length, 1);
  assert.equal(followUps[0].content, '📭 No hay canciones en la cola para mezclar.');
  assert.equal(sends, 0, 'no debe re-renderizar el panel');
});

