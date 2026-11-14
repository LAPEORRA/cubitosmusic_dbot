import assert from 'node:assert/strict';
import { test } from 'node:test';
import { help } from '../../src/commands/utility/help.js';

test('/help lista los comandos agrupados por categoría y responde con flags 64', async () => {
  const replies: any[] = [];
  const interaction = {
    async reply(payload: any) {
      replies.push(payload);
    },
  };

  await help(interaction);

  assert.equal(replies.length, 1);
  assert.equal(replies[0].flags, 64);

  const embed = replies[0].embeds[0];
  assert.equal(embed.data.color, 0x5865f2);
  assert.equal(embed.data.footer.text, 'CubitoMusic');

  const fields = embed.data.fields ?? [];
  const music = fields.find((field: any) => field.name === '🎵 Música');
  const utility = fields.find((field: any) => field.name === '🛠️ Utilidades');
  assert.ok(music, 'debe existir el grupo de música');
  assert.ok(utility, 'debe existir el grupo de utilidades');

  assert.match(music.value, /• `\/play` — Reproduce una canción, playlist o búsqueda\./);
  assert.match(music.value, /• `\/pause` — Pausa o reanuda la reproducción\./);
  assert.match(utility.value, /• `\/help` — Muestra esta lista de comandos\./);
});

test('/help incluye todos los comandos registrados', async () => {
  const replies: any[] = [];
  const interaction = {
    async reply(payload: any) {
      replies.push(payload);
    },
  };

  await help(interaction);

  const fields = replies[0].embeds[0].data.fields ?? [];
  const lines = fields.flatMap((field: any) => field.value.split('\n'));
  const { commands } = await import('../../src/commands/index.js');

  assert.equal(lines.length, commands.length);
  for (const command of commands) {
    assert.ok(
      lines.some((line: string) => line.includes(`/${command.data.name}`)),
      `falta /${command.data.name} en /help`,
    );
  }
});
