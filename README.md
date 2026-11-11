# CubitoMusic 🎵

Bot de música para Discord, pensado para un servidor privado: reproduce desde **YouTube, YouTube Music, Spotify y SoundCloud** con panel interactivo, cola de reproducción y logs de reproducción correlacionados.

![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![discord.js](https://img.shields.io/badge/discord.js-14-5865f2)
![License](https://img.shields.io/badge/license-MIT-blue)

## Características

- Reproducción vía **yt-dlp** (`discord-player-youtubedlp`) con soporte de playlists y **radio mixes** de YouTube (`list=RD*`).
- Búsqueda por texto o URL en YouTube, YouTube Music, Spotify y SoundCloud.
- Panel interactivo con botones (anterior, pausa, saltar, detener, ver cola) y progreso en vivo.
- Cola por servidor, loop de pista, shuffle y control de volumen base.
- Todas las respuestas en **español** y efímeras (`flags: 64`).
- Logs JSON de reproducción con `playbackSessionId` para depurar.
- Registro de comandos centralizado y tipado (`src/commands/index.ts`).

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/play <url\|búsqueda>` | Reproduce una canción, playlist o búsqueda |
| `/skip` | Salta a la siguiente pista |
| `/stop` | Detiene la reproducción y limpia la cola |
| `/queue` | Muestra la cola de reproducción |
| `/pause` | Pausa o reanuda la reproducción |
| `/loop` | Activa o desactiva la repetición de la pista |
| `/shuffle` | Mezcla el orden de la cola |
| `/nowplaying` | Muestra la canción actual |

Mientras hay reproducción, el bot mantiene un panel con botones equivalentes en el canal de texto.

## Requisitos

- **Node.js 22+** (desarrollo verificado con Node 26).
- Una aplicación en el [Discord Developer Portal](https://discord.com/developers/applications) con un bot.
- No hacen falta intents privilegiados: solo `Guilds` y `GuildVoiceStates`.

## Instalación

```bash
git clone https://github.com/LAPEORRA/cubitosmusic_dbot.git
cd cubitosmusic_dbot
npm ci
cp .env.example .env   # en Windows: copy .env.example .env
```

Edita `.env` con tus credenciales:

```env
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id
GUILD_ID=tu_guild_id

# Opcional (mejora la resolución de Spotify)
SPOTIFY_CLIENT_ID=tu_client_id_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_spotify
```

Registra los comandos y arranca:

```bash
npm run deploy-commands   # registro en la guild de GUILD_ID (instantáneo)
npm run dev               # desarrollo con tsx
```

## Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Arranca con `tsx` (sin auto-reload; usa `npx tsx watch src/index.ts` si lo quieres) |
| `npm run build` | Compila a `dist/` con `tsc` |
| `npm start` | Ejecuta `node dist/index.js` |
| `npm test` | Pruebas de regresión con `node:test` + `tsx` |
| `npm run typecheck` | Comprueba tipos de `src/` y de `tests/` + `scripts/` |
| `npm run deploy-commands` | Registra los slash commands en la guild |
| `npm run deploy-commands -- --global` | Registra los comandos globalmente (tarda hasta 1 h) |

## Estructura

```
├── src/
│   ├── index.ts              # Bootstrap: client, Player, extractores, login
│   ├── config.ts             # Validación tipada de variables de entorno
│   ├── commands/
│   │   ├── index.ts          # Registro tipado (router + deploy)
│   │   └── music/            # /play, /skip, /stop, /queue, /pause, /loop, /shuffle, /nowplaying
│   ├── events/               # ready, interactionCreate, interactionResponses
│   ├── player/
│   │   ├── extractors/       # YouTubeDlpMixExtractor (radio mixes)
│   │   ├── panel/            # Panel interactivo y botones
│   │   ├── controls.ts       # Helpers de control y validación de voz
│   │   ├── queueSummary.ts   # Formato de cola compartido
│   │   ├── url.ts            # normalizeUrl (testeado)
│   │   └── audioPreset.ts    # Preset de compresor DSP
│   └── types/                # Contratos compartidos
├── tests/                    # Pruebas (commands, events, player)
├── scripts/                  # deploy-commands.ts
├── docs/                     # Arquitectura, setup y páginas legales
├── .github/                  # CI, plantillas de issue/PR
└── AGENTS.md                 # Contexto para agentes/IA
```

## Documentación

- [Arquitectura y gotchas](docs/ARCHITECTURE.md) — **léelo antes de tocar reproducción**.
- [Guía de instalación paso a paso](docs/SETUP.md).
- [Cómo contribuir](CONTRIBUTING.md).
- Legal: [Condiciones del Servicio](docs/legal/terms.html) · [Política de Privacidad](docs/legal/privacy.html).

> Las URLs `privacy.html` y `terms.html` de la raíz son stubs de compatibilidad que redirigen a `docs/legal/`. Se mantienen porque están registradas en el Discord Developer Portal.

## Restricción importante

La ruta de reproducción está **congelada**: no se debe cambiar `play.ts` (salvo textos), la resolución de radio mixes, el orden/opciones de los extractores, ni usar filtros ffmpeg (`setFilters` provoca `write EPIPE`). Detalles en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
