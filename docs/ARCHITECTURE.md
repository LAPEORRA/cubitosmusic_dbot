# Arquitectura - CubitoMusic Bot

> **Propósito de este documento**: servir de guía completa para un agente futuro
> (humano o IA) que deba mantener, extender o corregir este bot. Describe arquitectura,
> flujo de datos, decisiones de diseño, gotchas conocidos y cómo reproducir/probar cada
> funcionalidad.

## Estado Actual (v1.1.0) — último commit verificado

- **Bot activo** en Discord: CubitosMusic#0843
- **Guild de desarrollo:** Cubitos Dubidu (ID: `1016533561295245332`)
- **Repositorio:** https://github.com/LAPEORRA/cubitosmusic_dbot (rama `main`)
- **Tag estable:** `v1.1.0` (reproducción yt-dlp + radio mixes + panel interactivo)
- **GitHub Pages (legal):** https://lapeorra.github.io/cubitosmusic_dbot/ (`terms.html` / `privacy.html`, stubs que redirigen a `docs/legal/`)

### Funcionalidad verificada ✅
| Función | Estado |
|---------|--------|
| Bot online + slash commands guild | ✅ |
| `/play` con URL de video YouTube | ✅ |
| `/play` con URL/contenido YouTube Music | ✅ |
| Playlists largas de YouTube (video y música) | ✅ |
| Radio mixes YouTube (`list=RD*`) como playlist | ✅ |
| Spotify / SoundCloud (extractores defaults) | ✅ registrado (Spotify sin credenciales: degradado) |
| `/skip`, `/stop`, `/pause`/`/resume` | ✅ |
| `/loop`, `/shuffle`, `/nowplaying`, `/queue` | ✅ |
| `/clear`, `/remove`, `/skipto` (gestión de colas largas) | ✅ |
| Panel interactivo con botones (⏮ ⏸ ⏭ ⏹ 📋 + 🔁 🔀) | ✅ |
| Anti-saturación de audio (volumen 70%, sin filtros ffmpeg) | ✅ |
| GitHub Pages (terms + privacy) | ✅ |

---

## Stack Técnico

- **Runtime:** Node.js 22+ (requisito del extractor `discord-player-youtubedlp`; desarrollo actual: Node 24)
- **Lenguaje:** TypeScript estricto + ESM (`"type": "module"`)
- **Discord:** discord.js v14 (`^14.27.0`)
- **Motor de música:** discord-player v7 (`^7.2.0`)
- **Voz:** @discordjs/voice (`^0.19.2`)
- **Extractores:**
  - `@discord-player/extractor` (`^7.2.0`) → DefaultExtractors (SoundCloud, Spotify, AppleMusic, Vimeo, Reverbnation, Attachment)
  - `discord-player-youtubedlp` (`^1.2.2`) → YouTubeDlpExtractor (yt-dlp + youtubei.js)
  - Clase custom `YouTubeDlpMixExtractor` (subclase, en `src/player/extractors/youtubeDlpMix.ts`)
- **Procesamiento de audio:** `ffmpeg-static` (`^5.3.0`) + binario `yt-dlp` (lo provee el postinstall de `ytdlp-nodejs@3.4.5`)
- **Dev:** `tsx` (`^4.23.15`)

### Dependencias clave (package.json)
```jsonc
"dependencies": {
  "@discord-player/extractor": "^7.2.0",
  "@discordjs/voice": "^0.19.2",
  "discord-player": "^7.2.0",
  "discord-player-youtubedlp": "^1.2.2",
  "discord.js": "^14.27.0",
  "dotenv": "^18.0.0",
  "ffmpeg-static": "^5.3.0"
},
"devDependencies": { "tsx": "^4.23.15" },
"allowScripts": { "ytdlp-nodejs@3.4.5": true }  // necesario para que yt-dlp.exe se descargue en postinstall
```

