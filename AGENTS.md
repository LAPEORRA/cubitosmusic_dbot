# AGENTS.md

## Proyecto
Bot Discord **CubitoMusic**: discord.js v14, TypeScript estricto + ESM, discord-player v7.
Audio desde YouTube (yt-dlp + youtubei.js), YouTube Music, Spotify y SoundCloud. Slash commands de guild + panel interactivo.

- **Documento canónico:** `docs/ARCHITECTURE.md` — lo más completo y actualizado del proyecto. Léelo antes de tocar reproducción. Este archivo es guía rápida; mantenlo en sintonía y sincroniza la arquitectura si algo cambia.
- **Último estable:** tag `v1.1.0` = `main` en GitHub. Si entramos en un bucle/error crítico: descartar cambios locales y volver a `main`.

## Restricción dura: la reproducción está CONGELADA
Fue estabilizada tras mucho trabajo. **NO modificar:**
- `src/commands/music/play.ts` — `searchEngine`, `signal`, `nodeOptions`, `volume: 70` (la normalización vive en `src/player/url.ts`, ya testeada)
- `src/player/extractors/youtubeDlpMix.ts` — resolución de radio mixes (`list=RD*`) como playlist
- Registro de extractores en `src/index.ts` (orden y opciones importan)
- Ningún filtro ffmpeg (`setFilters` rompe el extractor, ver gotchas)

**Área de trabajo activa = presentación/pulido:**
- `src/player/panel/panel.ts` — embed, botones, estado "cola vacía"
- `src/player/panel/panel-buttons.ts` — resumen de cola del botón `📋`
- Texto/emojis de respuestas en `src/commands/music/*.ts`
- Branding: color de embed `0x5865f2`, copy en español

## Stack
- Node 22+ (dev actual: 24). discord.js `^14.27.0`, discord-player `^7.2.0`, @discordjs/voice `^0.19.2`, @discord-player/extractor `^7.2.0`, discord-player-youtubedlp `^1.2.2`, ffmpeg-static `^5.3.0`, tsx `^4.23.15`.

## Comandos
- `npm run dev` — `tsx src/index.ts`. **Sin `--watch`** (no auto-restart); úsalo si solo quieres verificar que arranca. Hot reload: `npx tsx watch src/index.ts`
- `npm run build` — `tsc` → `dist/`
- `npm run typecheck` — `tsc --noEmit` + `tsc -p tsconfig.test.json` (cubre `tests/` y `scripts/`)
- `npm start` — `node dist/index.js`
- `npm run deploy-commands` — registro de comandos **de guild** (instantáneo). `npm run deploy-commands -- --global` para registro global (~1h)
- `npm test` — ejecuta las pruebas de regresión con `tsx --test`
- `package-lock.json` se versiona; usar `npm ci` para instalaciones reproducibles

## Entorno (`.env`)
- Obligatorias (el bot aborta si faltan): `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`
- Opcionales: `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (mejoran Spotify; sin ellas degrada a búsqueda)
- Nunca commitear `.env`. **NO usar `YOUTUBE_COOKIE`** (el bot no la lee; las cookies de YouTube van por `agent.cookies` al registrar el extractor, hoy descartadas)

## Arquitectura (real)
```
src/
├── index.ts                  — Bootstrap: Client, Player, credenciales Spotify, registro de extractores, login
├── config.ts                 — Validación tipada del entorno (BotConfig); aborta si falta algo obligatorio
├── commands/
│   ├── index.ts              — Registro tipado (fuente única para router y deploy)
│   └── music/                — Cada handler exporta `data` + run
│       ├── play.ts           — /play <url|búsqueda> (único que llama a player.play)
│       ├── skip.ts stop.ts queue.ts pause.ts loop.ts shuffle.ts nowplaying.ts
├── events/
│   ├── ready.ts              — Eventos del Player, logs JSON de reproducción y render del panel
│   ├── interactionCreate.ts  — Router: customIds `panel_*` → handlePanelButton; ApplicationCommand → getCommand()
│   └── interactionResponses.ts — Respuesta de error según el estado de la interacción
├── player/
│   ├── panel/panel.ts        — Estado en memoria del panel + builders de embed/botones + updatePanel/updateEmptyPanel
│   ├── panel/panel-buttons.ts — handlePanelButton (pause/skip/back/stop/queue)
│   ├── extractors/youtubeDlpMix.ts — YouTubeDlpMixExtractor (radio mixes → playlist)
│   ├── controls.ts           — helpers; los controles requieren compartir canal de voz con el bot
│   ├── queueSummary.ts       — Formato compartido de la cola en el comando y el panel
│   ├── url.ts                — normalizeUrl (extraído de play.ts, con tests de tabla)
│   └── audioPreset.ts        — Preset de compresor DSP por cola
└── types/
    ├── index.ts              — Tipos compartidos
    └── commands.ts           — Contrato Command / CommandContext / CommandCategory
