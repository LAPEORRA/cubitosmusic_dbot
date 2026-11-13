# Handoff — CubitoMusic

> Documento de traspaso de sesión: resume el estado actual del proyecto para retomar en una sesión fresca.

## Estado actual

- **Carpeta activa del proyecto:** `D:\cubitosmusic` (el workspace ha sido reubicado desde `D:\Proyectos_Opencode`).
- **Es un repositorio git:** rama `main`. TUI ya commiteada (`4a61ee6`); el bloque de **fixes P0 está aplicado y verificado, sin commitear**.
- **Últimos commits:**
  - `4a61ee6` — fix: alineación final de la TUI, banner dinámico y logs de comandos/botones
  - `a3ebb8d` — docs: handoff para retomar la sesión actual
  - `80e26bb` — fix: consola TUI de logs - banner, colores por columna, ping y separador
  - `2bad085` — feat: consola TUI de logs con banner, tabla alineada y métricas de sistema
  - `a3c5687` — refactor: reorganiza el proyecto para revisión en GitHub
- **Remoto:** `https://github.com/LAPEORRA/cubitosmusic_dbot.git` (`origin/main`). **Push pendiente** (no se hizo, por decisión del usuario).

## Verificación (todos en verde al último cambio)

1. `npm run typecheck` → ✅ 0 errores (incluye `tsconfig.test.json`: src + tests + scripts)
2. `npm test` → ✅ **29/29 pass, 0 fail**
3. `npm run build` → ✅ OK (tsc → `dist/`)

## Qué se implementó en la fase de consola TUI (última tarea completada)

- **`src/utils/logger.ts`** (nuevo):
  - ANSI helpers (`ANSI_COLORS`, `paint`).
  - `formatLogTime` → `HH:MM:SS` (zona `America/Santiago`).
  - `getSystemMetrics(client?)` → `RAM X.XMB • Ping Xms` / fallback `calculando...` si ping es `-1`/`undefined`.
  - `printStartupBanner(info)`: salto de línea (`console.log('')` si TTY) + recuadro Unicode de ancho dinámico + encabezado de tabla con separador derivado de las columnas.
  - `logRow({ badge, color, channel, detail, metrics, rawJson })`: columnas con colores propios (HORA gray, EVENTO badge color+bold, CANAL cyan, DETALLES normal, MÉTRICAS gray), detalle truncado a 50 chars + `…`, escritura opcional a `logs/playback.jsonl` si `LOG_TO_FILE=true`.
- **`src/events/ready.ts`**:
  - Firma: `ready(client, player, guildId, spotifyEnabled = false)`.
  - `await client.guilds.fetch(guildId)` antes de `printStartupBanner` (nombre real del guild); eliminado el `console.log` residual.
  - `logPlaybackEvent` con badges: `SESIÓN` (blue), `+COLA` (cyan), `▶ PLAY` (green), `PAUSA` (yellow), `REANUDA` (green), `VACÍA` (magenta), `STOP` (gray), `ERROR`/`ERR AUDIO` (red). Multi-playlist: `Playlist: X (+N pistas)`.
- **`src/index.ts`**: sin `console.log` sueltos previos al banner; pasa `Boolean(config.spotify)` a `ready`.
- **`src/player/audioPreset.ts`**: eliminado `console.log`.
- **Tests:** `tests/utils/logger.test.ts` (nuevo, 8 tests). Total suite: 21 tests.
- **Cierre de la TUI (3 ajustes):**
  - `logRow`: columnas con ancho fijo (`COL_TIME=10`, `COL_BADGE=12`, `COL_CHANNEL=16`, `COL_DETAIL=52`); DETALLES se trunca a 50 + `…` y se rellena a 52 con `pad`; fila emitida como **un único string** (sin comas extra en `console.log`). Canal/badge se truncan con `fit`.
  - `printStartupBanner`: ancho del recuadro **dinámico** según el contenido (mínimo 44, máx. 60 con truncado `…`), por lo que el borde derecho queda alineado incluso con `calculando...` o nombres largos; separador y encabezado derivan del mismo ancho de columnas.
  - Trazas de interacción: `interactionCreate` registra badge `CMD` (magenta, `Usuario /<comando>`); `handlePanelButton` registra `BOTÓN` (magenta, `Clic en <acción>`) antes del `switch`.
  - Tests nuevos de alineación: DETALLES a 52, MÉTRICAS en offset fijo, borde del banner alineado. Suite: **23 tests**.

