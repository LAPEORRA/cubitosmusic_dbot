# Contribuir a CubitoMusic

¡Gracias por querer ayudar! Este documento explica cómo está organizado el proyecto y qué esperamos de un cambio.

## Antes de empezar

1. Lee [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — sobre todo la sección de **gotchas**.
2. Lee [`AGENTS.md`](AGENTS.md) si vas a usar un agente de IA: contiene el contexto operativo del proyecto.
3. Comprueba que existe una issue abierta para lo que quieres hacer (o ábrela).

## Puesta en marcha

```bash
git clone https://github.com/LAPEORRA/cubitosmusic_dbot.git
cd cubitosmusic_dbot
npm ci
cp .env.example .env   # rellena DISCORD_TOKEN, CLIENT_ID y GUILD_ID
npm run typecheck
npm test
```

Necesitas un servidor de pruebas y un bot propio en el Discord Developer Portal. **Nunca uses el token de producción en un fork.**

## Flujo de trabajo

1. Crea una rama: `feat/mi-comando`, `fix/panel-congelado`, `docs/setup`.
2. Haz cambios pequeños y enfocados.
3. Ejecuta la verificación completa:

   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

4. QA manual en Discord si el cambio afecta a reproducción o panel.
5. Abre un Pull Request describiendo qué cambia y cómo lo probaste.

## Reglas del proyecto

### La reproducción está congelada

Estos archivos no se tocan salvo que el PR lo justifique explícitamente y se pruebe a fondo en Discord:

- `src/commands/music/play.ts` — `searchEngine`, `signal`, `nodeOptions`, `volume: 70`
- `src/player/extractors/youtubeDlpMix.ts` — radio mixes (`list=RD*`)
- El registro de extractores en `src/index.ts` (el orden importa)
- Cualquier filtro ffmpeg: **`queue.filters.ffmpeg.setFilters()` rompe el stream** (`write EPIPE`)

### Convenciones de código

- TypeScript estricto + ESM: los imports locales llevan extensión `.js`.
- Respuestas al usuario en **español** y siempre `flags: 64` (efímeras).
- No metas `any` nuevos sin justificar; el objetivo es ir tipando los handlers.
- Los comandos nuevos se registran en `src/commands/index.ts` (no hay `switch` que tocar).

### Añadir un comando

1. Crea `src/commands/<categoría>/<nombre>.ts` exportando `data` y `run`.
2. Impórtalo y añade su entrada en `src/commands/index.ts`.
3. Añade tests de la lógica pura que puedas aislar en `tests/`.
4. Si cambiaste `data`, avisa en el PR para re-ejecutar `npm run deploy-commands`.

## Tests

- Framework: `node:test` ejecutado con `tsx` (`npm test`).
- Estructura: `tests/commands/`, `tests/events/`, `tests/player/`.
- Se valora más un test de tabla/unitario que un test que dependa de Discord.

## Seguridad

- No abras issues con tokens, cookies ni datos personales.
- Para vulnerabilidades, sigue [`SECURITY.md`](SECURITY.md).

## Licencia

Al contribuir aceptas que tu aportación se publique bajo la licencia MIT del proyecto.
