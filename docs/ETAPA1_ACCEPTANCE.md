# Etapa 1 — Checklist de aceptación

Estado del código: **cerrado**.

El objetivo original de la Etapa 1 es que GymBro pueda instalarse en
celular/notebook, iniciar y completar un entrenamiento sin señal y sincronizar
los mismos datos entre dispositivos al recuperar conexión.

## 1–40 · Base técnica

- [x] React + Vite + TypeScript.
- [x] Tailwind y sistema visual GymBro.
- [x] Responsive móvil/tablet/notebook.
- [x] React Router bajo `/gyymmm/`.
- [x] PWA, manifest, iconos y service worker.
- [x] Worker Hono + Wrangler.
- [x] D1 con migraciones.
- [x] Usuarios, perfiles y sesiones.
- [x] PBKDF2-HMAC-SHA256.
- [x] 100.000 iteraciones PBKDF2 verificadas como máximo compatible del
  runtime Workers probado.
- [x] JWT con sesión revocable.
- [x] Registro, login y logout.
- [x] CORS limitado a orígenes permitidos.
- [x] Aislamiento por usuario.
- [x] IndexedDB separado por usuario.

## 41–55 · Offline y sincronización

- [x] Perfil local.
- [x] Outbox con UUID de mutación, operación, payload, revisión e intentos.
- [x] Estados synced/pending/syncing/offline/error/conflict.
- [x] Sync al abrir, reconectar y volver a primer plano.
- [x] Sincronización automática cada 5 s mientras la app está visible.
- [x] Acción manual de sincronización.
- [x] Mutaciones idempotentes.
- [x] Cursor incremental para sesiones.
- [x] Cursor temporal incremental para ejercicios, rutinas y snapshots.
- [x] `rev` para detectar ediciones concurrentes.
- [x] Conflictos conservan ambas versiones.
- [x] Resolución explícita: **Usar servidor** o **Conservar lo mío**.
- [x] Altas de ejercicios/rutinas toleran reintentos sin duplicar.
- [x] Archivados y borrados viajan como tombstones a los otros dispositivos.
- [x] Biblioteca inicial de ejercicios.
- [x] Ilustraciones locales de ejercicios incluidas en el precache PWA.

## 56–69 · Biblioteca, rutinas y arranque

- [x] Biblioteca con listado, búsqueda, filtros, imagen, técnica y grupo.
- [x] Ejercicios personalizados CRUD + offline.
- [x] Tablas y CRUD de rutinas.
- [x] CRUD local offline de rutinas.
- [x] Editor con días, orden, series, reps, peso, descanso y notas.
- [x] Rutina inicial Pierna y glúteo.
- [x] Pantalla Hoy sin inventar datos futuros.
- [x] Tablas de entrenamiento y snapshots.
- [x] Inicio de sesión offline con outbox.

## 70–96 · Entrenamiento completo

- [x] Interfaz completa de entrenamiento.
- [x] Fichas con imagen, número, objetivo, nota y estados visuales.
- [x] Peso y repeticiones reales por serie.
- [x] Persistencia inmediata en IndexedDB.
- [x] Check de serie y avance automático de ejercicio.
- [x] Cronómetro por timestamps.
- [x] Descanso automático, pausa, saltar y +15 s.
- [x] `restEndsAt` persistente al bloquear/volver.
- [x] Wake Lock cuando el navegador lo permite.
- [x] Último rendimiento por ejercicio.
- [x] Sobrecarga progresiva básica sin IA.
- [x] Reemplazar/saltar/agregar ejercicios sin alterar la plantilla.
- [x] Series extra con borrado seguro.
- [x] Notas por ejercicio.
- [x] Calentamiento y estiramiento sugeridos.
- [x] Volumen `peso × reps`.
- [x] PR de peso, repeticiones y volumen.
- [x] Confirmación antes de finalizar.
- [x] Resumen final.
- [x] Abandonar conservando o descartando.
- [x] Recuperación de entrenamiento activo.

## 97–100 · Offline y dos dispositivos

Cobertura automatizada:

- [x] La PWA compilada se recarga completamente offline después de registrar el
  service worker.
- [x] Repetir la misma mutación conserva la misma revisión.
- [x] Una segunda sesión autenticada del mismo usuario recibe sesiones,
  ejercicios del entrenamiento y series.
- [x] Ediciones stale de sesión generan conflicto y no pisan el servidor.
- [x] Ediciones stale de ejercicios personalizados generan 409.
- [x] Ediciones stale de rutinas generan 409.
- [x] Ediciones stale de snapshots de ejercicios generan 409.
- [x] Ediciones stale de series generan 409.
- [x] Archivados de rutina/ejercicio se propagan.
- [x] Borrado de serie extra se propaga mediante tombstone.

Prueba física recomendada antes de usar GymBro como app cotidiana:

- [ ] instalar/abrir en iPhone y notebook;
- [ ] hacer un entrenamiento offline real en el iPhone;
- [ ] bloquear/desbloquear el teléfono;
- [ ] reconectar;
- [ ] comprobar en notebook que los datos aparecen sin pulsar sync;
- [ ] provocar un conflicto real en ambos dispositivos y resolverlo desde Hoy.

La prueba física no modifica el código: valida las particularidades del
navegador/PWA real del dispositivo.

## 101–105 · Robustez, accesibilidad y UX

- [x] Error boundary global.
- [x] API/red/token vencido/conflicto con mensajes claros.
- [x] Indicador global offline/syncing/synced/pending/conflict/error.
- [x] Inputs con label, aria-invalid y aria-describedby.
- [x] Foco visible de teclado.
- [x] Botones táctiles de al menos 44 px.
- [x] Skip link.
- [x] `prefers-reduced-motion`.
- [x] Safe areas de iPhone.
- [x] Inputs de 16 px para evitar zoom de iOS.
- [x] Navegación inferior móvil.
- [x] Sidebar y ancho de contenido de escritorio.

## 106–115 · Deploy y seguridad

- [x] Pages se despliega con GitHub Actions.
- [x] El workflow exige lint sin warnings.
- [x] Typecheck del Worker.
- [x] Tests de API contra D1 local real.
- [x] Test de aislamiento con dos usuarios.
- [x] Test de idempotencia y conflictos con dos sesiones del mismo usuario.
- [x] Build de producción con auth obligatoria.
- [x] Manifest/iconos/SW verificados.
- [x] Chrome headless falla ante errores relevantes de consola/red.
- [x] Recarga offline verificada automáticamente.
- [x] Escaneo de patrones comunes de secretos en historial.
- [x] `JWT_SECRET` fuera de Git.
- [x] Workflow manual **Deploy GymBro API**.
- [x] El workflow aplica migraciones remotas antes del Worker.
- [x] El workflow valida `/health`.
- [x] El workflow ejecuta aceptación + aislamiento contra producción.
- [x] El workflow limpia sus usuarios CI después de una prueba exitosa.

### Única dependencia externa para publicar el Worker

GitHub Actions necesita:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Son secrets de GitHub Actions y nunca deben guardarse en el repositorio.

Después de configurarlos, ejecutar manualmente **Deploy GymBro API**. Un run
verde comprueba migraciones, Worker, health, autenticación, CRUD, aislamiento y
sincronización en producción.

## 116 · Plan gratuito

Revisión al 9 de octubre de 2026:

- Workers Free: 100.000 requests/día.
- D1 Free: 5 millones de filas leídas/día.
- D1 Free: 100.000 filas escritas/día.
- D1 Free: 5 GB de almacenamiento total.

La sincronización dejó de descargar catálogos completos cada 5 segundos.
Ahora usa dos pulls incrementales: cursor secuencial para sesiones y cursor
temporal para dominio/snapshots.

Incluso si una sola PWA permaneciera visible 24 h, dos pulls cada 5 s son
aproximadamente 34.560 requests/día antes de acciones del usuario, con margen
respecto de Workers Free. El uso normal de gimnasio es muy inferior. Revisar
Cloudflare Metrics si el patrón de uso cambia.

## 117–120 · Calidad y documentación

- [x] Frontend TypeScript compila.
- [x] API TypeScript compila.
- [x] ESLint tiene tolerancia cero a warnings.
- [x] Build final obligatorio antes de Pages.
- [x] Consola del navegador comprobada con Chrome headless.
- [x] Cero requests fallidos inesperados en el smoke.
- [x] Manifest, assets, ilustraciones y service worker comprobados.
- [x] README de arquitectura, desarrollo, migraciones, secretos y deploy.

## 121 · Checklist funcional

- [x] PWA instalable por manifest/SW.
- [x] Login funcional.
- [x] Datos aislados por usuario.
- [x] Rutina inicial.
- [x] Creación/edición de rutinas.
- [x] Entrenamiento completo.
- [x] Temporizadores.
- [x] Wake Lock progresivo.
- [x] Historial/Progreso.
- [x] Sobrecarga progresiva.
- [x] Cambios temporales de rutina.
- [x] Offline-first.
- [x] Sync y conflictos multi-sesión automatizados.
- [x] Deploy automático de Pages.
- [x] Pipeline seguro de producción para Worker.

## 122 · Cierre

**Código de Etapa 1: cerrado.**

No se agregan Fotos/R2/Bienestar/Coach IA dentro de esta etapa.

Para marcar también el **cierre operativo de producción** deben quedar verdes:

1. el workflow principal **Deploy GymBro to GitHub Pages**;
2. el workflow manual **Deploy GymBro API**;
3. la prueba física iPhone ↔ notebook descrita arriba.

Eso evita declarar “funciona” basándonos solamente en código o simulación.