> ⚠️ **Importante sobre `npm approve-scripts`:** `ytdlp-nodejs` descarga el binario
> `yt-dlp.exe` en su postinstall. En esta máquina ya se aprobó (`npm approve-scripts ytdlp-nodejs`).
> El binario queda en `node_modules/ytdlp-nodejs/bin/yt-dlp.exe`. Si se reinstala desde cero
> en otra máquina, hay que aprobar ese script (o devolver el allowScript a `~/.npmrc`).

---

## Variables de Entorno (`.env`)

Requeridas (el bot aborta si faltan `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`):

```env
DISCORD_TOKEN=<token del bot>        # Obligatorio
CLIENT_ID=<id de la aplicación>      # Obligatorio
GUILD_ID=<id del servidor dev>       # Obligatorio
SPOTIFY_CLIENT_ID=...                # Opcional (mejora Spotify)
SPOTIFY_CLIENT_SECRET=...            # Opcional
# YOUTUBE_COOKIE=...                 # NO usar: ver sección "Notas sobre yt-dlp"
```

- **`.env` está gitignored** y **NUNCA debe committearse**.
- **`.env.example`** es la plantilla pública (placeholders).
- **Seguridad:** todos los `.env*` y `session-*.md` están en `.gitignore`. El token actual
  del bot fue rotado tras un incidente de exposición en un `.md` (historia de referencia,
  no repetir). Si se vuelve a exponer: rotar en Discord Developer Portal y actualizar `.env`.

---

## Comandos npm

```bash
npm run dev                # Arranca el bot (tsx, sin recarga automática)
npm run build              # Compila con tsc a dist/
npm start                  # Ejecuta node dist/index.js (producción)
npm run deploy-commands    # Registra los slash commands en la guild (REST)
```

> `scripts/deploy-commands.ts` registra comandos **de guild** (instantáneo, vía `GUILD_ID`).
> El registro global tarda hasta 1h y no se usa aquí.

---

## Arquitectura del Proyecto

```
├── src/
│   ├── index.ts                  — Bootstrap: client, Player, registro de extractores, login
│   ├── config.ts                 — Validación tipada de variables de entorno (BotConfig)
│   ├── commands/
│   │   ├── index.ts              — Registro tipado de comandos (router + deploy)
│   │   └── music/                — Handlers de música (cada uno exporta data + run)
│   │       ├── play.ts           — /play <url|búsqueda> (normaliza URLs, elige extractor)
│   │       ├── skip.ts           — /skip
│   │       ├── stop.ts           — /stop (borra cola + panel vacío)
│   │       ├── queue.ts          — /queue (lista cola, 10 primeros)
│   │       ├── pause.ts          — /pause (toggle pausa/reanuda)
│   │       ├── loop.ts           — /loop (repeatMode 1 <-> 0)
│   │       ├── shuffle.ts        — /shuffle (mezcla la cola)
│   │       ├── clear.ts          — /clear (vacía la cola)
│   │       ├── remove.ts         — /remove <posicion> (elimina una pista)
│   │       ├── skipto.ts         — /skipto <posicion> (salta descartando anteriores)
│   │       └── nowplaying.ts     — /nowplaying (info + barra de progreso)
│   ├── events/
│   │   ├── ready.ts              — Suscripción a eventos del Player + panel
│   │   ├── interactionCreate.ts  — Router de interacciones (botones y slash commands)
│   │   └── interactionResponses.ts — Respuesta de errores según estado de interacción
│   ├── player/
│   │   ├── extractors/
│   │   │   └── youtubeDlpMix.ts  — YouTubeDlpMixExtractor (radio mixes como playlist)
│   │   ├── panel/
│   │   │   ├── panel.ts          — Panel interactivo (embed + botones + locks por guild)
│   │   │   └── panel-buttons.ts  — Handler de botones del panel
│   │   ├── controls.ts           — Utilidades de control y validación del canal de voz
│   │   ├── queueSummary.ts       — Resumen compartido entre /queue y el botón 📋
│   │   ├── url.ts                — normalizeUrl (extraído de play.ts, con tests)
│   │   └── audioPreset.ts        — Preset de compresor DSP por cola
│   └── types/
│       ├── index.ts              — Tipos compartidos (MusicQueue, BotConfig)
│       └── commands.ts           — Contrato Command / CommandContext / CommandCategory
├── tests/                        — Pruebas (node:test vía tsx)
├── scripts/
│   └── deploy-commands.ts        — Registro de comandos vía REST (soporta --global)
└── docs/                         — Arquitectura, setup y páginas legales
```