## Fixes P0 aplicados (última tarea, sin commitear)

1. **Solicitante por pista** — `play.ts` pasa `requestedBy: interaction.user` como opción directa de `player.play()` (ya no dentro de `nodeOptions.metadata`, que solo se aplica al crear la cola) y refresca `requestedBy` en las pistas devueltas para cubrir la caché de búsquedas (5 h). `ready.ts` ya no lee el solicitante de `queue.metadata`; `buildPanelEmbed` prioriza `track.requestedBy?.username` y usa el fallback solo si falta.
2. **Validación de canal en `/play`** — helper `canPlayInChannel(botChannelId, userChannelId)` en `controls.ts`; si el bot ya tiene cola en otro canal, `/play` responde pidiendo unirse a `<#canal>`.
3. **Doble render del panel** — eliminado el `updatePanel` manual al final de `handlePanelButton`; el refresco queda solo en los eventos `playerStart`/`playerPause`/`playerResume` de `ready.ts` (`deferUpdate()` sigue ack-eando la interacción).
4. **Texto del panel** — los comandos ya no mencionan `/resume` (`→ /play <url|búsqueda> | /pause`).
5. **Tests:** +6 (prioridad de solicitante, fallback, Desconocido, sin `/resume`, guardia de canal). Suite: **29 tests**.

## Decisiones de diseño recientes

- Consola sin dependencias externas: solo ANSI nativo + `node:fs`/`node:path`. Sin animaciones nuevas; `console.clear` sustituido por salto de línea para no cortar el banner en PowerShell.
- Solo `console.log` cuando `process.stdout.isTTY` para refrescos; para escritura a archivo se usa flag env.

## Pendientes / próximos pasos sugeridos

1. **QA visual real** en terminal de Windows/PowerShell con el bot en vivo (`npm run dev` desde `D:\cubitosmusic`). Preview estático del banner/tabla ya validado con `tsx`.
2. **QA manual en Discord** del banner/logs + trazas `CMD`/`BOTÓN` (no se arrancó el bot tras el cambio).
3. **Push pendiente:** `git push origin main` desde `D:\cubitosmusic`.
4. **Bugs P0 restantes (no tocados en este bloque):** panel congelado en casos borde, `/stop` que no desconecta, fuga de Maps, `/pause` toggle, errores crudos en `/play` más allá del canal, `audioPreset` privado. (Ya corregidos: solicitante por pista, canal de `/play`, doble render y texto `/resume`).
5. **Pendiente de arquitectura:** panel dinámico con throttle/coalescing, TUI (log-update/chalk), presence, web dashboard.

## Archivos clave para retomar

- Consola: `src/utils/logger.ts`
- Eventos/loop: `src/events/ready.ts`, `src/events/interactionCreate.ts`, `src/events/interactionResponses.ts`, `src/player/panel/panel.ts`, `src/player/panel/panel-buttons.ts`
- Reproducción congelada: `src/commands/music/play.ts` (solo `searchEngine/signal/nodeOptions/volume`), `src/player/extractors/youtubeDlpMix.ts`, registro en `src/index.ts`, `src/player/url.ts`
- Comandos/registry: `src/commands/index.ts`, `src/commands/music/*`, `src/types/commands.ts`
- Config: `src/config.ts`

## Lecciones del entorno (recurrentes)

- `D:\Proyectos_Opencode` NO es escribible por el usuario actual (ACL de otro Windows / SID de máquina distinto) → se reubicó el proyecto a `D:\cubitosmusic` (copia limpia con `.git` incluido, 1.3 MB, `npm ci` reproducido).
- El antiguo `D:\Proyectos_Opencode` quedó como respaldo intacto; no se eliminó (requiere permisos de admin).
- El wrapper de shell no soporta redirecciones `>` en comandos; usar variables/constructs sin redirect si se necesita.
- Git estaba ausente → instalado vía winget (`Git.Git` 2.56.0); usar `C:\Program Files\Git\cmd\git.exe` explícito.
