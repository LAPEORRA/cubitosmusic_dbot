# Handoff — CubitoMusic

> Documento de traspaso de sesión: estado del proyecto al **14-nov-2026** para retomar en una sesión fresca.

## Estado actual

- **Carpeta activa:** `D:\cubitosmusic` (reubicado desde `D:\Proyectos_Opencode`).
- **Git:** rama `main`, `HEAD` en `28469f0` (`feat(commands): confirmaciones públicas como mini-embeds y errores efímeros`), **sincronizado con `origin/main`** y con cambios locales sin commit del bloque 19 (apagado ordenado). Los bloques 17 y 18 ya están publicados (`79a386c`, `28469f0`).
- **Base previa:** `2291c3e` (`feat(panel): reemplaza la barra ASCII por duración y cuenta regresiva nativa`).
- **Remoto:** `https://github.com/LAPEORRA/cubitosmusic_dbot.git` (`origin/main`).

### Últimos commits
```
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
2. `npm test` → ✅ **106/106 pass, 0 fail** (telemetría, panel, presencia, P0, `/help`, mini-embeds públicos y apagado ordenado)
3. `npm run build` → ✅ OK (tsc → `dist/`)

> `deploy-commands` ejecutado: **12 comandos** registrados en el guild, incluido `/help`. Solo re-desplegar si cambia la definición (`data`) de algún comando.

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

## Pendientes / próximos pasos

1. **QA visual real** de la TUI en PowerShell con el bot vivo (`npm run dev`). Preview estático ya validado con `tsx`.
2. **QA manual en Discord:** banner/logs, trazas `CMD`/`BOTÓN`, botones 🔁/🔀, `/clear`, `/remove`, `/skipto`, `/help`, pausa durante buffering, autodesconexión a los 5 min y ausencia de warnings `ephemeral`. Validar los mini-embeds públicos de confirmación (visibles para el canal) frente a los rechazos efímeros, además del panel MatchBox (GIF del autor al reproducir y su ausencia en pausa, mención del solicitante, footer de estado, etiquetas de botones y cuenta regresiva `<t:…:R>` al pausar/reanudar) y el cierre «📭 Cola finalizada». Opcional: fijar un disco/vinilo girando con `PANEL_DISC_GIF_URL`.
3. **QA de apagado:** con el bot reproduciendo, probar `Ctrl + C` (SIGINT), cerrar la ventana de consola en Windows (SIGBREAK) y `SIGTERM` en Docker: debe registrar `STOP`, detener la música, dejar el panel en «📭 Cola finalizada» y salir en menos de ~3 s.
4. **Arquitectura pendiente:** panel dinámico con throttle/coalescing, TUI avanzada (`log-update`/chalk), web dashboard.

## Archivos clave

- **Consola:** `src/utils/logger.ts`
- **Panel/eventos:** `src/events/ready.ts`, `src/events/interactionCreate.ts`, `src/events/interactionResponses.ts`, `src/player/panel/panel.ts`, `src/player/panel/panel-buttons.ts`
- **Controles:** `src/player/controls.ts` (`togglePause`, `skipTrack`, `backTrack`, `toggleLoop`, `shuffleQueue`, `clearQueue`, `removeTrack`, `skipTo`, `canPlayInChannel`)
- **Comandos/registry:** `src/commands/index.ts`, `src/commands/music/*`, `src/types/commands.ts`
- **Config:** `src/config.ts`
- **Tests:** `tests/player/*` (panel, panelButtons, controls, cola, voz, URL), `tests/events/*` (interactionCreate, interactionResponses), `tests/commands/*`, `tests/utils/logger.test.ts`

## Restricciones y gotchas (leer antes de tocar reproducción)

1. **Reproducción congelada:** no cambiar en `src/commands/music/play.ts` los valores de `searchEngine`, `signal`, `volume: 70` ni el resto de `nodeOptions` sin pedido explícito. Tampoco `src/player/extractors/youtubeDlpMix.ts` ni el registro/orden de extractores en `src/index.ts`.
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
