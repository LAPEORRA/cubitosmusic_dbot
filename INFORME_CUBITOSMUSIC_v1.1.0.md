# Informe Técnico - CubitoMusic Bot

> **Propósito de este documento**: servir de guía completa para un agente futuro
> (humano o IA) que deba mantener, extender o corregir este bot. Describe arquitectura,
> flujo de datos, decisiones de diseño, gotchas conocidos y cómo reproducir/probar cada
> funcionalidad.

## Estado Actual (v1.1.0) — último commit verificado

- **Bot activo** en Discord: CubitosMusic#0843
- **Guild de desarrollo:** Cubitos Dubidu (ID: `1016533561295245332`)
- **Repositorio:** https://github.com/LAPEORRA/cubitosmusic_dbot (rama `main`)
- **Tag estable:** `v1.1.0` (reproducción yt-dlp + radio mixes + panel interactivo)
- **GitHub Pages (legal):** https://lapeorra.github.io/cubitosmusic_dbot/ (`terms.html` / `privacy.html`)

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
| Panel interactivo con botones (⏮ ⏸ ⏭ ⏹ 📋) | ✅ |
| Anti-saturación de audio (volumen 70%, sin filtros ffmpeg) | ✅ |
| GitHub Pages (terms + privacy) | ✅ |

---

## Stack Técnico

- **Runtime:** Node.js 20+ (desarrollo actual: Node 24)
- **Lenguaje:** TypeScript estricto + ESM (`"type": "module"`)
- **Discord:** discord.js v14 (`^14.27.0`)
- **Motor de música:** discord-player v7 (`^7.2.0`)
- **Voz:** @discordjs/voice (`^0.19.2`)
- **Extractores:**
  - `@discord-player/extractor` (`^7.2.0`) → DefaultExtractors (SoundCloud, Spotify, AppleMusic, Vimeo, Reverbnation, Attachment)
  - `discord-player-youtubedlp` (`^1.2.2`) → YouTubeDlpExtractor (yt-dlp + youtubei.js)
  - Clase custom `YouTubeDlpMixExtractor` (subclase, en `src/player/youtubeDlpMix.ts`)
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
npm run dev                # Arranca el bot en modo watch (tsx)
npm run build              # Compila con tsc a dist/
npm start                  # Ejecuta node dist/index.js (producción)
npm run deploy-commands    # Registra los slash commands en la guild (REST)
```

> `deploy-commands.ts` registra comandos **de guild** (instantáneo, vía `GUILD_ID`).
> El registro global tarda hasta 1h y no se usa aquí.

---

## Arquitectura del Proyecto

```
src/
├── index.ts                  — Bootstrap: client, Player, registro de extractores, login
├── commands/                 — Handlers de slash commands (cada uno exporta data + run)
│   ├── play.ts               — /play <url|búsqueda> (normaliza URLs, elige extractor)
│   ├── skip.ts               — /skip
│   ├── stop.ts               — /stop (borra cola + panel vacío)
│   ├── queue.ts              — /queue (lista cola, 10 primeros)
│   ├── pause.ts              — /pause /resume (toggle)
│   ├── loop.ts               — /loop (repeatMode 1 <-> 0)
│   ├── shuffle.ts            — /shuffle (mezcla la cola)
│   └── nowplaying.ts         — /nowplaying (info + barra de progreso)
├── events/
│   ├── ready.ts              — Suscripción a eventos del Player + panel
│   └── interactionCreate.ts  — Router de interacciones (botones y slash commands)
├── player/
│   ├── youtubeDlpMix.ts      — YouTubeDlpMixExtractor (radio mixes como playlist)
│   ├── panel.ts              — Panel interactivo (embed + botones + locks por guild)
│   ├── panel-buttons.ts      — Handler de botones del panel
│   └── controls.ts           — Utilidades: pause/skip/back/loop/shuffle/stop/voice check
└── types/
    └── index.ts              — Tipos compartidos (MusicQueue, BotConfig) — hoy poco usados