├── utils/
│   └── logger.ts            — Consola TUI: ANSI, banner, tabla de logs, métricas y logs a archivo
tests/                        — Pruebas (commands, events, player, utils) con node:test
scripts/deploy-commands.ts    — Registro de comandos vía REST (usa el registro del router)
```

- Logs de reproducción en consola: JSON por evento (`queue_created`, `tracks_queued`,
  `playback_started`, errores y fin/borrado de cola), correlacionados con
  `playbackSessionId`; incluyen secuencia observada, cola pendiente y tiempo desde que se encoló cada pista.

## Flujos clave
- **Control de reproducción**: `/pause`, `/skip`, `/stop`, `/loop`, `/shuffle` y los botones que modifican la reproducción solo funcionan desde el mismo canal de voz que el bot.
- **`/play`**: `normalizeUrl` (en `src/player/url.ts`) → elige `searchEngine` por dominio (youtube.com → ytdlp, spotify.com → spotify, soundcloud.com → soundcloud, resto auto) → `player.play(channel, query, { signal: AbortSignal.timeout(30_000), searchEngine, nodeOptions })`. `nodeOptions`: `metadata {channel, requestedBy}`, `leaveOn*: false` (el bot NO se desconecta solo; lo gestiona `/stop`), `verifyFallbackStream: true`, `volume: 70` (única anti-saturación).
- **Panel**: los eventos de `playerStart`/pause/resume en `ready.ts` re-renderizan el embed en el canal de `queue.metadata.channel`. Estado por guild en Maps de `panel.ts` (`panelMessages`, `startedAtByGuild`, `panelLocks` — serializa ediciones). Si el mensaje ya no es editable, `updatePanel` lo borra y crea uno nuevo. `emptyQueue`/stop → `updateEmptyPanel` (botones deshabilitados).
- **Botones**: contrato de ruteo = customIds `panel_back`, `panel_pause`, `panel_skip`, `panel_stop`, `panel_queue`. Nuevos botones deben seguir ese prefijo `panel_`.

## Gotchas críticos (reproducción — leer antes de tocar nada)
1. **NO `queue.filters.ffmpeg.setFilters(...)`**: el stream de YouTubeDlpExtractor viene en `$fmt: 'raw'` (PCM) y el FFmpegFilterer lanza su propio ffmpeg que muere → `write EPIPE` → la pista se corta ~2s y se vacía la cola. `setFilters` además dispara `triggerReplay()` (re-elige la pista), así que no se llama ni desde `playerStart`.
2. **`agent: { autoCookiesFromBrowser: false }` SIEMPRE** al registrar el extractor (si no, intenta leer cookies de Chrome y rompe el stream).
3. **`leaveOn*: false`**: la desconexión del bot la hace `/stop` o el borrado de cola; no sale solo del canal.
4. **Binarios**: `yt-dlp.exe` lo descarga `ytdlp-nodejs` en postinstall (requiere `allowScripts` o `npm approve-scripts`), `ffmpeg` lo da `ffmpeg-static`. Se auto-localizan; `setFFmpegPath`/`setYtDlpPath` solo si hay problemas.
5. **ESM**: imports locales con extensión `.js` (`from './foo.js'`). tsconfig: target ESNext, module NodeNext, strict.

## Convenciones
- Respuestas al usuario en **español**, siempre `flags: 64` (ephemeral).
- Verificación: `npm test` + `npm run build` (typecheck) y QA manual de reproducción en Discord (canal privado; log a consola).
- Al cambiar la definición de un comando (`data`), re-ejecutar `npm run deploy-commands`.
- **Añadir un comando**: crear `src/commands/<categoría>/<nombre>.ts` con `data` + run, importarlo en `src/commands/index.ts` y añadir su entrada. El router y el deploy se actualizan solos (no hay `switch` ni listas manuales).
- No spamear `/play` (rate limits y resoluciones de playlist lentas; timeout 30s por operación).
