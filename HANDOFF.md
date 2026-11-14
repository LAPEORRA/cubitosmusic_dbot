# Handoff — CubitoMusic

> Documento de traspaso de sesión: estado del proyecto al **14-nov-2026** para retomar en una sesión fresca.

## Estado actual

- **Carpeta activa:** `D:\cubitosmusic` (reubicado desde `D:\Proyectos_Opencode`).
- **Git:** rama `main`, `HEAD` en `c425d21`, sincronizada con `origin/main` al último `git fetch`. El lote local (`.gitignore`, `AGENTS.md`, `HANDOFF.md`, `package.json`, `src/events/ready.ts`, `tests/events/ready.test.ts` y el nuevo `.github/copilot-instructions.md`) fue **revisado y está listo para cierre**; se agrupa en el commit `chore(telemetry): trazas live-trace, deduplicación de errores y ritual de contexto`. **Push pendiente** de autorización.
- **Base previa:** `262cb79` (`feat: autodesconexión por inactividad y botones loop/shuffle en el panel`).
- **Remoto:** `https://github.com/LAPEORRA/cubitosmusic_dbot.git` (`origin/main`). El commit `c425d21` ya está publicado; los cambios listados arriba siguen locales.

### Últimos commits
```
c425d21 fix: reanudar audio antes de saltar, corregir logs de playlists y validar Spotify parcial
d62343e fix: sanitización multilínea en TUI, detalle de error por pista y feedback en /skipto
8c1ac17 fix: deduplicación de interacciones, silencio de 10062/40060 y eliminación de ephemeral
039f736 fix: limpieza de Maps en panel, manejo de queueDelete y sanitización de errores en /play
262cb79 feat: autodesconexión por inactividad y botones loop/shuffle en el panel
cd30a8c feat: comandos de gestión de cola clear, remove y skipto
a864230 fix: solicitante por pista, guardia de canal en /play y correcciones en panel
4a61ee6 fix: alineación final de la TUI, banner dinámico y logs de comandos/botones
a3ebb8d docs: handoff para retomar la sesión actual
80e26bb fix: consola TUI de logs - banner, colores por columna, ping y separador
2bad085 feat: consola TUI de logs con banner, tabla alineada y métricas de sistema
a3c5687 refactor: reorganiza el proyecto para revisión en GitHub
```

## Verificación (todo en verde al cerrar)

1. `npm run typecheck` → ✅ 0 errores (src + tests + scripts)
2. `npm test` → ✅ **71/71 pass, 0 fail** (incluye deduplicación de errores y trazas LIVE_TRACE)
3. `npm run build` → ✅ OK (tsc → `dist/`)

> `deploy-commands` ya se ejecutó: **11 comandos** registrados en el guild (`play, skip, skipto, clear, remove, stop, queue, pause, loop, shuffle, nowplaying`). Solo re-desplegar si cambia la definición (`data`) de algún comando.

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
- Cambios locales revisados y listos para cierre. Se agrupan en el commit `chore(telemetry): trazas live-trace, deduplicación de errores y ritual de contexto`; **sin push**.
- Verificación: `npm run context` ✅ (30 archivos), `npm run typecheck` ✅, `npm test` ✅ **71/71**, `npm run build` ✅.

## Pendientes / próximos pasos

1. **Push pendiente:** el lote local revisado se cierra en `chore(telemetry): trazas live-trace, deduplicación de errores y ritual de contexto`; publicar solo cuando Santiago lo autorice.
2. **QA visual real** de la TUI en PowerShell con el bot vivo (`npm run dev`). Preview estático ya validado con `tsx`.
3. **QA manual en Discord:** banner/logs, trazas `CMD`/`BOTÓN`, botones 🔁/🔀, `/clear`, `/remove`, `/skipto`, autodesconexión a los 5 min y ausencia de warnings `ephemeral`.
4. **Bugs P0 restantes (no tocados):** panel congelado en casos borde, `/stop` que no desconecta, `/pause` toggle, `audioPreset` privado.
5. **Arquitectura pendiente:** panel dinámico con throttle/coalescing, TUI avanzada (`log-update`/chalk), presence, web dashboard.

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
7. **Respuestas al usuario:** español, siempre `flags: 64` (ephemeral). **No** usar la propiedad `ephemeral: true` (deprecada en discord.js v14.27).

## Lecciones del entorno

- `D:\Proyectos_Opencode` NO es escribible (ACL de otro Windows/SID); el respaldo quedó intacto, no borrarlo sin admin.
- Git instalado vía winget (`Git.Git` 2.56.0): usar `C:\Program Files\Git\cmd\git.exe` si `git` no resuelve.
- Shell (PowerShell): **no** soporta `&&`; separar comandos con `;`. El wrapper no maneja redirecciones `>`: usar variables o construcciones sin redirect.
- `npm run dev` es `tsx src/index.ts` **sin watch**; para hot reload: `npx tsx watch src/index.ts`.
