# Handoff — CubitoMusic

> Documento de traspaso de sesión: estado del proyecto al **25-nov-2026** para retomar en una sesión fresca.

## Estado actual

- **Carpeta activa:** `D:\cubitosmusic` (reubicado desde `D:\Proyectos_Opencode`).
- **Git:** rama `main`, `HEAD` en `7e2f744` (sincronizado con `origin/main` tras el despliegue). Los ajustes de `yt-dlp-ejs` en `Dockerfile` y `preload.ts` del bloque 34 están locales, sin commit ni push.
- **Base previa:** `2291c3e` (`feat(panel): reemplaza la barra ASCII por duración y cuenta regresiva nativa`).
- **Remoto:** `https://github.com/LAPEORRA/cubitosmusic_dbot.git` (`origin/main`).

### Últimos commits
```
2b007bc fix(tui): mide carga por pista y limpia mensajes de error de yt-dlp
637ff21 feat(queue): unifica el embed de /queue y el panel
f695fdd feat(audio): compresor PCM anti-pumping, reverb seca y ganancia real al iniciar
30d06b1 fix(play): cuenta solo canciones en espera en la confirmación de /play
836bde4 feat(commands): añade /volume y refresca el panel activo
105f720 feat(shutdown): apagado ordenado ante Ctrl+C y cierre de consola
28469f0 feat(commands): confirmaciones públicas como mini-embeds y errores efímeros
79a386c feat(panel): rediseña el embed al estilo MatchBox y mejora el cierre de sesión
2291c3e feat(panel): reemplaza la barra ASCII por duración y cuenta regresiva nativa
4844cc3 fix(player): vacía la cola antes de desconectar en /stop
158d410 feat(commands): añade /help dinámico y unifica la validación de /pause
968545b fix(player): cierra P0 de stop, panel y audioPreset; presencia en pausa
93e4ce2 feat(panel): botones reactivos al estado de cola y presencia dinámica
a0753d2 docs: sincroniza HANDOFF con el commit de telemetria publicado
1b51762 chore(telemetry): trazas live-trace, deduplicación de errores y ritual de contexto
c425d21 fix: reanudar audio antes de saltar, corregir logs de playlists y validar Spotify parcial
d62343e fix: sanitización multilínea en TUI, detalle de error por pista y feedback en /skipto
8c1ac17 fix: deduplicación de interacciones, silencio de 10062/40060 y eliminación de ephemeral
039f736 fix: limpieza de Maps en panel, manejo de queueDelete y sanitización de errores en /play
262cb79 feat: autodesconexión por inactividad y botones loop/shuffle en el panel
cd30a8c feat: comandos de gestión de cola clear, remove y skipto
```

## Verificación (todo en verde al cerrar)

1. `npm run typecheck` → ✅ 0 errores (src + tests + scripts)
2. `npm test` → ✅ **141/141 pass, 0 fail** (incluye cabecera de arranque, banner ASCII multicolor y telemetría)
3. `npm run build` → ✅ OK (tsc → `dist/`)

> `deploy-commands` ejecutado: **13 comandos** registrados en el guild, incluidos `/help` y `/volume`. Solo re-desplegar si cambia la definición (`data`) de algún comando.

## Trabajo completado (cronológico)

### 1. Consola TUI (`src/utils/logger.ts`)
- ANSI nativo, sin dependencias. `formatLogTime` (HH:MM:SS, `America/Santiago`), `getSystemMetrics` (`RAM …MB • Ping …ms`, fallback `calculando...`).
- `printStartupBanner`: recuadro Unicode de ancho **dinámico** (mín. 44, máx. 60, truncado `…`), separador derivado del encabezado.
- `logRow`: columnas fijas (`COL_TIME=10`, `COL_BADGE=12`, `COL_CHANNEL=16`, `COL_DETAIL=52`), DETALLES truncado a 50 + `…` y rellenado a 52, fila emitida como **un único string**. Opcional `logs/playback.jsonl` con `LOG_TO_FILE=true`.
- Badges en `ready.ts`: `SESIÓN`, `+COLA`, `▶ PLAY`, `PAUSA`, `REANUDA`, `VACÍA`, `STOP`, `ERROR`, `ERR AUDIO`. `interactionCreate` loguea `CMD` y `handlePanelButton` loguea `BOTÓN`.
- `ready(client, player, guildId, spotifyEnabled=false)` hace `guilds.fetch` antes del banner.

### 2. Bugs P0 (commits `a864230` y `262cb79`)
- **Solicitante por pista:** `requestedBy: interaction.user` va como opción directa de `player.play()`; `nodeOptions.metadata` solo lleva `{ channel }` (solo se aplica al crear la cola). Se refresca `requestedBy` en las pistas devueltas por la caché de búsquedas. `buildPanelEmbed` prioriza `track.requestedBy?.username`.
- **Canal de `/play`:** `canPlayInChannel(botChannelId, userChannelId)`; si el bot ya está en otro canal, pide unirse.
- **Doble render:** `handlePanelButton` no re-renderiza pause/skip/back (lo hacen los eventos `playerStart`/`playerPause`/`playerResume`). **Excepción:** `panel_loop`/`panel_shuffle` refrescan en el handler porque no emiten eventos.
- **Panel:** sin `/resume` en el texto de comandos.
- **Autodesconexión:** `leaveOnEmpty/leaveOnEnd: true` + `*Cooldown: 300_000` (5 min); `leaveOnStop: false`.

### 3. Comandos de gestión de cola (commit `cd30a8c`)
- `/clear` → `clearQueue()` (`queue.tracks.clear()`).
- `/remove <posicion>` → `removeTrack()`: `at()` + `removeOne((_, idx) => idx === index)`; en v7 `removeOne` recibe **predicado**, no índice.
- `/skipto <posicion>` → `skipTo()`: `queue.node.skipTo(posicion - 1)`.
- Los tres validan canal de voz, cola existente y mismo canal que el bot; opción `posicion` es `IntegerOption` requerida con `minValue(1)`.

### 4. Panel de 2 filas (commit `262cb79`)
- `buildPanelRows(isPaused, repeatMode = 0)` → `[row1, row2]`: fila 1 (`panel_back`, `panel_pause`, `panel_skip`, `panel_stop`, `panel_queue`) + fila 2 (`panel_loop` 🔁 con `Success` si `repeatMode !== 0`, `panel_shuffle` 🔀).
- `updatePanel(channel, embed, rows)` recibe **array** de `ActionRowBuilder`; `updateEmptyPanel` deshabilita todas las filas.

### 5. Cierre P0 de memoria/panel/errores (commit 1 de esta sesión)
- `deletePanelMessage` limpia `panelMessages`, `startedAtByGuild` y `panelLocks`. `withPanelLock` usa `.finally()` para borrar el lock cuando la cadena termina (si sigue siendo el actual).
- `updateEmptyPanel` llama a `deletePanelMessage` tras deshabilitar los botones (libera el `Message` y los Maps); la próxima sesión crea un panel limpio.
- `queueDelete` en `ready.ts` → `updateEmptyPanel(channel)`, cubriendo `leaveOnEmpty`/`leaveOnEnd`.
- `panel_shuffle` con cola vacía responde `📭 No hay canciones en la cola para mezclar.` y no re-renderiza.
- `/play`: `catch` usa `logRow` (`badge: 'ERROR'`, `red`, `channel: voiceChannel.name`) y `playErrorMessage()`: genérico `❌ No se pudo cargar esa pista o playlist…` salvo timeouts (`AbortError`/`Cancelled`, `Tiempo de espera agotado`). Nunca se expone `error.message` crudo de yt-dlp.
- `handlePanelButton(interaction, resolveQueue = useQueue)` acepta resolvedor de cola inyectable (para tests).

