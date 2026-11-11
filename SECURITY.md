# Política de Seguridad

## Versiones soportadas

Se da soporte a la última versión de `main`. No hay ramas de mantenimiento.

## Reportar una vulnerabilidad

**No abras un issue público** con detalles explotables ni pegues credenciales.

Usa el canal privado de GitHub (*Security → Report a vulnerability*) o contacta directamente con el mantenedor del repositorio (`@LAPEORRA`) por Discord.

Incluye, si puedes:

- Versión / commit afectado.
- Pasos de reproducción.
- Impacto esperado (p. ej. ejecución de comandos, fuga de datos, caída del bot).

## Qué se considera vulnerabilidad

- Fuga de `DISCORD_TOKEN`, `SPOTIFY_CLIENT_SECRET` u otras credenciales.
- Ejecución de código o inyección a través de entradas de usuario (títulos, URLs, playlists).
- Bypass de las comprobaciones de canal de voz (control de reproducción por usuarios no autorizados).
- Denegación de servicio provocada por una sola interacción (p. ej. colas o payloads gigantes).

## Buenas prácticas para despliegues

- Guarda `.env` fuera del repositorio y nunca lo subas (está en `.gitignore`).
- Usa un bot de pruebas en desarrollo; no compartas el token de producción.
- Rota el token inmediatamente si sospechas que se ha filtrado.
- Revisa que `npm ci` instala desde `package-lock.json` (dependencias reproducibles).