```

**deploy-commands.ts** — registro de comandos vía REST (raíz del proyecto).

---

## Flujo de arranque (`src/index.ts`)

1. `dotenv/config` carga `.env`.
2. Valida `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (aborta si falta).
3. Crea `Client` (discord.js) con intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `GuildMembers`.
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

## Flujo de `/play` (`src/commands/play.ts`)

1. `interaction.deferReply({ flags: 64 })` (ephemeral) para ganar tiempo; si ya estaba respondida, aborta.
2. Lee `query` y la normaliza con `normalizeUrl`.
3. Selecciona `searchEngine` según el contenido de la URL:
   - `youtube.com` → `'ext:com.dfxphoenix.youtubedlp-extractor'`
   - `spotify.com` → `'ext:com.discord-player.spotifyextractor'`
   - `soundcloud.com` → `'ext:com.discord-player.soundcloudextractor'`
   - resto (búsqueda de texto o desconocido) → `undefined` (detección automática)
4. Valida que el usuario esté en un canal de voz.
5. `player.play(channel, query, { signal, searchEngine, nodeOptions })`.
   - `signal: AbortSignal.timeout(30_000)` — protege contra AsyncQueue bloqueado por playlists largas.
   - `nodeOptions`:
     - `metadata: { channel, requestedBy }` — usados por el panel y los botones.
     - `leaveOnEmpty: false`, `leaveOnEnd: false`, `leaveOnStop: false` — **el bot NO se desconecta solo**; la desconexión la gestiona `/stop` o el borrado de cola.
     - `verifyFallbackStream: true` — verifica que el stream esté vivo.
     - `volume: 70` — **única medida de anti-saturación** (ver gotchas).
6. Responde confirmando: si fue playlist muestra título + nº de canciones encoladas; si no, el título de la pista.

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

- **`playerStart`**: log; actualiza el panel (embed + botones) en el canal donde se pidió la música.
- **`playerPause` / `playerResume`**: re-render del panel con estado de pausa.
- **`emptyQueue`**: log; vuelve el panel a estado "Cola vacía" (botones deshabilitados).
- **`queueDelete`**: log informativo.
- **`error` / `playerError`**: log del error (`console.error`). No rompe el bot.

> No se usa `setFilters` ni ningún filtro ffmpeg aquí (ver gotchas CRÍTICOS abajo).

---

## Panel interactivo (`src/player/`)

### `panel.ts`
- Mantiene estado **en memoria** (Maps por `guildId`):
  - `panelMessages: guildId → Message` (mensaje del panel actual).
  - `startedAtByGuild: guildId → Date` (cuándo empezó la pista actual).
  - `panelLocks: guildId → Promise` (serializa ediciones para evitar carreras).
- `buildPanelEmbed(track, queue, startedAt, requestedBy)` → embed con progreso, cola, comandos.
- `buildPanelRows(isPaused)` → fila de 5 botones: `panel_back`, `panel_pause`, `panel_skip`, `panel_stop`, `panel_queue`.
- `updatePanel(channel, embed, rows)` → edita el panel existente o crea uno nuevo (serializado por `withPanelLock`).
- `updateEmptyPanel(channel)` → deshabilita los botones y pone "Cola vacía".

### `panel-buttons.ts` (`handlePanelButton`)
- Valida voz + cola activa, `deferUpdate()`, ejecuta la acción y re-renderiza el panel.
- `panel_pause` → `togglePause`; `panel_skip` → `skipTrack`; `panel_back` → `backTrack` (necesita historial);
  `panel_stop` → `stopQueue` + `updateEmptyPanel`; `panel_queue` → resumen de cola (primeros 10).