**scripts/deploy-commands.ts** — registro de comandos vía REST usando el mismo
registro que el router (`src/commands/index.ts`). Por defecto registra en la guild
de `GUILD_ID`; con `--global` registra comandos globales.

---

## Flujo de arranque (`src/index.ts`)

1. `dotenv/config` carga `.env`.
2. Valida `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (aborta si falta).
3. Crea `Client` (discord.js) con intents mínimos: `Guilds` y `GuildVoiceStates`.
4. Crea `Player` (discord-player).
5. Opciones de extractores: si hay credenciales Spotify, las pasa al extractor `com.discord-player.spotifyextractor`.
6. **Registro de extractores (orden importa):**
   - `await player.extractors.loadMulti(DefaultExtractors, extractorOptions)` — extractores genéricos.
   - `await player.extractors.register(YouTubeDlpMixExtractor, {...})` — YouTube con yt-dlp.
7. Conecta eventos de `Client`: `ClientReady` → `ready(client, player)`; `InteractionCreate` → `interactionCreate(interaction, player)`.
8. `client.login(DISCORD_TOKEN)`.

### Registro del extractor de YouTube (crítico)
```ts
await player.extractors.register(YouTubeDlpMixExtractor, {
  agent: { autoCookiesFromBrowser: false },  // OBLIGATORIO: evita leer cookies de Chrome
  searchLimit: 3,                            // resultados de búsqueda por texto
  playlistTimeoutMs: 30000,                  // timeout por página/continuación de playlist
  ytdlpTimeoutMs: 30000,                     // timeout de operaciones yt-dlp
});
```

> **`YouTubeDlpMixExtractor` hereda el mismo `identifier` que `YouTubeDlpExtractor`
> (`com.dfxphoenix.youtubedlp-extractor`), así que `play.ts` no necesita cambiar su
> `searchEngine`.** Priority 100 (igual que el padre). Se registra SOLO la subclase.

---

## Flujo de `/play` (`src/commands/music/play.ts`)

1. `interaction.deferReply()` (público) para ganar tiempo; si ya estaba respondida, aborta. La confirmación final es un mini-embed público (`buildCommandEmbed`).
2. Lee `query` y la normaliza con `normalizeUrl`.
3. Selecciona `searchEngine` según el contenido de la URL:
   - `youtube.com` → `'ext:com.dfxphoenix.youtubedlp-extractor'`
   - `spotify.com` → `'ext:com.discord-player.spotifyextractor'`
   - `soundcloud.com` → `'ext:com.discord-player.soundcloudextractor'`
   - resto (búsqueda de texto o desconocido) → `undefined` (detección automática)
4. Valida que el usuario esté en un canal de voz.
5. `player.play(channel, query, { requestedBy, signal, searchEngine, nodeOptions })`.
   - `requestedBy: interaction.user` — metadato **por pista** (cada canción conserva su solicitante).
   - `signal: AbortSignal.timeout(30_000)` — protege contra AsyncQueue bloqueado por playlists largas.
   - `nodeOptions`:
     - `metadata: { channel }` — canal donde vive el panel.
     - `leaveOnEmpty: true` + `leaveOnEmptyCooldown: 300_000` y `leaveOnEnd: true` + `leaveOnEndCooldown: 300_000` — autodesconexión tras 5 min de inactividad.
     - `leaveOnStop: false` — `/stop` gestiona la desconexión de forma explícita.
     - `verifyFallbackStream: true` — verifica que el stream esté vivo.
     - `volume: 70` — **única medida de anti-saturación** (ver gotchas).
6. Responde confirmando: si fue playlist muestra título + nº de canciones encoladas; si no, el título de la pista.
7. Errores: se registran en la TUI con `logRow` (badge `ERROR`) y al usuario solo se le muestra un mensaje genérico claro; nunca se reenvía `error.message` crudo de yt-dlp/extractores (salvo los avisos de timeout `AbortError`/`Tiempo de espera agotado`).

### `normalizeUrl` — reglas de reescritura
- `music.youtube.com/watch?v=X` → `youtube.com/watch?v=X` (preserva `list=` si existe).
- `(music.)youtube.com/playlist?list=L` → `youtube.com/playlist?list=L`.
- `youtu.be/X` → `youtube.com/watch?v=X`.
- `youtube.com/watch?v=X` **sin `list=`** → limpia parámetros extra a solo `?v=X`.
- `soundcloud.com/...` → limpia query params (NO convierte a on.soundcloud.com).
- Cualquier otra cosa → se deja tal cual.

> ⚠️ **No eliminar el `list=` en URLs `watch?v=X&list=...`**: es justo lo que permite
> resolver playlists completas y radio mixes con un solo click.

---

## Flujo de eventos de reproducción (`src/events/ready.ts`)

- **`queueCreate` / `audioTrackAdd` / `audioTracksAdd`**: emite logs JSON de creación de cola y pistas/listas añadidas; para listas incluye cantidad y una muestra del orden recibido.
- **`playerStart`**: emite un log JSON con pista, posición, tamaño pendiente y tiempo desde que se encoló; actualiza el panel (embed + botones) en el canal donde se pidió la música.
- **`playerPause` / `playerResume`**: re-render del panel con estado de pausa.
- **`emptyQueue`**: log; vuelve el panel a estado "Cola vacía" (botones deshabilitados) y libera la referencia del panel.
- **`queueDelete`**: log + `updateEmptyPanel` (cubre la autodesconexión por `leaveOnEmpty`/`leaveOnEnd`) y limpieza de los Maps por guild.
- **`error` / `playerError`**: log JSON de error con la pista activa y el tamaño de cola; no rompe el bot.

Los eventos estructurados incluyen timestamp, canal y un `playbackSessionId` estable durante la vida de la cola, útil para correlacionar una sesión en la consola. No incluyen usuario ni URL completa de las pistas.

La telemetría pasiva adicional se escribe en `logs/live-trace.jsonl` cuando
`LIVE_TRACE=true` o `LOG_TO_FILE=true`. Registra eventos internos de audio/voz/debug,
errores serializados y tiempos de interacciones/extracción; puede incluir URLs para
diagnóstico. No imprime en la TUI y `logs/` está excluido de Git.

> No se usa `setFilters` ni ningún filtro ffmpeg aquí (ver gotchas CRÍTICOS abajo).

---

## Panel interactivo (`src/player/`)

### `panel.ts`
- Mantiene estado **en memoria** (Maps por `guildId`):
  - `panelMessages: guildId → Message` (mensaje del panel actual).
  - `startedAtByGuild: guildId → Date` (cuándo empezó la pista actual).
  - `panelLocks: guildId → Promise` (serializa ediciones para evitar carreras).
- `buildPanelEmbed(track, queue, startedAt, fallbackRequestedBy?)` → embed compacto estilo MatchBox:
  - `author`: «Reproduciendo» + `iconURL` con `SPINNING_DISC_GIF` (configurable por `PANEL_DISC_GIF_URL`) o «En pausa» sin icono.
  - `description` de 2 líneas: `formatPanelProgress(track, queue) • <@solicitante>` y `Por **autor**`.
  - `footer`: `Reproduciendo|En pausa • Vol N% • Cola: N • Loop: on|off` y `setTimestamp()`.
  - `startedAt` se conserva por compatibilidad; el tiempo ya no va como campo.
- `formatPanelProgress(track, queue, nowMs?)` → duración + `<t:UNIX:R>` al reproducir, `⏸️ MM:SS / MM:SS` en pausa y `En vivo` sin duración.
- `buildPanelRows(isPaused, repeatMode = 0, state?)` → **dos filas** con etiqueta corta: `panel_back` (Atrás),
  `panel_pause` (Pausar/Reanudar), `panel_skip` (Saltar), `panel_stop` (Stop), `panel_queue` (Cola) +
  `panel_loop` (Success si `repeatMode !== 0`) y `panel_shuffle` (Mezclar). `state` deshabilita por contexto.
- `updatePanel(channel, embed, rows)` → edita el panel existente o crea uno nuevo (serializado por `withPanelLock`); `rows` es un array de `ActionRowBuilder`.
- `updateEmptyPanel(channel)` → deshabilita los botones de **todas** las filas, muestra el cierre «📭 Cola finalizada» y llama a `deletePanelMessage` (libera `Message`, `startedAt` y `panelLocks`).

### `panel-buttons.ts` (`handlePanelButton`)
- Valida voz + cola activa, `deferUpdate()`, ejecuta la acción y deja el re-render a los eventos
  (`playerStart`/`playerPause`/`playerResume`); `panel_loop`/`panel_shuffle` refrescan aquí porque no emiten eventos.
- `panel_pause` → `togglePause`; `panel_skip` → `skipTrack`; `panel_back` → `backTrack` (necesita historial);
  `panel_loop` → `toggleLoop`; `panel_shuffle` → `shuffleQueue` (aviso si no hay pistas en espera);
  `panel_stop` → `stopQueue` + `updateEmptyPanel`; `panel_queue` → resumen de cola (primeros 10).
- Los botones que modifican reproducción exigen compartir canal de voz con el bot;
  consultar la cola requiere voz, pero no estar en el mismo canal.

### `controls.ts`
- `requireVoiceChannel(interaction)` → ¿el autor está en un canal de voz?
- `requireSameVoiceChannel(interaction, queue)` → ¿comparte el canal del bot?
- `getQueue(interaction)` → `useQueue(guildId)`.
- `togglePause(queue)` → alterna y devuelve `true` si quedó pausado.
- `skipTrack(queue)` → `queue.node.skip()` si hay algo reproduciéndose.
- `backTrack(queue)` → `queue.history.previous()` si hay historial.
- `toggleLoop(queue)` → `repeatMode` 1 ⇄ 0.
- `shuffleQueue(queue)` → `queue.tracks.shuffle()`.
- `clearQueue(queue)` → `queue.tracks.clear()`; `true` si había canciones.
- `removeTrack(queue, position)` → elimina la posición 1-based y devuelve la pista (o `null`).
- `skipTo(queue, position)` → `queue.node.skipTo(position - 1)` (descarta las anteriores).
- `stopQueue(queue)` → `queue.delete()`.
- Los controles que modifican la reproducción requieren estar en el mismo canal de voz
  que el bot. Consultar la cola sigue siendo de solo lectura.

### `queueSummary.ts`
- `buildQueueSummary(current, tracks)` → formato común de `/queue` y el botón `📋`.
- `buildQueueReply(current, tracks)` → muestra “cola vacía” solo si no hay pista actual
  ni canciones en espera.
- Desactiva el parseo de menciones para títulos y artistas que vienen de fuentes externas.

---

## `YouTubeDlpMixExtractor` (`src/player/extractors/youtubeDlpMix.ts`)

**Problema que resuelve:** el extractor base trataba cualquier `list=RD*` (radio mix de
YouTube, p.ej. `RDGM...`, `RDMM...`, `RDEM...`, `RDAMVM...`) como **video único**
(solo encolaba la primera canción). El usuario quería que un radio mix encolara todas
las canciones.

**Solución:** subclase `YouTubeDlpExtractor` que:
1. Detecta `isMixList(query)` (listId empieza por `RD`, `RDMM`, `RDEM`, `RDAMVM`).
2. `normalizeMixUrl`: construye `https://www.youtube.com/watch?v=X&list=L&start_radio=1`
   (o `.../playlist?...&start_radio=1`) y añade `start_radio=1`.