### 6. Blindaje de interacciones (commit 2 de esta sesión)
- **Deduplicación:** `interactionCreate.ts` mantiene `handledInteractions: Set<string>`; si el `interaction.id` ya existe, `return` inmediato. TTL de **15 s** por `setTimeout(...).unref()` (no retiene el proceso en tests). Evita ejecuciones dobles del mismo evento.
- **Errores 10062/40060:** `isInteractionConsumedError()` en `interactionResponses.ts`. En `interactionCreate.ts`, `handleInteractionFailure()` registra una fila limpia `Interacción expirada o ya respondida (${code})` con `logRow` (`badge: 'ERROR'`, `red`) y **no** intenta responder. Para errores reales registra `${contexto}: ${message}` y responde el mensaje genérico.
- `replyWithError` ya no usa `console.error`: ignora 10062/40060 y para el resto escribe con `logRow`.
- **`ephemeral` eliminado** de todos los `reply`/`followUp` de `panel-buttons.ts` (discord.js v14.27 emite `DeprecationWarning`); queda solo `flags: 64`.
- El log `[BOTÓN]` se emite **después** de `await interaction.deferUpdate()`, así un fallo del defer no deja un log de acción antes del error. Cubierto por tests.
- Tests de esa etapa: `tests/events/interactionCreate.test.ts` (dedupe y fallos), `tests/player/panelButtons.test.ts` (sin `ephemeral` y orden del log). El siguiente lote eleva el total a **66**.

### 7. Pulido final (commit `c425d21`; seis ajustes)
- `controls.ts`: `skipTrack`, `skipTo` y `backTrack` reanudan el nodo antes de saltar o volver si estaba pausado.
- `ready.ts`: los logs `tracks_queued` reciben resúmenes ligeros de pistas para mostrar correctamente el nombre de la playlist sin serializar `Track` completos; tras activar `audioPreset`, se fija el volumen base a 70.
- `panel.ts` lista `/skip`, `/skipto`, `/clear` y `/remove`; `/nowplaying` usa «Sin repetición».
- Errores de `panel.ts` y `audioPreset.ts` se registran con `logRow` en la TUI.
- `config.ts` rechaza credenciales parciales de Spotify con `ConfigError`.
- Tests nuevos/actualizados en `tests/config.test.ts`, `tests/events/ready.test.ts`, `tests/player/controlsQueue.test.ts` y `tests/player/panel.test.ts`.
- Validación verificada: `npm run typecheck` ✅, `npm test` ✅ **66/66**, `npm run build` ✅.
- No se modificaron en este lote `play.ts`, `youtubeDlpMix.ts` ni el registro de extractores en `index.ts`.

### 8. Telemetría y trazas (cambios locales sin commit; OpenCode, 14-nov-2026)
- `ready.ts`: deduplicación de errores de TUI por 2 s (`isDuplicateErrorLog`), filtrado de debug `[NW]` sin perder trazas seguras, soporte `LIVE_TRACE` (archivo `logs/live-trace.jsonl`) y `LOG_TO_FILE`.
- `tests/events/ready.test.ts`: nueva prueba de deduplicación/filtrado; total de suite elevado a **71/71**.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **71/71**, `npm run build` ✅.
- No se modificaron `play.ts`, `youtubeDlpMix.ts` ni el registro de extractores.

### 9. Ritual de trabajo (Copilot, 14-nov-2026)
- `AGENTS.md` documenta roles y cadena de trabajo (Santiago, Gemini, OpenCode/Copilot), reconocimiento Git obligatorio antes de empezar e inicialización solo cuando se solicita.
- Se añadió la convención para exportar contexto con `npm run context` e ignorar el artefacto, y para proponer commits atómicos Conventional Commits sin publicar sin autorización explícita.
- `.github/copilot-instructions.md` fue revisado y sigue apuntando a `AGENTS.md` y `HANDOFF.md`.
- Verificación en este cierre: `npm run typecheck` ✅, `npm test` ✅ **71/71**, `npm run build` ✅. Actualizó Copilot; quedan cambios locales sin commit.

### 10. Cierre del lote de telemetría y ritual (OpenCode, 14-nov-2026)
- `package.json`: `npm run context` incluye además `AGENTS.md` y `HANDOFF.md` cuando existen en la raíz (junto a `package.json` y `src/`); `contexto_bot.txt` sigue ignorado por Git.
- `src/events/ready.ts` + `tests/events/ready.test.ts`: deduplicación de errores por 2 s, filtro de debug `[NW]` y pruebas de `LIVE_TRACE` (ver sección 8).
- Cambios cerrados en el commit `1b51762` y **publicados** en `origin/main` el 14-nov-2026.
- Verificación: `npm run context` ✅ (30 archivos), `npm run typecheck` ✅, `npm test` ✅ **71/71**, `npm run build` ✅.

### 11. Retoma de sesión (OpenCode, 14-nov-2026)
- Reconciliado `HANDOFF.md` con el estado real: el commit `1b51762` ya estaba creado y el árbol limpio; se publicó junto con esta corrección documental.
- Verificación en la retoma: `npm run typecheck` ✅, `npm test` ✅ **71/71**, `npm run build` ✅.

### 12. Botones reactivos y presencia dinámica (OpenCode, 14-nov-2026)
- `src/player/panel/panel.ts`: `PanelRowState` + `getPanelRowState(queue)` (`canBack: !history.isEmpty()`, `canShuffle`/`hasQueue: tracks.size > 0`). `buildPanelRows(isPaused, repeatMode, state?)` deshabilita `panel_back`, `panel_shuffle` y `panel_queue` cuando el estado lo indica; sin `state` todo queda habilitado (retrocompatible).
- `src/events/ready.ts`: el estado de cola se propaga en `playerStart`/`playerPause`/`playerResume`; presencia con `ActivityType.Listening` al reproducir/reanudar, `ActivityType.Custom` (`⏸️ <título>`) en pausa y `setActivity()` al vaciar o borrar la cola.
- `src/player/panel/panel-buttons.ts`: el refresco de `panel_loop`/`panel_shuffle` también pasa `getPanelRowState(queue)`.
- Tests: `tests/player/panel.test.ts` (deshabilitado/habilitado, estado parcial, retrocompatibilidad y helper) y `tests/events/ready.test.ts` (presencia en play/pause/resume y limpieza). Total **77/77**.
- Zonas congeladas intactas (`play.ts`, `youtubeDlpMix.ts`, registro de extractores en `index.ts`). Cerrado en el commit `93e4ce2` y publicado en `origin/main` (`158d410`).

### 13. Cierre de P0 y presencia `Custom` (OpenCode, 14-nov-2026)
- **Presencia en pausa:** `ActivityType.Custom` ahora envía el texto en `state` (`{ name: 'Estado', type: Custom, state: '⏸️ <título>' }`) para que Discord lo renderice; test actualizado.
- **`/stop`:** `stopQueue()` ejecuta `queue.connection?.disconnect()` antes de `queue.delete()` para evitar conexiones huérfanas; `stop.ts` captura `channel` antes del borrado (que limpia `queue.metadata`).
- **Panel en casos borde:** `buildPanelEmbed` solo aplica `.setURL()`/`.setThumbnail()` con `http(s)` válidas (evita que `EmbedBuilder` lance y congele el panel). `audioTrackAdd`/`audioTracksAdd` refrescan el panel con `currentTrack` activo, actualizando el contador y habilitando 🔀/📋 al instante.
- **`audioPreset`:** se eliminó la mutación de `filters._lastFiltersCache`; `enableAudioPreset(queue)` solo valida `queue?.node` y devuelve `true`/`false`, sin tocar `ffmpeg.setFilters`. **Nota:** el preset DSP por la vía privada ya no se aplica; queda como validación hasta definir una vía pública.
- Tests nuevos/actualizados: `tests/player/audioPreset.test.ts` (nuevo), `tests/player/controlsQueue.test.ts` (desconexión), `tests/player/panel.test.ts` (URLs inválidas), `tests/events/ready.test.ts` (presencia `state` y refresco al encolar). Total **85/85**.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **85/85**, `npm run build` ✅. Cerrado en el commit `968545b` y publicado en `origin/main` (`158d410`).

