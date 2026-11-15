# AGENTS.md

## Roles y fuente de verdad
- El repositorio es la fuente de verdad del proyecto; no dependas de chats ni de copiar/pegar manual como estado canónico.
- **Product Owner:** Santiago define el objetivo y aprueba decisiones durante el trabajo.
- **Arquitecto/auditor externo:** Gemini analiza contexto, diffs o logs y propone la solución mediante un prompt atómico; no ejecuta cambios locales.
- **Ejecutores:** OpenCode y GitHub Copilot implementan el prompt explícito, siguen estas reglas, ejecutan las verificaciones y reportan resultados. No se adelantan a decisiones de arquitectura.

## Inicio de sesión
Antes de tocar código:
1. Ejecuta `git fetch origin` y `git status --short --branch`.
2. Informa si la rama está adelantada, atrasada o divergente, y señala cambios locales o conflictos que deban preservarse.
3. Lee `AGENTS.md` y `HANDOFF.md` para recuperar las restricciones y el punto exacto del trabajo.

## Inicialización de proyectos (solo cuando se solicite)
- Detecta el stack y la estructura reales antes de crear instrucciones.
- `AGENTS.md` debe documentar stack, estructura, comandos de verificación, zonas congeladas (vacías inicialmente) y Checklist de Cierre.
- Crea `.github/copilot-instructions.md` como puntero corto a `AGENTS.md` y a la lectura/actualización de `HANDOFF.md`.
- Crea `HANDOFF.md` con fecha, objetivo, estado de pruebas, último commit y pendientes.
- Añade un comando `npm run context` o equivalente para exportar el contexto fuente; excluye artefactos generados y añade el archivo exportado a `.gitignore`.

## Proyecto
Bot Discord **CubitoMusic**: discord.js v14, TypeScript estricto + ESM, discord-player v7.
Audio desde YouTube (yt-dlp + youtubei.js), YouTube Music, Spotify y SoundCloud. Slash commands de guild + panel interactivo.

- **Documento canónico:** `docs/ARCHITECTURE.md` — lo más completo y actualizado del proyecto. Léelo antes de tocar reproducción. Este archivo es guía rápida; mantenlo en sintonía y sincroniza la arquitectura si algo cambia.
- **Último estable:** tag `v1.1.0` = `main` en GitHub. Si entramos en un bucle/error crítico: descartar cambios locales y volver a `main`.

## Restricción dura: la reproducción está CONGELADA
Fue estabilizada tras mucho trabajo. **NO modificar:**
- `src/commands/music/play.ts` — `searchEngine`, `signal`, `volume: 70` y el resto de `nodeOptions` (hoy: auto-desconexión a los 5 min; no tocar sin pedido explícito)
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
- Opcionales: `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (mejoran Spotify; sin ellas degrada a búsqueda), `PANEL_DISC_GIF_URL` (GIF del autor del panel mientras suena; por defecto un GIF público de música)
- Nunca commitear `.env`. **NO usar `YOUTUBE_COOKIE`** (el bot no la lee; las cookies de YouTube van por `agent.cookies` al registrar el extractor, hoy descartadas)

## Arquitectura (real)
```
src/
├── index.ts                  — Bootstrap: Client, Player, credenciales Spotify, registro de extractores, login
├── config.ts                 — Validación tipada del entorno (BotConfig); aborta si falta algo obligatorio
├── commands/
│   ├── index.ts              — Registro tipado (fuente única para router y deploy)
│   ├── music/                — Cada handler exporta `data` + run
│   │   ├── play.ts           — /play <url|búsqueda> (único que llama a player.play)
│   │   ├── skip.ts stop.ts queue.ts pause.ts loop.ts shuffle.ts nowplaying.ts
│   └── utility/help.ts       — /help dinámico (agrupa el registro por categoría)
├── events/
│   ├── ready.ts              — Eventos del Player, logs JSON de reproducción y render del panel
│   ├── interactionCreate.ts  — Router: customIds `panel_*` → handlePanelButton; ApplicationCommand → getCommand()
│   └── interactionResponses.ts — Respuesta de error según el estado de la interacción
├── player/
│   ├── panel/panel.ts        — Estado en memoria del panel + builders de embed/botones + updatePanel/updateEmptyPanel
│   ├── panel/panel-buttons.ts — handlePanelButton (pause/skip/back/stop/queue/loop/shuffle)
│   ├── extractors/youtubeDlpMix.ts — YouTubeDlpMixExtractor (radio mixes → playlist)
│   ├── controls.ts           — helpers; los controles requieren compartir canal de voz con el bot
│   ├── queueSummary.ts       — Formato compartido de la cola en el comando y el panel
│   ├── url.ts                — normalizeUrl (extraído de play.ts, con tests de tabla)
│   └── audioPreset.ts        — Preset de compresor DSP por cola
└── types/
    ├── index.ts              — Tipos compartidos
    └── commands.ts           — Contrato Command / CommandContext / CommandCategory