3. Llama al método interno `resolvePlaylist()` del padre (que sí sabe resolver mixes como
   PLaylist, vía `fetchPlaylistRaw`, usando youtubei.js con fallback yt-dlp `--flat-playlist`).
4. Si falla, delega en `super.handle()` (comportamiento original).

> Verificado: un radio mix "Mix - Jazz" (`list=RDGMEMTmC...`) resuelve **~270 tracks**.

---

## Enrutamiento de interacciones (`src/events/interactionCreate.ts`)

1. **Botones** (`InteractionType.MessageComponent` + `isButton`): si `customId` empieza por
   `panel_` → `handlePanelButton`. Si lanza error, responde ephemeral.
2. **Slash commands** (`InteractionType.ApplicationCommand`): se resuelve el comando con
   `getCommand(commandName)` desde el registro de `src/commands/index.ts` y se ejecuta con
   `execute(interaction, { player })`. Añadir un comando no requiere tocar el router.
3. Errores genéricos: `replyWithError` elige `editReply`, `followUp` o `reply` según el estado.
4. Rechazos y errores con `flags: 64` (EPHEMERAL); las confirmaciones exitosas de comandos son mini-embeds públicos.

---

## Apagado ordenado (`src/utils/shutdown.ts`)

- `registerGracefulShutdown(client, player)` se llama en `src/index.ts` tras `client.login(...)`.
- Escucha `SIGINT`, `SIGTERM`, `SIGHUP` y `SIGBREAK`; con `!process.stdin.isTTY` también `stdin` `end`/`close`.
- `createShutdownHandler({ client, player, exit?, timeoutMs? })` es idempotente (bandera `shuttingDown`):
  1. Log `STOP` «Apagando bot (señal)...» en la TUI.
  2. `setTimeout(() => exit(0), timeoutMs)` con `unref()` (3 s por defecto) como red de seguridad.
  3. Por cada cola de `player.queues.cache`: `stopQueue(queue)` + `updateEmptyPanel(channel)`.
  4. `client.user?.setActivity()`, `await client.destroy()` y `exit(0)`.
