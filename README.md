# CubitoMusic 🎵

Bot de Discord para reproducir música desde YouTube, YouTube Music y Spotify.

## Características

- Reproducir música desde **YouTube**, **YouTube Music** y **Spotify**
- Comandos slash modernos (`/play`, `/skip`, `/stop`, `/queue`, `/pause`)
- Gestión de cola de reproducción
- Calidad de audio optimizada
- Fácil configuración

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/play <url\|búsqueda>` | Reproduce música desde YouTube, Spotify o URL |
| `/skip` | Siguiente pista |
| `/stop` | Detiene la música y desconecta |
| `/queue` | Muestra la cola de reproducción |
| `/pause` | Pausa o reanuda la reproducción |

## Requisitos

- Node.js 20+
- Cuenta en [Discord Developer Portal](https://discord.com/developers/applications)
- Token del bot de Discord

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/LAPEORRA/cubitosmusic_dbot.git
cd cubitosmusic_dbot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

## Configuración

1. Crear una aplicación en [Discord Developer Portal](https://discord.com/developers/applications)
2. Crear un bot y copiar el token
3. Activar los Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
4. Configurar URLs de Condiciones del Servicio y Política de Privacidad
5. Generar URL de invitación con permisos de voz
6. Invitar el bot a tu servidor
7. Ejecutar `npm run deploy-commands` para registrar comandos
8. Ejecutar `npm run dev` para iniciar el bot

## Variables de Entorno

```env
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id
GUILD_ID=tu_guild_id

# Opcional - para Spotify
SPOTIFY_CLIENT_ID=tu_client_id_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_spotify
```

## Desarrollo

```bash
# Modo desarrollo con hot reload
npm run dev

# Compilar para producción
npm run build

# Ejecutar en producción
npm start

# Registrar comandos slash
npm run deploy-commands
```

## Tecnologías

- [Discord.js](https://discord.js.org/) - Framework de Discord para Node.js
- [discord-player](https://discord-player.js.org/) - Framework de música para Discord
- [TypeScript](https://www.typescriptlang.org/) - JavaScript con tipos
- [ESM](https://nodejs.org/api/esm.html) - ES Modules

## Estructura del Proyecto

```
cubitosmusic_dbot/
├── src/
│   ├── index.ts              # Bootstrap del cliente
│   ├── deploy-commands.ts    # Registro de comandos
│   ├── commands/             # Comandos slash
│   │   ├── play.ts
│   │   ├── skip.ts
│   │   ├── stop.ts
│   │   ├── queue.ts
│   │   └── pause.ts
│   ├── events/               # Eventos de Discord
│   │   ├── ready.ts
│   │   └── interactionCreate.ts
│   ├── player/               # Configuración del player
│   │   └── setup.ts
│   └── types/                # Tipos compartidos
│       └── index.ts
├── Setup_CubitoMusic.md      # Guía de instalación
├── Condiciones_ServiciosCM.md
├── Politicas-PrivacidadCM.md
├── AGENTS.md
├── package.json
└── .env.example
```

## Licencia

MIT

## Soporte

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord.js Documentation](https://discord.js.org/)
- [discord-player Documentation](https://discord-player.js.org/)

---

Desarrollado con ❤️ para la comunidad de Discord
