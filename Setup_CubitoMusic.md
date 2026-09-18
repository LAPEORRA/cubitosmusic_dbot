# Setup CubitoMusic

Guía paso a paso para configurar y agregar el bot **CubitoMusic** a tu servidor de Discord.

---

## Requisitos previos

- Cuenta en [Discord Developer Portal](https://discord.com/developers/applications)
- Cuenta en [Discord](https://discord.com) con permisos de administrador en el servidor donde quieres agregar el bot
- Node.js 20+ instalado en tu máquina o servidor

---

## Paso 1: Crear la aplicación

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Clic **"New Application"**
3. Nombre: **CubitoMusic**
4. Clic **"Create"**

---

## Paso 2: Asociar a un Team (Recomendado)

Asociar la aplicación a un Team permite compartir el acceso con otros desarrolladores y gestiona mejor los permisos.

1. En el menú izquierdo, ve a **"Team"**
2. Si ya tienes un Team, selecciónalo
3. Si no tienes un Team:
   - Clic **"Create Team"**
   - Nombre: **CubitoMusic Team** (o el que prefieras)
   - Clic **"Create"**
4. Una vez creado/seleccionado el Team, la aplicación se asociará automáticamente

**Nota:** Asociar a un Team es opcional pero recomendado para:
- Compartir acceso con otros desarrolladores
- Gestionar permisos de forma centralizada
- Mantener la aplicación si cambias de cuenta

---

## Paso 3: Configurar el Bot

1. En el menú izquierdo, ve a **"Bot"**
2. En **"Username"**, cambia a: **CubitoMusic**
3. En **"Icon"**, sube un icono para el bot (opcional)
4. En **"Privileged Gateway Intents"**, activa:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Clic **"Save Changes"**
6. En **"TOKEN"**, clic **"Copy"** y guárdalo (lo necesitarás después)

⚠️ **Importante:** Nunca compartas tu token públicamente.

---

## Paso 4: Generar enlaces requeridos

### Condiciones del Servicio

1. Crea un archivo `Condiciones_ServiciosCM.md` con las condiciones del servicio de tu bot
2. Publicalo en GitHub, Discord o cualquier plataforma accesible
3. Anota la URL (la usarás en el Developer Portal)

### Política de Privacidad

1. Crea un archivo `Politicas-PrivacidadCM.md` con la política de privacidad
2. Publicalo en la misma plataforma que las condiciones
3. Anota la URL

### Configurar enlaces en Developer Portal

1. Ve a **"General Information"**
2. En **"Terms of Service URL"**, pega la URL de las condiciones
3. En **"Privacy Policy URL"**, pega la URL de la política de privacidad
4. Clic **"Save Changes"**

---

## Paso 5: Configurar OAuth2

1. En el menú izquierdo, ve a **"OAuth2"**
2. En **"CLIENT ID"**, copia el ID (lo necesitarás para `.env`)

### Generar URL de invitación

1. Ve a **"OAuth2" → "URL Generator"**
2. En **"SCOPES"**, selecciona:
   - ✅ `bot`
   - ✅ `applications.commands`
3. En **"BOT PERMISSIONS"**, selecciona:
   - ✅ Send Messages
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity
   - ✅ Use External Sounds
4. Copia la URL generada en **"Generated URL"**

---

## Paso 6: Obtener Guild ID

1. Abre Discord
2. Ve a **Ajustes → Avanzado**
3. Activa **"Modo Desarrollador"**
4. Ve a tu servidor de Discord
5. Clic derecho en el icono del servidor → **"Copy Server ID"**

---

## Paso 7: Configurar variables de entorno

Edita el archivo `.env` en la raíz del proyecto:

```env
DISCORD_TOKEN=tu_token_del_bot_aquí
CLIENT_ID=tu_client_id_aquí
GUILD_ID=tu_guild_id_aquí

# Opcional - para Spotify
SPOTIFY_CLIENT_ID=tu_client_id_spotify_aquí
SPOTIFY_CLIENT_SECRET=tu_client_secret_spotify_aquí
```

---

## Paso 8: Invitar el bot al servidor

1. Pega la URL que generaste en el Paso 5 en tu navegador
2. Selecciona tu servidor de Discord
3. Clic **"Authorize"**
4. Completa el CAPTCHA si es necesario

---

## Paso 9: Registrar comandos slash

```bash
npm run deploy-commands
```

Los comandos tardan hasta 1 hora en propagarse globalmente. Para registro instantáneo, asegúrate de usar `GUILD_ID` en `.env`.

---

## Paso 10: Iniciar el bot

```bash
npm run dev
```

Deberías ver:
```
🚀 Bot iniciado, esperando eventos de Discord...
✅ Bot listo como: CubitoMusic#1234
```

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/play <url\|búsqueda>` | Reproduce música desde YouTube, Spotify o URL |
| `/skip` | Siguiente pista |
| `/stop` | Detiene la música y desconecta |
| `/queue` | Muestra la cola de reproducción |
| `/pause` | Pausa o reanuda la reproducción |

---

## Solución de problemas

### El bot no responde
- Verifica que el token sea correcto
- Asegúrate de que el bot tenga permisos en el canal de voz
- Verifica que el bot esté en línea (estado verde en Discord)

### El bot no se conecta al canal de voz
- Verifica que tengas permisos de "Connect" en el canal
- Asegúrate de estar en el canal de voz antes de usar `/play`

### Error "Missing Permissions"
- Revisa los permisos del bot en el servidor
- Verifica que la invitación incluyera los permisos necesarios

---

## Enlaces útiles

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord.js Documentation](https://discord.js.org/)
- [discord-player Documentation](https://discord-player.js.org/)