- Si una cola falla, se registra el error y se continúa con las demás.

---

## Persistencia del panel y limpieza de huérfanos (`src/player/panel/panel.ts`)

- El `messageId` del panel se persiste en `logs/panel-state.json` (mapa `{ [guildId]: { channelId, messageId } }`).
- `setPanelMessage(guildId, message, stateFilePath?)` guarda la entrada (crea el directorio si falta; ignora errores de E/S).
- `deletePanelMessage(guildId, stateFilePath?)` elimina la entrada.
- `buildClosedPanelEmbed()` es el embed compartido «📭 Cola finalizada» (color `0x5865f2`, desconexión, footer `CubitoMusic`, `setTimestamp()`), usado por `updateEmptyPanel` y por la limpieza.
- `cleanupOrphanedPanels(client, stateFilePath?)` se llama en `ready.ts` tras el banner: lee el JSON, intenta obtener canal/mensaje, si el mensaje existe y es editable lo edita con `buildClosedPanelEmbed()` y deshabilita sus `ActionRow`; independientemente del resultado elimina la entrada para no reintentarla. Ignora archivos inexistentes/vacíos/corruptos y errores de Discord (10003/10008).

---

## Manejo de errores y directrices de respuestas

- Las **confirmaciones exitosas** de comandos son mini-embeds públicos (`buildCommandEmbed`, color `0x5865f2`).
- Los **errores y rechazos** (validación de canal de voz, posición inválida, nada reproduciéndose, etc.)
  usan `flags: 64` (ephemeral) para no llenar el canal.