### 14. P0 de `/pause` y comando `/help` (OpenCode, 14-nov-2026)
- `src/commands/music/pause.ts`: condición alineada con `panel_pause` (`!queue || !queue.currentTrack`), por lo que se puede pausar/reanudar durante transiciones (`buffering`); resolvedor de cola inyectable para tests (mismo patrón que `handlePanelButton`).
- Nuevo `src/commands/utility/help.ts`: embed `0x5865f2` con footer `CubitoMusic`; comandos agrupados por categoría (`music` → 🎵 Música, `utility` → 🛠️ Utilidades, fallback capitalizado); import dinámico de `../index.js` para evitar el ciclo ESM; respuesta con `flags: 64`.
- Registro: `/help` añadido en `src/commands/index.ts` (`category: 'utility'`, `help: 'Muestra esta lista de comandos.'`).
- Tests: `tests/commands/pauseCommand.test.ts` (buffering, reanudar y sin pista) y `tests/commands/helpCommand.test.ts` (grupos, color/footer, `flags: 64` y cobertura de todos los comandos). Total **90/90**.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **90/90**, `npm run build` ✅. **P0 pendientes: ninguno.** Cerrado en el commit `158d410` y publicado en `origin/main`.
- **Despliegue:** `npm run deploy-commands` ejecutado: **12 comandos** registrados, incluido `/help`.

### 15. Micro-optimización del desmontaje en `/stop` (OpenCode, 14-nov-2026)
- `src/player/controls.ts`: `stopQueue()` ejecuta `queue.tracks.clear()` antes de `queue.connection?.disconnect()` y `queue.delete()`, evitando que `discord-player` intente resolver o extraer la siguiente pista durante el desmontaje.
- `tests/player/controlsQueue.test.ts`: el test de stop ahora verifica el orden `['clear', 'disconnect', 'delete']` y que la cola queda vacía; el caso sin conexión espera `['clear', 'delete']`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **90/90** (misma cantidad de tests, aserciones ampliadas), `npm run build` ✅. Cerrado en el commit `4844cc3` y publicado en `origin/main`.

### 16. Cuenta regresiva nativa en el panel (OpenCode, 14-nov-2026)
- `src/player/panel/panel.ts`: nueva función pura `formatPanelProgress(track, queue, nowMs = Date.now())` que reemplaza la barra ASCII del embed.
  - **Pausado** (`queue.node.isPaused()`): `⏸️ MM:SS / MM:SS` con los timecodes de `getTimestamp()`; si no hay timestamp, `⏸️ <duración>`.
  - **Reproduciendo**: `totalMs = ts.total.value ?? track.durationMS ?? 0`; si `totalMs > 0`, calcula `remainingMs = max(0, totalMs - currentMs)` y `endUnix = floor((nowMs + remainingMs) / 1000)` → `<total.label> • termina <t:endUnix:R>`. Al reanudar (`playerResume`), el timestamp se recalcula con el restante real.
  - **Sin duración** (streams en vivo): `track.duration || 'En vivo'`.
- `buildPanelEmbed` usa `formatPanelProgress(track, queue)` como valor de `⏱ Progreso`. `src/commands/music/nowplaying.ts` queda intacto (conserva la barra visual bajo demanda).
- Tests en `tests/player/panel.test.ts`: helper `fakeTimedQueue`, reproducción normal, reanudación con progreso parcial (`nowMs + (totalMs - currentMs)`), pausa con y sin timestamp, fallback sin timestamp, stream en vivo (`durationMS: 0`) y campo del embed sin barra ASCII. Total **97/97**.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **97/97**, `npm run build` ✅. Zonas congeladas intactas (`play.ts`, `youtubeDlpMix.ts`, registro de extractores en `index.ts` y `/nowplaying`). Cambios locales sin commit.

### 17. Rediseño MatchBox del panel y cierre de sesión (OpenCode, 14-nov-2026)
- `src/player/panel/panel.ts`:
  - `SPINNING_DISC_GIF`: constante configurable por `PANEL_DISC_GIF_URL` (GIF público por defecto, verificado con HTTP 200; sustituible por un disco/vinilo girando desde `.env`).
  - `buildPanelEmbed` pasa a formato compacto: `author` «Reproduciendo» + `iconURL` animado al sonar y «En pausa» **sin** icono al pausar; se eliminan los 5 campos (`⏱ Progreso`, `📌 Añadida`, `👤 Solicitada por`, `📋 Cola`, `🛠 Comandos`); `description` de 2 líneas (`formatPanelProgress • <@solicitante>` + `Por **autor**`) y `footer` de estado (`Reproduciendo|En pausa • Vol N% • Cola: N • Loop: on|off`) con `setTimestamp()`.
  - `formatPanelProgress` se mantiene intacto (duración + `<t:UNIX:R>` al reproducir, `⏸️ MM:SS / MM:SS` en pausa, `En vivo` sin duración).
  - Botones con etiqueta corta y mismo contrato: `⏮️ Atrás`, `⏸️/▶️ Pausar|Reanudar`, `⏭️ Saltar`, `⏹️ Stop`, `📋 Cola`, `🔁 Loop`, `🔀 Mezclar`; `PanelRowState` sigue deshabilitando por contexto.
  - `updateEmptyPanel` muestra el cierre «📭 Cola finalizada» con explicación de la desconexión, `footer` `CubitoMusic` y `setTimestamp()`.
  - Se eliminó `timeAgo` (ya no había campo «Añadida»); `startedAt` queda documentado como parámetro de compatibilidad.
- Tests: `tests/player/panel.test.ts` cubre mención `<@id>`, fallback username/cola/`Desconocido`, descripción compacta, progreso con `<t:UNIX:R>`, autor con/sin GIF, footer de estado y etiquetas de botones; `tests/events/ready.test.ts` valida el contador de cola en el footer. Total **100/100**.
- Docs sincronizadas: `AGENTS.md` (flujo del panel + `PANEL_DISC_GIF_URL`) y `docs/ARCHITECTURE.md` (sección `panel.ts`).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **100/100**, `npm run build` ✅. Zonas congeladas intactas (`play.ts`, `youtubeDlpMix.ts`, registro de extractores en `index.ts`). Cambios locales sin commit.