### `controls.ts`
- `requireVoiceChannel(interaction)` → ¿el autor está en un canal de voz?
- `getQueue(interaction)` → `useQueue(guildId)`.
- `togglePause(queue)` → alterna y devuelve `true` si quedó pausado.
- `skipTrack(queue)` → `queue.node.skip()` si hay algo reproduciéndose.
- `backTrack(queue)` → `queue.history.previous()` si hay historial.
- `toggleLoop(queue)` → `repeatMode` 1 ⇄ 0.
- `shuffleQueue(queue)` → `queue.tracks.shuffle()`.
- `stopQueue(queue)` → `queue.delete()`.

---

## `YouTubeDlpMixExtractor` (`src/player/youtubeDlpMix.ts`)

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
2. **Slash commands** (`InteractionType.ApplicationCommand`): `switch(commandName)`.
3. Errores genéricos: si `deferred` → `editReply`; si no y no respondido → `reply`.
4. Todo con `flags: 64` (EPHEMERAL).

---

## Manejo de errores y directrices de respuestas

- Todas las respuestas usan `flags: 64` (ephemeral) para no llenar el canal.
- `play.ts` distingue: `AbortError`/`Cancelled` (timeout → "tardó demasiado"),
  mensaje "Tiempo de espera agotado", y demás como error genérico.
- `interactionCreate.ts` y `panel-buttons.ts` tienen try/catch que responden elegantemente
  ante "already acknowledged"/"unknown interaction" (usa `catch(() => {})` silencioso).

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

## 5. `leaveOn*: false` y desconexión
- Con los tres `leaveOn*` en `false`, el bot NO sale del canal al vaciarse la cola.
  La cola se elimina con `/stop` (o `emptyQueue` si hubo un error). El bot queda en el
  canal "en espera". Si se quiere auto-desconexión, tocar `nodeOptions`.

## 6. Spotify / cookies de YouTube
- Spotify sin `SPOTIFY_CLIENT_ID/SECRET` degrada (usa búsqueda). Con credenciales, resuelve
  track URL a YouTube.
- **NO usar `YOUTUBE_COOKIE` en `.env`** para cookies de YouTube (el bot no la lee;
  además quedó una línea malformada con `:` en el pasado). Si algún día se quieren cookies,
  pasar `agent.cookies` al registrar el extractor. Decisión previa: se descartaron cookies,
  se usa yt-dlp.

## 7. No hay tests automáticos
- `npm test` sigue con el placeholder por defecto. La validación se hace manualmente
  (arrancar bot + probar en Discord + revisar `/tmp/bot-ytdlp.log`).
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
3. Si algo falla, revisar el log del proceso (consola o redirección p.ej.
   `npx tsx src/index.ts > /tmp/bot-ytdlp.log 2>&1`).

---

## Roadmap sugerido / posibles mejoras

- **Tests automatizados** (vitest/jest) para `normalizeUrl` y el `YouTubeDlpMixExtractor`.
- **Comandos globales** (no solo guild) cuando se quiera escalar a varios servidores.
- **Sistema de cookies opcional** para combatir bloqueos de YouTube si yt-dlp dejara de funcionar.
- **Persistencia de cola** entre reinicios (hoy la cola vive en memoria).
- **Auto-desconexión** configurable por guild (hoy `leaveOn*: false` fijos).
- **Soporte de `autoplay`** (canciones relacionadas) opcional.
- **Rate limiter / anti-spam** para `/play`.

---

## Referencia rápida de archivos

| Archivo | Qué hace |
|---------|----------|
| `src/index.ts` | Bootstrap, intents, registro de extractores, login |
| `deploy-commands.ts` | Registro de slash commands (guild) |
| `src/commands/*.ts` | Handler por comando |
| `src/events/ready.ts` | Eventos del Player + panel |
| `src/events/interactionCreate.ts` | Router interactivo |
| `src/player/youtubeDlpMix.ts` | Extractores de radio mixes |
| `src/player/panel.ts` | Estado y render del panel |
| `src/player/panel-buttons.ts` | Lógica de botones |
| `src/player/controls.ts` | Utilidades de reproducción |
| `src/types/index.ts` | Tipos compartidos (poco usados) |
| `AGENTS.md` | Guía de contexto para agentes (mantener al día) |