- `play.ts` distingue: `AbortError`/`Cancelled` (timeout → "tardó demasiado"),
  mensaje "Tiempo de espera agotado", y demás como error genérico.
- `interactionCreate.ts` registra errores y usa `replyWithError` para responder según el
  estado de la interacción; los fallos al enviar la respuesta se registran en consola.

---

# GOTCHAS CONOCIDOS (LEER ANTES DE TOCAR CÓDIGO)

## 1. CRÍTICO — NO usar filtros ffmpeg con `YouTubeDlpExtractor` (`write EPIPE`)
- El stream de este extractor viene en `$fmt: 'raw'` (PCM). Si se aplica
  `queue.filters.ffmpeg.setFilters(['normalizer2'])` (o cualquier filtro), discord-player
  lanza su propio ffmpeg para re-codificar; ese ffmpeg muere y el AudioPlayer escribe a su
  stdin cerrado → **`write EPIPE`** → la pista se corta a los ~2s y la cola se vacía.
- **La anti-saturación se hace SOLO con `nodeOptions.volume` (p.ej. `70`).**
- Además, `setFilters()` internamente llama a `triggerReplay()` que RE-ELIGE la pista en
  reproducción; por eso ni siquiera debe llamarse desde `playerStart` (aun con extractores
  que sí soporten filtros).