### 18. Mini-embeds públicos en comandos (OpenCode, 14-nov-2026)
- Nuevo `src/utils/commandEmbed.ts`: `buildCommandEmbed(opts)` crea el mini-embed estándar (color `0x5865f2`, `author`/`title`/`description`/`footer` opcionales y `url`/`thumbnail` solo si son `http(s)`, evitando que `EmbedBuilder` lance).
- **`/play`** (presentación únicamente; lógica congelada intacta): `deferReply()` pasa a público y la confirmación es un mini-embed con `author` «Añadida a la cola»/«Playlist añadida a la cola», título (pista o playlist), `url`/`thumbnail` validados y `description` `duración|canciones • Cola: N canciones • Pedida por <@id>`. Las validaciones tempranas y el `catch` conservan su respuesta de error.
- Resto de comandos (`skip`, `skipto`, `clear`, `remove`, `stop`, `pause`, `loop`, `shuffle`, `queue`, `nowplaying`, `help`): las confirmaciones se envían como mini-embeds **sin** `flags: 64`; los rechazos (`❌ Necesitas estar en un canal de voz`, `No hay nada reproduciéndose`, `Posición inválida`, cola vacía, etc.) mantienen `flags: 64`.
- `/queue` conserva `allowedMentions: { parse: [] }` dentro del embed; `/nowplaying` mantiene la barra ASCII y `/help` agrupa las categorías en su embed público.
- Tests: `tests/commands/queueCommand.test.ts` y `tests/commands/helpCommand.test.ts` verifican respuestas públicas (sin `flags`); `tests/commands/pauseCommand.test.ts` distingue confirmación pública y rechazo efímero; nuevo `tests/utils/commandEmbed.test.ts` cubre color y validación de URLs. Total **102/102**.
- Convenciones sincronizadas en `AGENTS.md`, `docs/ARCHITECTURE.md`, `README.md`, `CONTRIBUTING.md` y `.github/PULL_REQUEST_TEMPLATE.md` (confirmaciones públicas, errores ephemeral).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **102/102**, `npm run build` ✅. Zonas congeladas respetadas (`play.ts` solo cambió la presentación; `youtubeDlpMix.ts` y registro de extractores intactos). Cambios locales sin commit.

### 19. Apagado ordenado (OpenCode, 14-nov-2026)
- Nuevo `src/utils/shutdown.ts`:
  - `createShutdownHandler({ client, player, exit?, timeoutMs? })` devuelve un handler **idempotente** (bandera `shuttingDown`): log `STOP` amarillo «Apagando bot (señal)...», timeout de seguridad de 3 s (`setTimeout(...).unref()`) que fuerza `exit(0)` si Discord no responde, recorrido de `player.queues.cache.values()` con `stopQueue(queue)` + `updateEmptyPanel(channel)`, limpieza de presencia (`client.user?.setActivity()`), `await client.destroy()` y `exit(0)`.
  - Errores por cola aislados (se registran y se continúa); `finally` limpia el temporizador y sale.
  - `registerGracefulShutdown(client, player)`: `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK` y, con `!process.stdin.isTTY`, `stdin` `end`/`close`.
- `src/index.ts`: importa y conecta `registerGracefulShutdown(client, player)` tras `client.login(...)`. Registro/orden de extractores y eventos intactos.
- Tests (`tests/utils/shutdown.test.ts`): idempotencia con señales repetidas (limpieza una sola vez), limpieza de varias colas con panel, aislamiento de fallos por cola y salida forzada por timeout cuando `client.destroy()` queda colgado. Total **106/106**.
- Docs sincronizadas: `AGENTS.md` (árbol + flujo) y `docs/ARCHITECTURE.md` (sección «Apagado ordenado»).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **106/106**, `npm run build` ✅. Zonas congeladas intactas. Cambios locales sin commit.

### 20. Persistencia del panel y limpieza de huérfanos (OpenCode, 15-nov-2026)
- `src/player/panel/panel.ts`: persistencia ligera del `messageId` en `logs/panel-state.json` mediante `setPanelMessage`/`deletePanelMessage` (ruta inyectable para tests; E/S tolerante a fallos).
- `buildClosedPanelEmbed()` extraído como helper compartido (usado por `updateEmptyPanel` y la limpieza).
- `cleanupOrphanedPanels(client, stateFilePath?)` exportado: cierra paneles huérfanos de sesiones anteriores (edita con «📭 Cola finalizada», deshabilita botones) y limpia el JSON; ignora archivos inexistentes/vacíos/corruptos y errores de Discord (10003/10008).
- `src/events/ready.ts`: llama a `void cleanupOrphanedPanels(client)` tras imprimir el banner.
- Tests nuevos en `tests/player/panel.test.ts`: persistencia/borrado y limpieza de huérfanos (existente y ausente). Total **109/109**.
- Docs sincronizadas: `AGENTS.md` y `docs/ARCHITECTURE.md`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **109/109**, `npm run build` ✅. Zonas congeladas intactas. Cambios locales sin commit.

### 21. Comando `/volume` (OpenCode, 15-nov-2026)
- `src/player/controls.ts`: `setQueueVolume(queue, volume)` valida entero 1–100 (`!Number.isInteger`, `<1`, `>100` → `null`), aplica `queue.node.setVolume(volume)` y devuelve el nivel.
- `src/commands/music/volume.ts`: `/volume <porcentaje>` con validaciones efímeras estándar (canal de voz, reproducción activa, mismo canal), refresco inmediato del panel (`buildPanelEmbed` + `buildPanelRows` + `updatePanel`, footer `Vol N%`) y confirmación pública con `buildCommandEmbed` (`🔊 Volumen ajustado al **N%**.`).
- Registro en `src/commands/index.ts` (`category: 'music'`, help `Ajusta el volumen de reproducción (1-100%).`). Total **13 comandos**.
- Tests `tests/commands/volumeCommand.test.ts`: rechazos efímeros, ajuste exitoso con footer `Vol 45%` y respuesta pública, y validación de rango de `setQueueVolume` (`0`, `101`, `NaN` → `null`). Total **115/115**.
- Docs sincronizadas: `AGENTS.md` y `docs/ARCHITECTURE.md`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **115/115**, `npm run build` ✅, `npm run deploy-commands` ✅ (13 comandos). Zonas congeladas intactas. Cambios locales sin commit.

### 22. Cola reportada por `/play` = canciones en espera (OpenCode, 15-nov-2026)
- `src/commands/music/play.ts` (**solo presentación del mini-embed**, final del handler): tras refrescar `track.requestedBy`, consulta la cola resultante con `const activeQueue = useQueue(interaction.guildId);` y calcula las pistas pendientes excluyendo la que ya suena: `const waitingCount = activeQueue?.tracks.size ?? Math.max(0, (result.searchResult?.tracks.length ?? 1) - 1);`.
- Etiqueta con concordancia singular/plural: `const queueLabel = \`${waitingCount} ${waitingCount === 1 ? 'canción' : 'canciones'}\`;` y nueva `description` `` `${addedLabel} • Cola: ${queueLabel} • Pedida por <@id>` ``. Se elimina la antigua `queueSize` (que usaba `existingQueue` y podía contar la pista en curso).
- Zonas congeladas respetadas: no se tocaron `normalizeUrl`, `searchEngine`, `canPlayInChannel`, `signal`, `volume: 70`, `nodeOptions` ni la llamada a `player.play()`; `youtubeDlpMix.ts` y el registro de extractores intactos. Sin cambios en `data`, así que **no hace falta** `deploy-commands`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **115/115**, `npm run build` ✅. Cambios locales sin commit.

