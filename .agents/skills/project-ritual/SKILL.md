---
name: project-ritual
description: Inicializa o mantiene el flujo ligero de desarrollo en Antigravity con AGENTS.md, HANDOFF.md, sub-agentes (research, executor, verifier) y puntero de Copilot
---

# Skill: project-ritual

Flujo estándar de desarrollo asistido por IA para Santiago, centrado en **Google Antigravity** como coordinador con acceso directo al repositorio:

- **Product Owner:** Santiago. Define el objetivo, aprueba decisiones de arquitectura o cambios en Zonas Congeladas y autoriza commits/push.
- **Coordinador / Arquitecto:** Antigravity (agente principal). Lee `AGENTS.md`, `HANDOFF.md` y el código fuente real del repositorio (sin depender de exportar ni copiar/pegar `contexto_bot.txt`). Diagnostica, diseña soluciones, protege Zonas Congeladas y delega tareas acotadas.
- **Sub-agentes delegables (Antigravity):**
  - `research` (solo lectura): explora código, `node_modules`, logs (ej. `live-trace.jsonl`), diffs o documentación sin saturar el contexto del coordinador.
  - `executor` (escritura acotada): implementa cambios puntuales asignados por el coordinador, respetando `AGENTS.md` y Zonas Congeladas.
  - `verifier` (QA): ejecuta `typecheck`, `test`, `build` y verifica que el diff final respete las Zonas Congeladas.
- **Ejecutores externos (opcional):** OpenCode y GitHub Copilot (en VS Code o en servidor/VM). Trabajan de forma estrictamente operativa sobre el repo o con prompts atómicos del coordinador.

Principio central: **el repositorio es la única fuente de verdad**, no los chats ni el copiar/pegar manual.

---

## Reglas de Enganche (Cadena de Mando)

- **Para el Coordinador (Antigravity):** Lee `AGENTS.md` y `HANDOFF.md` antes de decidir. Delega exploración pesada a `research`, cambios acotados a `executor` (cuando convenga aislar o paralelizar) y validación final a `verifier`. Si se trabaja con ejecutores externos (OpenCode/Copilot), entrega un prompt atómico o revisa sus diffs al integrarlos.
- **Para Sub-agentes (`executor`) y Ejecutores externos (OpenCode / Copilot):** Son estrictamente operativos. No toman decisiones de arquitectura ni se adelantan al flujo. Se ciñen al alcance asignado, respetan las Zonas Congeladas en `AGENTS.md`, ejecutan los tests y reportan resultados.

---

## Modo Inicialización (Cuando se solicite en un proyecto nuevo)

1. **Crear `AGENTS.md` en la raíz:** Detectar el stack real del proyecto y documentar stack, estructura de carpetas, comandos exactos de verificación (`typecheck`, `test`, `build`, etc.), sección de zonas congeladas (vacía al inicio; en un proyecto existente respetar el nombre que ya tenga) y **Checklist de Cierre**.
2. **Crear `.github/copilot-instructions.md`:** Puntero corto que obligue a Copilot a leer `AGENTS.md` y consultar/actualizar `HANDOFF.md`.
3. **Crear `HANDOFF.md` en la raíz:** Estado inicial con fecha, objetivo, estado de tests, último commit y pendientes.
4. **Script de contexto (opcional):** Solo si se requiere exportar contexto para herramientas sin acceso directo al repo, añadir `npm run context` (o equivalente) e ignorar el archivo exportado en `.gitignore`.

---

## Modo Ejecución y Cierre (En cada sesión)

### Antes de empezar
1. **Reconocimiento Táctico (Git):** Ejecutar `git fetch origin` y `git status --short --branch`. Informar si la rama está adelantada, atrasada o divergente, y señalar cambios locales o conflictos que deban preservarse antes de tocar código.
2. Leer `AGENTS.md` para recordar roles, zonas congeladas y comandos.
3. Leer `HANDOFF.md` para recuperar el punto exacto donde quedó el trabajo.

### Antes de responder que una tarea terminó
1. **Ejecutar la suite completa de verificación** (`typecheck`, `test`, `build`).
2. **Leer `HANDOFF.md`** (regla *leer antes de escribir*) y actualizarlo con: fecha, último commit, conteo de tests en verde, quién actualizó (`Antigravity` / `OpenCode` / `Copilot` / `Usuario`) y próximos pasos.
3. **Proponer un commit atómico** siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
4. **No crear commits ni hacer push** salvo pedido explícito del usuario.

### Checklist de Cierre (obligatorio)
- [ ] `typecheck` → 0 errores.
- [ ] `test` → todos en verde.
- [ ] `build` → OK.
- [ ] Zonas congeladas respetadas (ver `AGENTS.md`).
- [ ] `HANDOFF.md` actualizado (fecha, commit, tests, autor, pendientes).
- [ ] Commit atómico propuesto; sin commit/push sin pedido explícito.
- [ ] `.github/copilot-instructions.md` apuntando a `AGENTS.md` y `HANDOFF.md`.