- Síntoma en logs: `Error en el player: write EPIPE` + `AudioPlayerError: write EPIPE`
  + `AudioResource.started: false`.

## 2. CRÍTICO — `agent.autoCookiesFromBrowser` debe estar en `false`
- El default de `discord-player-youtubedlp` intenta leer las cookies del perfil de Chrome
  → "Could not copy Chrome cookie database" → stream roto. SIEMPRE pasar
  `agent: { autoCookiesFromBrowser: false }` al registrar el extractor.

## 3. ESM — imports locales con extensión `.js`
- `import { ready } from './events/ready.js'` (NO `.ts`). tsconfig: target `ESNext`,
  module `NodeNext`. `"type": "module"` en package.json.

## 4. binarios `yt-dlp` y `ffmpeg`
- `ffmpeg` lo provee `ffmpeg-static`. `yt-dlp` lo provee `ytdlp-nodejs` (postinstall).
- Se localizan automáticamente. Usar `setFFmpegPath`/`setYtDlpPath` solo si hay problemas.

## 5. `leaveOn*` y desconexión
- `leaveOnEmpty: true` + `leaveOnEmptyCooldown: 300_000` y `leaveOnEnd: true` + `leaveOnEndCooldown: 300_000`:
  el bot abandona el canal tras **5 minutos** de inactividad (cola vacía o fin de la cola).
- `leaveOnStop: false`: `/stop` desconecta de inmediato por su cuenta.
- Añadir una pista nueva durante el cooldown cancela el temporizador (discord-player reinicia los timers).

## 6. Spotify / cookies de YouTube
- Spotify sin `SPOTIFY_CLIENT_ID/SECRET` degrada (usa búsqueda). Con credenciales, resuelve
  track URL a YouTube.
- **NO usar `YOUTUBE_COOKIE` en `.env`** para cookies de YouTube (el bot no la lee;
  además quedó una línea malformada con `:` en el pasado). Si algún día se quieren cookies,
  pasar `agent.cookies` al registrar el extractor. Decisión previa: se descartaron cookies,
  se usa yt-dlp.

## 7. Tests automáticos
- `npm test` ejecuta las pruebas con `tsx --test`; cubren estado del panel, respuestas de cola,
  límites de resumen, autorización por canal de voz y reconocimiento de interacciones.
- La validación de reproducción sigue requiriendo QA manual en Discord (arrancar el bot,
  probar en un canal de voz y revisar la consola).