### 23. Compresor PCM nativo por la vía pública (OpenCode, 15-nov-2026)
- **Autorización explícita del Product Owner** para tocar `nodeOptions` en `play.ts` solo con `disableCompressor: false`; el resto de la reproducción sigue congelada (`normalizeUrl`, `searchEngine`, `canPlayInChannel`, `signal`, `volume: 70`, `youtubeDlpMix.ts`, registro de extractores y la prohibición de `ffmpeg.setFilters`).
- **Tipos reales verificados en `node_modules`** (discord-player `7.2.0` + `@discord-player/equalizer` `7.2.0`):
  - `GuildNodeCreateOptions.disableCompressor?: boolean`, con default efectivo **`true`** (`options.disableCompressor ?? (options.disableCompressor = true)`); sin `false`, el dispatcher no crea el `CompressorTransformer`.
  - `queue.filters` es `GuildQueueAudioFilters`; `get compressor()` → `queue.dispatcher?.compressor || null` (`CompressorTransformer | null`). **No** es un sub-objeto con `setCompressor` propio.
  - `queue.filters.compressor.setCompressor(options: Partial<CompressorParameters>): CompressorParameters` → **síncrono** (el prompt admitía asíncrono; se respetó la firma real). `enableAudioPreset` declara `boolean`.
  - El transformador se crea en el `FiltersChain` del dispatcher y sus `set*` disparan `onUpdate` → el dispatcher emite `compressor` → `GuildQueue` sincroniza `_lastFiltersCache.compressor` (las pistas siguientes heredan el preset sin tocar propiedades privadas).
- `src/player/audioPreset.ts`: `enableAudioPreset(queue)` aplica `COMPRESSOR_PRESET` (`threshold: -14`, `ratio: 3`, `attack: 20`, `release: 150`, `makeupGain: 0`, `kneeWidth: 8`) con `queue.filters.compressor.setCompressor(...)`, devuelve `true` si se aplicó y `false` sin lanzar si no hay cola/dispatcher/API o si falla (log `PRESET` amarillo con `logRow`). Sigue sin usar `ffmpeg.setFilters` ni `_lastFiltersCache`.
- `src/commands/music/play.ts`: **única** línea añadida en `nodeOptions` → `disableCompressor: false`. Sin cambios de presentación ni de `player.play()`.
- `src/events/ready.ts`: `queueCreate` conserva `enableAudioPreset(queue)` + `queue.node.setVolume(70)` y ahora loguea `Preset: activo` según `queue.options.disableCompressor` (en ese punto aún no hay dispatcher, así que el getter `compressor` es `null`). `playerStart`, con `queue.dispatcher` activo: reafirma `enableAudioPreset(queue)` y `queue.node.setVolume(queue.node.volume || 70)`.
- Tests `tests/player/audioPreset.test.ts`: preset exacto pasado a `setCompressor` (una sola llamada), sin `setFilters` ni escritura en `_lastFiltersCache`, `false` para cola/nodo/dispatcher/API ausentes y `false` sin lanzar cuando `setCompressor` falla. Total **117/117**.
- Docs sincronizadas: `AGENTS.md` (zona congelada, árbol, flujo `/play`, nuevo gotcha 6) y `docs/ARCHITECTURE.md` (tabla, árbol y sección «Compresor PCM nativo»).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **117/117**, `npm run build` ✅. Cambios locales sin commit.

### 24. Ganancia real desde el primer segundo + compresor recalibrado (OpenCode, 15-nov-2026)
- **Síntoma del Product Owner:** `/play` → el panel marca `Vol 70%` pero el audio sale a tope; solo al ejecutar `/volume 70` baja el volumen real.
- **Causa raíz (inspección de `node_modules` + sondas ejecutadas contra el `dist` real):**
  - `queue.dispatcher.volume` es un **getter numérico**; el objeto con `setVolume` vive en `queue.dispatcher.dsp.volume` (`VolumeTransformer`).
  - `GuildQueuePlayerNode.setVolume` → `if (!this.queue.dispatcher) return false;` y `StreamDispatcher.setVolume` → `if (!this.dsp.volume) return false;`. **Sonda:** con `dispatcher: null`, `queue.node.setVolume(70)` devuelve `false` y no toca nada. Es exactamente lo que ocurría en `queueCreate` (aún sin dispatcher).
  - La cadena DSP se **reconstruye por pista** (`FiltersChain.create`) leyendo `volume` de `_lastFiltersCache.volume`; la ganancia inicial depende de ese caché, no de llamadas tempranas.
  - `VolumeTransformer.setVolume` **no tiene guarda de igualdad** (sonda: dos `setVolume(70)` → dos `onUpdate`, `_volume` 0.7), así que reaplicar es idempotente.
  - `queue.node.volume` devuelve **`100`** cuando no hay transformer (sonda), por lo que no sirve como fuente de verdad del nivel deseado.
  - **Hallazgo extra:** con `disableReverb: true` (default) la cadena **igual instancia** un `ReverbTransformer` (el preset solo se arma si `ops.reverb` existe) con `wetLevel 0.3 / dryLevel 0.7`; sonda: `FiltersChain(volume 100)` → 16000 se convierte en 11200. Queda documentado como pendiente de decisión, **sin tocar**.
- `src/player/controls.ts`: nuevos `applyInitialVolume(queue, targetVolume = 70): number` (clamp 0-100, `WeakMap` de nivel deseado, escribe en nodo **y** en `dispatcher.dsp.volume`, `traceEvent('audio','volume_applied', …)`), `getDesiredVolume(queue, fallback = 70)` y `reapplyVolumeWhenPlaying(queue, targetVolume)` (reaplica al pasar a `playing`, sin duplicar listeners vía `WeakSet`). `setQueueVolume` delega en `applyInitialVolume`.
- `src/events/ready.ts`: `queueCreate` → `applyInitialVolume(queue, 70)` (registra el nivel; el nodo sigue siendo no-op). `playerStart` → `enableAudioPreset(queue)` + `applyInitialVolume(queue, getDesiredVolume(queue, queue.node?.volume || 70))` + `reapplyVolumeWhenPlaying(queue, targetVolume)`.
- `src/player/audioPreset.ts`: `COMPRESSOR_PRESET` recalibrado a `threshold: -18, ratio: 4, attack: 10, release: 150, makeupGain: 0, kneeWidth: 6`.
- Tests: `tests/player/controlsQueue.test.ts` (ganancia aplicada aunque `queue.node.volume` ya reporte 70, escritura en el transformer cuando el nodo la ignora, clamp 140/-5/NaN, memoria de `/volume`, listener único de `reapplyVolumeWhenPlaying` y no-op si ya reproduce) y `tests/player/audioPreset.test.ts` (preset nuevo). Total **124/124**.
- Docs sincronizadas: `AGENTS.md` (árbol, `/volume`, compresor, gotchas 7 y 8) y `docs/ARCHITECTURE.md` (sección «Ganancia real del stream» + compresor).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **124/124**, `npm run build` ✅. Cambios locales sin commit.

### 25. Perfil DSP anti-pumping + reverb 100 % seca (OpenCode, 15-nov-2026)
- **Objetivo del Product Owner:** al 100 % de volumen el sub-bajo aplastaba medios/agudos (compresor demasiado agresivo) y la cadena DSP seguía coloreando el audio con una reverb no solicitada.
- **Inspección en `node_modules` (discord-player 7.2.0 + `@discord-player/equalizer` 7.2.0):**
  - `queue.filters.reverb` → `queue.dispatcher?.reverb || null` (`ReverbTransformer | null`); el dispatcher lo expone como `this.dsp?.reverb`.
  - Firma real: `setReverb(options: Partial<ReverbParameters>): ReverbParameters` → **síncrono** (`ReverbParameters = { roomSize, damping, wetLevel, dryLevel }`). No muta propiedades privadas: cada `set*` interno llama a `onUpdate`, el dispatcher emite `reverb` y `GuildQueue` sincroniza `_lastFiltersCache.reverb`.
  - `ReverbTransformer.processSample` = `input * dryLevel + wet * wetLevel / numDelayLines` ⇒ con `wetLevel: 0` y `dryLevel: 1` la señal sale idéntica a la entrada (se recupera el ~30 % de ganancia seca que restaba el preset `0.3 / 0.7`).
  - Tras aplicar el preset, las pistas siguientes heredan `_lastFiltersCache.reverb` con `disabled: queue.options.disableReverb` (= `true`), así que el transformador ya no se instala: la cadena queda seca de forma permanente.