├── utils/
│   ├── commandEmbed.ts      — Mini-embed público de confirmaciones (color de marca, URLs validadas)
│   ├── logger.ts            — Consola TUI: ANSI, banner, tabla de logs, métricas y logs a archivo
│   └── shutdown.ts          — Apagado ordenado (señales, stop de colas, panel y cierre del cliente)
tests/                        — Pruebas (commands, events, player, utils) con node:test
scripts/deploy-commands.ts    — Registro de comandos vía REST (usa el registro del router)
```

- Logs de reproducción en consola: JSON por evento (`queue_created`, `tracks_queued`,
  `playback_started`, errores y fin/borrado de cola), correlacionados con
  `playbackSessionId`; incluyen secuencia observada, cola pendiente y tiempo desde que se encoló cada pista.

## Flujos clave
- **Control de reproducción**: `/pause`, `/skip`, `/stop`, `/loop`, `/shuffle` y los botones que modifican la reproducción solo funcionan desde el mismo canal de voz que el bot.
- **`/stop`**: `stopQueue()` vacía la cola (`queue.tracks.clear()`), desconecta la voz y borra la cola; el comando captura `channel` antes del borrado para deshabilitar el panel.
- **`/pause`**: alterna pausa/reanudación si existe `currentTrack` (también durante `buffering`), igual que el botón `panel_pause`.
- **`/help`**: lista el registro (`src/commands/index.ts`) agrupado por `category`; usa import dinámico de `../index.js` para evitar el ciclo ESM y responde con un mini-embed público (`buildCommandEmbed`).
- **`/play`**: `normalizeUrl` (en `src/player/url.ts`) → elige `searchEngine` por dominio (youtube.com → ytdlp, spotify.com → spotify, soundcloud.com → soundcloud, resto auto) → `player.play(channel, query, { requestedBy, signal: AbortSignal.timeout(30_000), searchEngine, nodeOptions })`. `nodeOptions`: `metadata {channel}`, `leaveOnEmpty/leaveOnEnd: true` con `*Cooldown: 300_000` (auto-desconexión tras 5 min), `leaveOnStop: false`, `verifyFallbackStream: true`, `volume: 70` (única anti-saturación). `requestedBy` va a nivel de pista, no en `metadata`.
- **Panel**: los eventos de `playerStart`/pause/resume en `ready.ts` re-renderizan el embed en el canal de `queue.metadata.channel`. El embed es compacto: `author` «Reproduciendo» + `PANEL_DISC_GIF_URL` (o «En pausa» sin icono), `description` de 2 líneas con `formatPanelProgress()` (duración + `<t:UNIX:R>` al reproducir, timecodes congelados en pausa; `/nowplaying` conserva la barra ASCII) + mención del solicitante + autor, y `footer` de estado (`Vol`, `Cola`, `Loop`) con `setTimestamp()`. Botones con etiqueta corta mantienen el prefijo `panel_*` y el `state` de `PanelRowState`. Estado por guild en Maps de `panel.ts` (`panelMessages`, `startedAtByGuild`, `panelLocks` — serializa ediciones). Si el mensaje ya no es editable, `updatePanel` lo borra y crea uno nuevo. `emptyQueue`/`queueDelete`/stop → `updateEmptyPanel` (cierre «📭 Cola finalizada» + botones deshabilitados) y `deletePanelMessage` libera los tres Maps para que no crezcan indefinidamente. El `messageId` del panel se persiste en `logs/panel-state.json` (`setPanelMessage`/`deletePanelMessage`); al arrancar, `ready.ts` llama a `cleanupOrphanedPanels(client)` para cerrar paneles huérfanos de sesiones anteriores.
- **Botones**: contrato de ruteo = customIds `panel_back`, `panel_pause`, `panel_skip`, `panel_stop`, `panel_queue`, `panel_loop`, `panel_shuffle`. Nuevos botones deben seguir ese prefijo `panel_`.
- **Apagado ordenado**: `src/utils/shutdown.ts` (`registerGracefulShutdown`, conectado en `index.ts` tras `client.login`) escucha `SIGINT`/`SIGTERM`/`SIGHUP`/`SIGBREAK` y, sin TTY, `stdin` `end`/`close`. Es idempotente: registra `STOP` en la TUI, arma un timeout de seguridad (3 s), detiene cada cola con `stopQueue` + `updateEmptyPanel`, limpia la presencia, `client.destroy()` y `exit(0)`.

## Gotchas críticos (reproducción — leer antes de tocar nada)
1. **NO `queue.filters.ffmpeg.setFilters(...)`**: el stream de YouTubeDlpExtractor viene en `$fmt: 'raw'` (PCM) y el FFmpegFilterer lanza su propio ffmpeg que muere → `write EPIPE` → la pista se corta ~2s y se vacía la cola. `setFilters` además dispara `triggerReplay()` (re-elige la pista), así que no se llama ni desde `playerStart`.
2. **`agent: { autoCookiesFromBrowser: false }` SIEMPRE** al registrar el extractor (si no, intenta leer cookies de Chrome y rompe el stream).
3. **`leaveOn*`**: `leaveOnEmpty`/`leaveOnEnd` están en `true` con cooldown de 300000 ms (5 min); `leaveOnStop` sigue en `false` porque `/stop` ya gestiona la desconexión. `stopQueue()` vacía `tracks` y desconecta antes de `queue.delete()` para evitar extracciones durante el desmontaje.
4. **Binarios**: `yt-dlp.exe` lo descarga `ytdlp-nodejs` en postinstall (requiere `allowScripts` o `npm approve-scripts`), `ffmpeg` lo da `ffmpeg-static`. Se auto-localizan; `setFFmpegPath`/`setYtDlpPath` solo si hay problemas.
5. **ESM**: imports locales con extensión `.js` (`from './foo.js'`). tsconfig: target ESNext, module NodeNext, strict.

## Convenciones
- Respuestas al usuario en **español**. Las confirmaciones exitosas de comandos son **mini-embeds públicos** (`buildCommandEmbed` de `src/utils/commandEmbed.ts`, color `0x5865f2`); los **errores y rechazos** (validación de canal de voz, posición inválida, nada reproduciéndose…) usan `flags: 64` (ephemeral) para no ensuciar el chat.
- Verificación: `npm test` + `npm run build` (typecheck) y QA manual de reproducción en Discord (canal privado; log a consola).
- Al cambiar la definición de un comando (`data`), re-ejecutar `npm run deploy-commands`.
- **Añadir un comando**: crear `src/commands/<categoría>/<nombre>.ts` con `data` + run, importarlo en `src/commands/index.ts` y añadir su entrada. El router y el deploy se actualizan solos (no hay `switch` ni listas manuales).
- No spamear `/play` (rate limits y resoluciones de playlist lentas; timeout 30s por operación).

## Cierre de tarea (obligatorio para cualquier agente)

Antes de dar por terminado un bloque de trabajo:

1. **Verificación obligatoria**
   - `npm run typecheck` → 0 errores.
   - `npm test` → todos en verde.
   - `npm run build` → OK.
2. **Estado vivo (`HANDOFF.md`)**
   - Leer `HANDOFF.md` antes de escribir.
   - Actualizar con: fecha, último commit, conteo de tests en verde, quién actualizó (OpenCode/Copilot/Usuario) y pendientes.
3. **Puntero de Copilot**
   - Verificar que `.github/copilot-instructions.md` siga apuntando a estas instrucciones y a `HANDOFF.md`.
4. **Zonas congeladas**
   - No tocar `src/commands/music/play.ts`, `src/player/extractors/youtubeDlpMix.ts` ni el registro de extractores en `src/index.ts` sin pedido explícito.
5. **Commit propuesto**
   - Reportar un commit atómico con mensaje Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) adecuado al cambio.
   - No crear commits ni hacer push salvo pedido explícito del usuario.
