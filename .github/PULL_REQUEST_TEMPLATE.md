## Qué cambia

<!-- Resumen corto del cambio y por qué. -->

## Tipo de cambio

- [ ] Bugfix
- [ ] Nueva funcionalidad
- [ ] Refactor / limpieza (sin cambio de comportamiento)
- [ ] Documentación
- [ ] CI / tooling

## Checklist

- [ ] `npm run typecheck` pasa
- [ ] `npm test` pasa
- [ ] `npm run build` pasa
- [ ] No he tocado la ruta congelada de reproducción (`src/commands/music/play.ts` salvo textos, `src/player/extractors/youtubeDlpMix.ts`, orden/opciones de extractores, filtros ffmpeg)
- [ ] Los textos nuevos están en español; confirmaciones como mini-embeds públicos y errores/rechazos con `flags: 64`
- [ ] Si cambié la definición de un comando, lo indico para re-ejecutar `npm run deploy-commands`

## Cómo probarlo

<!-- Pasos de QA manual en Discord + tests añadidos. -->

## Notas para revisión

<!-- Riesgos, decisiones de diseño, capturas de la consola si aplica. -->