- `src/player/audioPreset.ts`: `COMPRESSOR_PRESET` recalibrado a `threshold: -15, ratio: 3, attack: 25, release: 150, makeupGain: 0, kneeWidth: 6` (attack lento para no bombear con graves fuertes) + nuevo `DRY_REVERB_PRESET = { wetLevel: 0, dryLevel: 1 }`. `enableAudioPreset` aplica ambos en el mismo bloque `try/catch` seguro, omitiendo la reverb si el getter es `null` y devolviendo `true` si aplicó al menos un preset; un fallo de reverb conserva el compresor ya aplicado y se registra con `logRow` (badge `PRESET`).
- Sin tocar zonas congeladas: `play.ts`, `youtubeDlpMix.ts`, registro de extractores, `nodeOptions` y `ffmpeg.setFilters` intactos (la reverb se neutraliza por la API pública, no por el filtro ffmpeg).
- Tests `tests/player/audioPreset.test.ts`: valores exactos de `COMPRESSOR_PRESET` (`-15 / 3 / 25 / 150 / 0 / 6`) y de `DRY_REVERB_PRESET`, aplicación de ambos presets, `reverb: null` sin fallar, reverb sola cuando no hay compresor, ausencia de `setFilters`/escritura en `_lastFiltersCache`, y fallo de `setReverb` sin lanzar. Total **130/130**.
- Docs sincronizadas: `AGENTS.md` (árbol, flujo «Perfil DSP», gotcha 8 reescrito) y `docs/ARCHITECTURE.md` (tabla, árbol y sección «Perfil DSP nativo»).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **130/130**, `npm run build` ✅. Cambios locales sin commit.

### 26. Embed estético unificado para la cola (Copilot, 15-nov-2026)
- `src/player/queueSummary.ts`: el listado separa el encabezado de la primera canción y añade la duración al final de cada línea cuando existe. Nuevo `buildQueueEmbed(current, tracks)` para la descripción compartida, color `0x5865f2`, título `📋 Cola de reproducción`, miniatura HTTP(S) de la pista actual y pie con el conteo singular/plural de canciones en espera.
- `src/player/panel/panel-buttons.ts`: `panel_queue` responde con el embed compartido, sin texto plano, sin parseo de menciones y conserva `flags: 64`.
- `src/commands/music/queue.ts`: `/queue` usa el mismo builder y conserva su respuesta pública, sin `flags`.
- Tests de `queueSummary`, `panelButtons` y `queueCommand` verifican formato/duración, color, título, miniatura, pie, menciones y privacidad. Total actualizado: **133/133**.
- `docs/ARCHITECTURE.md` sincronizada. No cambió la definición (`data`) de `/queue`, así que no hace falta volver a desplegar comandos. Zonas congeladas intactas; pendientes de código del bloque 26: ninguno.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **133/133**, `npm run build` ✅. Actualizó Copilot; bloques 23–26 publicados en `f695fdd` y `637ff21`.

### 27. Carga por pista y errores yt-dlp legibles (Copilot, 16-nov-2026)
- `src/events/ready.ts`: registra el inicio de preparación en `willPlayTrack` con un `WeakMap` por objeto pista, consume y elimina la marca en `playerStart`, y reporta `Carga:` como tiempo de preparación individual, sin acumular desde el encolado o la sesión.
- `src/utils/logger.ts`: nuevo `summarizePlayerError(rawMessage)` quita prefijos repetidos de yt-dlp/YouTube, colapsa líneas y deja la causa antes del truncado de `DETALLES`; la telemetría JSON conserva el error original.
- Tests en `tests/events/ready.test.ts` y `tests/utils/logger.test.ts`: verifican tiempos separados y consumidos para pistas consecutivas, la salida de `[ERROR]` limpia y el resumen del ejemplo de yt-dlp.
- `AGENTS.md` y `docs/ARCHITECTURE.md` actualizados. Zonas congeladas respetadas (`play.ts`, `youtubeDlpMix.ts`, `index.ts` y filtros ffmpeg intactos).
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **135/135**, `npm run build` ✅. Actualizó Copilot; cierre Git solicitado por el PO con `fix(tui): mide carga por pista y limpia mensajes de error de yt-dlp`. Pendiente solo QA manual de TUI/error y duración de carga en marcha blanca.

### 28. Clasificación de errores y rescate de pista (Copilot, 16-nov-2026)
- `src/player/trackFallback.ts`: `classifyPlayerError` asigna mensajes en español a causas comunes de yt-dlp/extractores. `tryFallbackYouTubeSearch` intenta una búsqueda por título/artista con límite de 8 s, omite la URL fallida e inserta el primer resultado distinto al frente de la cola.
- Anti-bucle: `WeakSet` de pistas ya rescatadas/intentadas y caché FIFO normalizada limitada a 256 claves; no reintenta una pista rescatada ni una URL que siga en la ventana de deduplicación.
- `src/events/ready.ts`: en `playerError` intenta primero el rescate; si lo logra, registra `[RESCATE]` y `track_fallback` sin avisar en Discord. Si no, registra el mensaje clasificado y envía al canal un mini-embed amarillo que se borra a los 10 s.
- `buildCommandEmbed` acepta un color opcional, conservando el color de marca por defecto. Test nuevo `tests/player/trackFallback.test.ts` cubre clasificación, URL distinta, inserción en índice 0, anti-bucle, elegibilidad y aviso al fallar la búsqueda.
- `AGENTS.md` y `docs/ARCHITECTURE.md` sincronizados. Zona congelada intacta (`play.ts`, `youtubeDlpMix.ts`, registro de extractores en `index.ts`); no se usa `ffmpeg.setFilters`.
- Verificación al cierre: `npm run typecheck` ✅, `npm test` ✅ **140/140**, `npm run build` ✅, `git diff --check` ✅. No se modificó `.github/copilot-instructions.md`, que sigue apuntando a `AGENTS.md` y `HANDOFF.md`.
- Actualizó Copilot. Pendiente QA manual de reproducción/error en un canal privado de Discord. Rama `main` sin commit nuevo; cambio local listo para revisión.

### 29. Banner ASCII multicolor de arranque (Copilot, 16-nov-2026)
- `src/utils/logger.ts`: nuevo `visibleLength(text)` elimina códigos ANSI; `pad()` y el cálculo de ancho del recuadro lo usan para mantener alineados los bordes Unicode con texto coloreado.
- `printStartupBanner`: añade el arte ASCII de cinco líneas, con «Cubitos» en cyan + bold, «Music» en magenta + bold y la firma «desarrollado por Cubitos Dev • v1.1.0» en gray. El título del recuadro también usa ambos colores; los datos dinámicos (`Bot`, `Servidor`, `Node`, `Spotify`, `Ping • RAM • Extractores`) y el encabezado de la tabla (`HORA`, `EVENTO`, `CANAL`, `DETALLES`, `MÉTRICAS`) se conservan.
- `tests/utils/logger.test.ts`: comprueba el arte y la firma, los colores ANSI, la alineación del recuadro y toda la telemetría/encabezado.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **140/140**, `npm run build` ✅; prueba focalizada de logger ✅ **15/15**. No se tocaron zonas congeladas.
- Actualizó Copilot. Sin commit ni push. Pendiente QA visual de terminal real con el bot en marcha.

