# AGENTS.md

## Proyecto
Bot de Discord: discord.js v14+, TypeScript, ESM
Funciones: slash commands, reproducción de audio desde Spotify, YouTube Music y YouTube (solo audio)

## Stack
- Runtime: Node.js 20+
- Discord: discord.js v14
- Voz: @discordjs/voice
- Motor de música: discord-player v6+ con extractors
- Extractors: @discord-player/extractor, @discord-player/spotify, @discord-player/youtube
- Codificación de audio: sodium-native (preferido) o @discordjs/opusscript
- Procesamiento de audio: ffmpeg (ffmpeg-static o instalación del sistema)

## Variables de entorno
Requeridas en .env:
- DISCORD_TOKEN — Token del bot desde Discord Developer Portal
- CLIENT_ID — ID de la aplicación/cliente para registro de comandos
- GUILD_ID — ID del servidor de desarrollo (registro instantáneo vs 1h global)
- SPOTIFY_CLIENT_ID — Para fuente de Spotify (opcional, mejora calidad)
- SPOTIFY_CLIENT_SECRET — Para fuente de Spotify (opcional)

## Comandos
- npm run dev — modo watch con tsx
- npm run build — compilar con tsc
- npm start — ejecutar node dist/index.js
- npm run deploy-commands — registrar slash commands con la API de Discord

## Arquitectura
```
src/
├── index.ts              — Bootstrap del cliente, login, carga de handlers
├── deploy-commands.ts    — Registrar slash commands vía REST
├── commands/
│   ├── play.ts           — /play <url|búsqueda>
│   ├── skip.ts           — /skip
│   ├── stop.ts           — /stop y desconectar
│   ├── queue.ts          — /queue mostrar cola
│   └── pause.ts          — /pause, /resume
├── events/
│   ├── ready.ts          — Evento client ready
│   └── interactionCreate.ts — Enrutamiento de slash commands
├── player/
│   └── setup.ts          — Inicialización de discord-player, registro de extractors
└── types/
    └── index.ts          — Tipos compartidos
```

## Configuración de discord-player (ruta crítica)
1. Crear instancia de Player desde discord-player
2. Registrar extractors: YouTubeExtractor, SpotifyExtractor, etc.
3. En /play: extraer query, player.play(channel, query) detecta la fuente automáticamente
4. Player usa @discordjs/voice para la conexión de voz automáticamente

## Gotchas de ESM
- package.json debe tener `"type": "module"`
- Imports locales requieren extensión `.js`: `import { foo } from './utils.js'`
- tsconfig.json target: ESNext, module: NodeNext o Node16
- Usar tsx para dev (rápido, sin paso de compilación), tsc + node para prod

## Gotchas de Voz
- ffmpeg debe estar disponible (ffmpeg-static lo provee)
- sodium-native es más rápido que opusscript pero requiere build nativo
- @discordjs/voice AudioPlayer necesita recurso de audio de discord-player
- El bot debe estar en el mismo canal de voz que el usuario para reproducir

## Notas sobre fuentes de música
- YouTube: funciona directo con el extractor de YouTube
- YouTube Music: mismo extractor que YouTube, usar prefijo `ytmusic:` o query de búsqueda
- Spotify: necesita SPOTIFY_CLIENT_ID/SECRET; resuelve track URL a YouTube para reproducción
- Rate limits: no spamear comandos de play; encolar tracks secuencialmente

## Tips de desarrollo
- Usar comandos de guild (GUILD_ID) durante dev para registro instantáneo
- El registro global de comandos tarda hasta 1 hora en propagarse
- Probar voz en un canal privado primero
- Usar `tsx --watch` para hot reload durante desarrollo
