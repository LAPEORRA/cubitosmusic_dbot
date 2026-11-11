# Changelog

Todas las versiones relevantes de CubitoMusic. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- Registro tipado de comandos (`src/commands/index.ts`): router y despliegue comparten la misma fuente de verdad.
- `src/config.ts`: validación centralizada y tipada de variables de entorno.
- `src/player/url.ts`: `normalizeUrl` extraído de `play.ts` con tests de tabla.
- Script `npm run typecheck` (incluye `tests/` y `scripts/`).
- CI en GitHub Actions (typecheck + tests + build), plantillas de issue/PR y documentación de contribución.
- `scripts/deploy-commands.ts` admite `--global` además del registro por guild.

### Cambiado

- Estructura reorganizada: `commands/music/`, `player/extractors/`, `player/panel/`, `tests/`, `scripts/`.
- Documentación consolidada en `docs/ARCHITECTURE.md` y `docs/SETUP.md`.
- `package.json` normalizado (`name: cubitosmusic`, `version: 1.1.0`, metadatos y scripts).

### Corregido

- `.gitignore` ya no excluye `.env.example` por accidente.
- `npm start` dejaba de ejecutar código obsoleto al eliminar `dist/` del repositorio.

### Notas

- Las URLs `privacy.html` y `terms.html` de la raíz siguen respondiendo 200: son stubs que redirigen a `docs/legal/`.

## [1.1.0] - 2026-09-24

### Añadido

- Reproducción con yt-dlp y resolución de radio mixes de YouTube (`list=RD*`) como playlist.
- Panel interactivo con botones y estado de cola vacía.
- Logs JSON de reproducción correlacionados con `playbackSessionId`.
- Preset de compresor DSP por cola.

## [1.0.0]

- Versión inicial: `/play`, `/skip`, `/stop`, `/queue`, `/pause`.
