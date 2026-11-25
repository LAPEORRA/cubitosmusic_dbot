---
name: project-ritual
description: Inicializa o mantiene un flujo ligero de desarrollo asistido por IA con AGENTS.md, HANDOFF.md, sub-agentes (research, executor, verifier) y punteros opcionales para ejecutores externos.
---

# Skill: project-ritual

Flujo estándar, agnóstico e interoperable de desarrollo asistido por IA. Funciona con cualquier stack o lenguaje y mantiene al **repositorio como única fuente de verdad**, evitando depender de historiales de chat o copiar/pegar manual.

---

## Roles y Cadena de Mando

- **Product Owner (Usuario):** Define objetivos y prioridades, aprueba decisiones de arquitectura o cambios en zonas congeladas y autoriza commits/push.
- **Antigravity — Agente principal (Orquestador, Coordinador y Auditor):** Lee `AGENTS.md`, `HANDOFF.md` y el estado real del repositorio. Su foco exclusivo es pensar, diagnosticar, diseñar la arquitectura, auditar código/logs/diffs, proteger las zonas congeladas y tomar decisiones; **nunca un solo agente piensa, planifica, escribe código y depura todo por sí mismo**: delega la ejecución operativa en brazos especializados para mantener el cerebro principal enfocado.
- **Sub-agentes delegables (brazos de ejecución y verificación):**
  - `research` (solo lectura): explora código, dependencias, logs o diffs largos sin saturar el contexto del coordinador.
  - `executor` (escritura acotada): implementa cambios puntuales asignados por el coordinador, respetando `AGENTS.md` y las zonas congeladas.
  - `verifier` (QA): ejecuta los comandos de verificación definidos en `AGENTS.md` y valida que el diff final respete las zonas congeladas.
- **Ejecutores externos (opcional, ej. OpenCode, GitHub Copilot, CLIs):** Operan como brazos externos estrictamente operativos sobre el alcance asignado o con prompts atómicos del coordinador, siguiendo `AGENTS.md` y `HANDOFF.md` sin adelantarse a decisiones de arquitectura.

---

## Modo Inicialización (Proyectos nuevos o sin ritual)

Usar cuando el usuario pida inicializar el flujo o "aplicar el ritual" en un proyecto.

1. **Detectar el stack real:** Inspeccionar archivos raíz (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Dockerfile`, etc.) para adaptar comandos y estructura a la realidad del proyecto.
2. **Crear `AGENTS.md` en la raíz:** Debe documentar:
   - Roles y principio de repositorio como fuente de verdad.
   - Stack real y estructura de carpetas.
   - Comandos exactos de verificación según el stack (ej. `lint`, `typecheck`, `test`, `build`).
   - Sección de **Zonas congeladas** (vacía al inicio; si ya existe en el proyecto, respetar el encabezado existente).
   - **Checklist de Cierre**.
3. **Crear `HANDOFF.md` en la raíz:** Estado inicial con fecha, objetivo, estado de verificación, último commit y pendientes.
4. **Punteros de ejecutores externos (opcional):** Si el proyecto utiliza herramientas externas (p. ej. `.github/copilot-instructions.md`), crear un puntero corto que remita a `AGENTS.md` y `HANDOFF.md`.
5. **Exportación de contexto (opcional):** Solo si se requiere compartir contexto con herramientas sin acceso directo al repo, añadir un script de exportación e ignorar el archivo generado en `.gitignore`.

---

## Modo Ejecución y Cierre (En cada sesión)

### Antes de empezar
1. **Reconocimiento Táctico (Git):** Si es un repositorio Git, ejecutar `git fetch origin` (si existe remoto) y `git status --short --branch`. Informar si la rama está adelantada, atrasada o divergente, y señalar cambios locales o conflictos a preservar antes de editar.
2. **Leer `AGENTS.md`:** Recuperar roles, zonas congeladas, convenciones y comandos de verificación.
3. **Leer `HANDOFF.md`:** Recuperar el punto exacto donde quedó el trabajo y los pendientes.

### Antes de dar una tarea por terminada
1. **Verificación obligatoria:** Ejecutar la suite de verificación definida en `AGENTS.md` (o delegarla a `verifier`) y confirmar que todo pase.
2. **Actualizar `HANDOFF.md`:** Leerlo completo antes de escribir y registrar: fecha, último commit, resultado de verificación, quién actualizó (agente/sub-agente/ejecutor/usuario) y próximos pasos.
3. **Punteros externos (si aplican):** Verificar que los archivos de puntero configurados (ej. `.github/copilot-instructions.md`) sigan apuntando a `AGENTS.md` y `HANDOFF.md`.
4. **Commit propuesto:** Proponer un commit atómico con Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). **No crear commits ni hacer push** salvo pedido explícito del Product Owner.

### Checklist de Cierre
- [ ] Comandos de verificación de `AGENTS.md` en verde.
- [ ] Zonas congeladas respetadas.
- [ ] `HANDOFF.md` actualizado (fecha, commit, verificación, autor, pendientes).
- [ ] Punteros de ejecutores externos vigentes (si aplican).
- [ ] Commit atómico propuesto; sin commit/push sin autorización explícita.