### 30. Cabecera «Larga Vida a Cubitos» y arranque silencioso (Copilot, 16-nov-2026)
- `.npmrc`: fija `loglevel=silent`; `npm config get loglevel` confirma `silent`, para suprimir el encabezado/ruido de `npm run dev`.
- `src/index.ts`: reemplaza el import lateral `dotenv/config` por `dotenv.config({ quiet: true })` y llama a `printBootHeader()` inmediatamente después, antes de validar configuración o conectar el cliente. El registro y orden de extractores queda intacto.
- `src/utils/logger.ts`: exporta `STARTUP_BOOT_LINES` con las tres parejas técnico-cómicas y `printBootHeader(random = Math.random)`, que muestra «⚡ Larga Vida a Cubitos.» en cyan + bold y las dos sublíneas en gray.
- `tests/utils/logger.test.ts`: comprueba el mensaje, los colores y ambas sublíneas con selección determinista mediante `random` inyectado.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **141/141**, `npm run build` ✅; prueba focalizada de logger ✅ **16/16**; `npm config get loglevel` → `silent`.
- Actualizó Copilot. Sin commit ni push. Pendiente confirmar el arranque visual completo con el bot conectado.

### 31. Empaquetado Docker Alpine para 24/7 (Copilot, 16-nov-2026)
- Nuevos `.dockerignore`, `Dockerfile` multi-stage sobre `node:22-alpine` y `docker-compose.yml`: dependencias instaladas con scripts omitidos, runtime con `ffmpeg`/`yt-dlp`/Python del sistema, límite de memoria (512 MiB) y heap de Node (384 MiB), reinicio automático, apagado con gracia, persistencia de `logs/` y rotación de logs Docker.
- Se fija `FFMPEG_BIN=/usr/bin/ffmpeg` en la imagen: `discord-player-youtubedlp` prioriza `ffmpeg-static`, cuyo paquete acepta esa variable para seleccionar el ejecutable nativo. `yt-dlp` busca primero el binario del sistema en `PATH`. No hay referencias directas a `ffmpeg-static`, `ytdlp-nodejs`, `setFFmpegPath` ni `setYtDlpPath` en `src/`; no se tocaron las zonas congeladas.
- `.env.example` documenta variables obligatorias vacías y variables opcionales comentadas (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `PANEL_DISC_GIF_URL`, `LIVE_TRACE`, `LOG_TO_FILE`).
- `AGENTS.md` actualizado con archivos de Docker, comandos de Compose y selección de binarios del sistema. `.github/copilot-instructions.md` sigue apuntando a `AGENTS.md` y `HANDOFF.md`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **141/141**, `npm run build` ✅, `git diff --check` ✅. `docker compose config` no ejecutado: Docker no está instalado en este equipo.
- **Commit base del bloque:** `05d2e81`; empaquetado listo para el commit autorizado. Actualizó Copilot. Pendiente validar `docker compose config` y el arranque en el host Linux de despliegue.

### 32. Migración del flujo a Antigravity y skill `project-ritual` (Antigravity, 25-nov-2026)
- `AGENTS.md`: actualizada la sección `Roles y fuente de verdad` para establecer a **Antigravity** como Coordinador/Arquitecto directo sobre el repositorio, formalizar los sub-agentes delegables (`research`, `executor`, `verifier`), mantener a OpenCode/Copilot como ejecutores externos opcionales y marcar `npm run context` (`contexto_bot.txt`) como respaldo opcional.
- `.agents/skills/project-ritual/SKILL.md`: creada la skill local adaptada al flujo de Antigravity (cadena de mando con sub-agentes, modo inicialización y checklist de cierre).
- `.github/copilot-instructions.md` revisado y vigente apuntando a `AGENTS.md` y `HANDOFF.md`.
- **Diagnóstico VM GCP (`e2-micro`):** confirmado por métricas reales medidas en la VM por el PO + OpenCode que el cuello de botella era el rate-limit de YouTube al primer byte desde IP GCP (17–94 s), no `opusscript`/DSP/`ffmpeg`. En la VM ya se aplicaron `done()` en `willPlayTrack`, `cookies.txt` (`agent.cookiesFile`), `LOW_CPU_AUDIO=true` y `ffmpeg -threads 1`, quedando en curso la precarga a `/app/preload`.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **141/141**, `npm run build` ✅. Zonas congeladas intactas en este repo local (`play.ts`, `youtubeDlpMix.ts`, `index.ts`). Actualizó Antigravity; sin commit ni push.

### 33. Sincronización desde VM GCP y precarga secuencial en `/app/preload` (Antigravity, 25-nov-2026)
- **Commit previo:** `0862779` (`docs(workflow): adapta AGENTS.md y skill project-ritual para Antigravity`, local sin push).
- **Autorización explícita del PO** sobre zonas congeladas (`play.ts`, `index.ts`, `ready.ts`, `Dockerfile`, `docker-compose.yml`) para integrar los arreglos medidos en la VM `e2-micro` (`~/cubitosmusic_dbot`).
- **Docker y runtime:** `Dockerfile` añade wrapper `/usr/local/bin/ffmpeg-1thread` (`-threads 1`), enlaza `yt-dlp` y `ffmpeg-1thread` donde los resuelven `ytdlp-nodejs`/`ffmpeg-static`, configura `XDG_CACHE_HOME=/app/.cache` y `/app/preload`, y verifica `opusscript` (`^0.0.8` en `package.json`). `docker-compose.yml` monta `./cookies.txt:/app/cookies.txt` en lectura/escritura y volúmenes `ytdlp-cache` y `preload-cache`. `.dockerignore`, `.gitignore` y `.env.example` actualizados.
- **Cookies y bajo consumo (`LOW_CPU_AUDIO`):** `src/config.ts` expone `youtubeCookies` (`YOUTUBE_COOKIES`); `src/index.ts` pasa `cookiesFile` en `YouTubeDlpMixExtractor` cuando existe el archivo; `src/commands/music/play.ts` sube `PLAY_TIMEOUT_MS` a `90_000` y desactiva `compressor`/`reverb`/`equalizer`/`biquad` cuando `LOW_CPU_AUDIO=true`; `src/player/audioPreset.ts` respeta `LOW_CPU_AUDIO`.
- **Precarga secuencial (`/app/preload`):** `src/player/preload.ts` (`createPreloadManager` + exports singleton) descarga como máximo **1 pista a la vez** (`chain`) solo para `{actual, siguiente}`, con limpieza inmediata en `playerFinish`/`playerSkip` (`dropPreload`), `emptyQueue`/`queueDelete` (`forgetGuild`) y `audioTrackAdd`/`audioTracksAdd`/`audioTrackRemove`/`audioTracksRemove`/`playerStart` (`syncPreload`), además de `done?.()` en `willPlayTrack` (`src/events/ready.ts`) y `onBeforeCreateStream` en `src/index.ts`.
- **Tests:** nuevo `tests/player/preload.test.ts` (concurrencia máxima 1, limpieza en `dropPreload`/`forgetGuild`, limpieza de huérfanos en `initPreload` y `enabled=false`).
- Verificación por sub-agente `verifier`: `npm run typecheck` ✅, `npm test` ✅ **144/144**, `npm run build` ✅. Actualizó Antigravity; sin commit ni push.