- Para debug rápido de un extractor sin bot: script `tsx` que registra el extractor y
  llama `player.search(url, { searchEngine: 'ext:...' })`.

---

## Notas sobre fuentes de música

- **YouTube / YouTube Music:** mismo extractor (YouTubeDlpMixExtractor). YTM soporta el
  prefijo `ytmusic:` y playlists/álbumes (OLAK) se resuelven como playlist.
- **Playlists (`PL`, `OLAK`)**: encolan cada track.
- **Radio mixes (`RD*`)**: ahora también encolan todas las canciones (gracias al MixExtractor).
- **Spotify:** requiere credenciales; resuelve vía puente (bridge) a YouTube.
- **SoundCloud:** extractor default.
- **Rate limits:** no spamear `/play`; la resolución de playlists largas puede tardar
  (timeout de 30s por operación).

---

## Cómo probar / verificar (QA manual)

1. `npm run dev` (o `npx tsx src/index.ts`). Ver el log:
   `✅ Bot listo como: CubitosMusic#0843` y `📋 Extractores: ... YouTubeDlpMixExtractor(p100)`.
2. Probar en Discord (estar en un canal de voz):
   - `/play` con un video YouTube (debe sonar, sin EPIPE).
   - `/play` con algo de YouTube Music.
   - `/play` con una playlist larga (comprobar `/queue` con N canciones).
   - `/play` con un radio mix `list=RD...` (debe encolar muchas canciones).
   - Botones del panel: ⏮ ⏸ ⏭ ⏹ 📋.
   - `/loop`, `/shuffle`, `/nowplaying`, `/pause`, `/skip`, `/stop`, `/queue`.
   - `/clear`, `/remove <posicion>`, `/skipto <posicion>` con una cola de varios temas.
3. Si algo falla, revisar el log del proceso (consola o redirección p.ej.
   `npx tsx src/index.ts > /tmp/bot-ytdlp.log 2>&1`).

---

## Roadmap sugerido / posibles mejoras

- **Más tests automatizados** para `normalizeUrl` y el `YouTubeDlpMixExtractor`.
- **Comandos globales** (no solo guild) cuando se quiera escalar a varios servidores.
- **Sistema de cookies opcional** para combatir bloqueos de YouTube si yt-dlp dejara de funcionar.
- **Persistencia de cola** entre reinicios (hoy la cola vive en memoria).
- **Auto-desconexión** configurable por guild (hoy fija a 5 min vía `leaveOn*Cooldown`).
- **Soporte de `autoplay`** (canciones relacionadas) opcional.
- **Rate limiter / anti-spam** para `/play`.

---

## Referencia rápida de archivos

| Archivo | Qué hace |
|---------|----------|
| `src/index.ts` | Bootstrap, intents, registro de extractores, login |
| `src/config.ts` | Validación tipada del entorno (`BotConfig`) |
| `scripts/deploy-commands.ts` | Registro de slash commands (guild o `--global`) |
| `src/commands/index.ts` | Registro tipado de comandos (router + deploy) |
| `src/commands/music/*.ts` | Handler por comando |
| `src/events/ready.ts` | Eventos del Player + panel |
| `src/events/interactionCreate.ts` | Router interactivo |
| `src/player/extractors/youtubeDlpMix.ts` | Extractores de radio mixes |
| `src/player/panel/panel.ts` | Estado y render del panel |
| `src/player/panel/panel-buttons.ts` | Lógica de botones |
| `src/player/controls.ts` | Utilidades de reproducción |
| `src/player/url.ts` | `normalizeUrl` (con tests de tabla) |
| `src/types/commands.ts` | Contrato `Command` del registro |
| `tests/` | Pruebas de regresión (`node:test`) |
| `docs/ARCHITECTURE.md` | Este documento |
| `docs/SETUP.md` | Guía de instalación paso a paso |
| `AGENTS.md` | Guía de contexto para agentes (mantener al día) |