### 34. Actualización de `yt-dlp` + `yt-dlp-ejs` en Alpine y ajuste de `preload.ts` (Antigravity, 25-nov-2026)
- **Diagnóstico en vivo (`cookies.txt` + `live-trace.jsonl`):** el nuevo `cookies.txt` eliminó el bloqueo anti-bot de YouTube, pero `yt-dlp 2026.10.21` de Alpine fallaba al resolver el JS challenge (`a.addOnDisposeCallback is not a function`), dejando solo imágenes disponibles. Probado en Alpine con `yt-dlp 2026.11.23` + `yt-dlp-ejs` vía `pip`: resolvió `The New Order | 3:44` con éxito.
- **`Dockerfile`:** sustituye el paquete `yt-dlp` de Alpine por `py3-pip` + `pip install --no-cache-dir --break-system-packages --root-user-action=ignore -U yt-dlp yt-dlp-ejs`.
- **`src/player/preload.ts`:** añade `--js-runtimes node` en `buildArgs()` y exige `current && next` antes de encolar en `syncPreload()` para no descargar la pista 1 en paralelo cuando la cola está inactiva.
- Verificación: `npm run typecheck` ✅, `npm test` ✅ **144/144**, `npm run build` ✅. Actualizó Antigravity; sin commit ni push.

## Pendientes / próximos pasos

0. **QA en VM GCP (`cubitosmusic-vm`):** tras hacer commit/push autorizado y desplegar en la VM (`docker compose up -d --build`), confirmar con `PRELOAD_AUDIO=true` y `LOW_CPU_AUDIO=true` que la pista siguiente reproduce desde `/app/preload` sin cortes ni demora de primer byte, y que `/app/preload` queda vacío al terminar o saltar.

1. **QA visual real** de la TUI en PowerShell con el bot vivo (`npm run dev`), incluido el mensaje «Larga Vida a Cubitos», ausencia de banners de npm/dotenv y el banner ASCII.
2. **QA manual en Discord:** banner/logs, trazas `CMD`/`BOTÓN`, botones 🔁/🔀, `/clear`, `/remove`, `/skipto`, `/help`, pausa durante buffering, autodesconexión a los 5 min y ausencia de warnings `ephemeral`. En la TUI, confirmar que `Carga:` refleja el tiempo de preparación individual en pistas sucesivas y que `[ERROR]` muestra causas de yt-dlp sin prefijos ruidosos. **QA de audio (bloques 23-25):** confirmar en la TUI `SESIÓN … Preset: activo`, que el compresor no corta el stream (~2 s de silencio/`write EPIPE`), que los picos ya no saturan, que los graves fuertes **no bombean** con el perfil `-15 dBFS / 3:1 / attack 25 ms`, que la señal suena **100 % seca** (sin cola de reverb) y que `/play` suena a 70% **desde el primer segundo** (sin tener que ejecutar `/volume 70`) con `logs/live-trace.jsonl` registrando `volume_applied` con `granted: 70` y `transformerActive: true`. Validar los mini-embeds públicos de confirmación (visibles para el canal) —en especial que `/play` informe las canciones **en espera** (`0/1 canción`, `N canciones`) y no cuente la pista en curso— frente a los rechazos efímeros, además del panel MatchBox (GIF del autor al reproducir y su ausencia en pausa, mención del solicitante, footer de estado, etiquetas de botones y cuenta regresiva `<t:…:R>` al pausar/reanudar) y el cierre «📭 Cola finalizada». Opcional: fijar un disco/vinilo girando con `PANEL_DISC_GIF_URL`.
3. **QA de apagado:** con el bot reproduciendo, probar `Ctrl + C` (SIGINT), cerrar la ventana de consola en Windows (SIGBREAK) y `SIGTERM` en Docker: debe registrar `STOP`, detener la música, dejar el panel en «📭 Cola finalizada» y salir en menos de ~3 s.
4. **Arquitectura pendiente:** panel dinámico con throttle/coalescing, TUI avanzada (`log-update`/chalk), web dashboard.
5. **Audio (resuelto en el bloque 25):** la reverb por defecto ya se neutraliza con `queue.filters.reverb.setReverb({ wetLevel: 0, dryLevel: 1 })`. Pendiente solo de QA auditivo: confirmar que el audio suena más abierto/definido y que el compresor recalibrado (`-15 / 3 / 25`) no bombea en temas con graves fuertes.
6. **Docker (bloque 31):** en el host Linux de despliegue, validar `docker compose config` e iniciar el contenedor para confirmar los binarios Alpine, el montaje de `logs/` y el apagado ordenado.

## Archivos clave

- **Consola:** `src/utils/logger.ts`
- **Panel/eventos:** `src/events/ready.ts`, `src/events/interactionCreate.ts`, `src/events/interactionResponses.ts`, `src/player/panel/panel.ts`, `src/player/panel/panel-buttons.ts`
- **Controles:** `src/player/controls.ts` (`togglePause`, `skipTrack`, `backTrack`, `toggleLoop`, `shuffleQueue`, `clearQueue`, `removeTrack`, `skipTo`, `canPlayInChannel`)
- **Comandos/registry:** `src/commands/index.ts`, `src/commands/music/*`, `src/types/commands.ts`
- **Config:** `src/config.ts`
- **Tests:** `tests/player/*` (panel, panelButtons, controls, cola, voz, URL), `tests/events/*` (interactionCreate, interactionResponses), `tests/commands/*`, `tests/utils/logger.test.ts`

## Restricciones y gotchas (leer antes de tocar reproducción)

1. **Reproducción congelada:** no cambiar en `src/commands/music/play.ts` los valores de `searchEngine`, `signal`, `volume: 70`, `disableCompressor: false` ni el resto de `nodeOptions` sin pedido explícito. Tampoco `src/player/extractors/youtubeDlpMix.ts` ni el registro/orden de extractores en `src/index.ts`.
2. **NO usar `queue.filters.ffmpeg.setFilters(...)`**: el stream del extractor es PCM `$fmt: 'raw'`; el FFmpegFilterer lanza otro ffmpeg → `write EPIPE` y se vacía la cola. Además `setFilters` dispara `triggerReplay()`.
3. **`agent: { autoCookiesFromBrowser: false }` SIEMPRE** al registrar YouTubeDlpExtractor.
4. **`leaveOn*` actual:** `leaveOnEmpty`/`leaveOnEnd` en `true` con cooldown de 300000 ms; `leaveOnStop` en `false` (`/stop` desconecta explícitamente).
5. **discord-player v7.2:**
   - `requestedBy` va en las opciones de `player.play()` (nivel pista), no en `nodeOptions.metadata` (que solo aplica al crear la cola).
   - `queue.tracks.removeOne()` recibe un predicado; `queue.node.skipTo()` acepta índice numérico.
   - La caché de búsquedas dura ~5 h y puede reutilizar `Track` con `requestedBy` antiguo (por eso se refresca).
6. **ESM estricto:** imports locales con `.js` (`from './foo.js'`); tsconfig `NodeNext` + `strict`.
7. **Respuestas al usuario:** español; confirmaciones como mini-embeds públicos (`buildCommandEmbed`) y errores/rechazos con `flags: 64` (ephemeral). **No** usar la propiedad `ephemeral: true` (deprecada en discord.js v14.27).

## Lecciones del entorno

- `D:\Proyectos_Opencode` NO es escribible (ACL de otro Windows/SID); el respaldo quedó intacto, no borrarlo sin admin.
- Git instalado vía winget (`Git.Git` 2.56.0): usar `C:\Program Files\Git\cmd\git.exe` si `git` no resuelve.
- Shell (PowerShell): **no** soporta `&&`; separar comandos con `;`. El wrapper no maneja redirecciones `>`: usar variables o construcciones sin redirect.
- `npm run dev` es `tsx src/index.ts` **sin watch**; para hot reload: `npx tsx watch src/index.ts`.
