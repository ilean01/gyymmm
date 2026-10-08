# Etapa 1 — Checklist de aceptación

Estado: **código y frontend de producción cerrados**. La publicación del
Worker puede hacerse desde el workflow manual `Deploy GymBro API` una vez que
GitHub tenga los dos secrets de Cloudflare.

## 101–105 · Robustez y UX

- [x] 101. Manejo global de errores de render.
- [x] 101. Errores de API y red con mensajes amigables.
- [x] 101. Token inválido/vencido limpia la sesión y explica el motivo.
- [x] 101. Conflictos de sincronización se conservan y no se pisan en silencio.
- [x] 102. Indicador global: offline / sincronizando / sincronizado / pendiente /
  conflicto / error.
- [x] 103. Foco visible, labels, aria-describedby, aria-invalid, tamaños táctiles
  mínimos y navegación para teclado.
- [x] 103. Respeto de `prefers-reduced-motion`.
- [x] 104. Safe areas de iPhone, inputs de 16 px, navegación inferior y
  touch-action.
- [x] 105. Sidebar de notebook y ancho de contenido ampliado para escritorio.

## 106–108 · GitHub Pages y PWA

- [x] 106. GitHub Actions instala dependencias y ejecuta validaciones.
- [x] 106. Build y deploy automático a Pages.
- [x] 107. Base de Vite y rutas preparadas para `/gyymmm/`.
- [x] 108. Manifest, iconos y service worker verificados automáticamente.
- [x] 108. Smoke test real con Chrome headless.
- [x] 108. El smoke test falla ante errores relevantes de consola/red.
- [x] 108. Service worker debe quedar `ready` antes del deploy.

## 109–112 · Producción Cloudflare

- [x] 109. `JWT_SECRET` no está en el repositorio.
- [x] 109. Existe chequeo automático de patrones comunes de secretos.
- [x] 109. README documenta `wrangler secret put JWT_SECRET`.
- [x] 110. Todas las migraciones viven en `api/migrations`.
- [x] 110. El workflow `Deploy GymBro API` aplica migraciones remotas antes del
  deploy.
- [x] 111. El workflow publica el Worker con Wrangler.
- [x] 111. `/health` comprueba secreto + D1 + esquema esperado.
- [x] 112. El frontend de producción compila contra
  `gymbro-api.ileanasanabria14.workers.dev`.
- [x] 112. Autenticación obligatoria en producción.
- [x] 112. CORS se prueba automáticamente para GitHub Pages y rechaza un origen
  desconocido.

### Acción de cuenta requerida una sola vez

El workflow de API necesita estos **GitHub Actions secrets**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

No son secretos de la aplicación y nunca deben escribirse en archivos del
repositorio. Después de configurarlos, ejecutar manualmente el workflow
**Deploy GymBro API**.

## 113–115 · Pruebas y seguridad

- [x] 113. Test automático de registro.
- [x] 113. Test automático de login correcto e incorrecto.
- [x] 113. Test automático de email duplicado.
- [x] 113. Test automático de logout y revocación.
- [x] 113. CRUD de ejercicios y rutinas probado contra D1 local real.
- [x] 113. Creación de sesión y series probada contra D1 local real.
- [x] 114. El test crea dos usuarios distintos.
- [x] 114. Usuario B no puede editar ejercicio de A.
- [x] 114. Usuario B no puede editar rutina de A.
- [x] 114. Usuario B no puede apropiarse de una sesión de A.
- [x] 114. Usuario B no ve las series privadas de A.
- [x] 115. `.dev.vars`, `.env` y `.wrangler` están ignorados.
- [x] 115. El workflow revisa el historial antes del deploy.

## 116 · Plan gratuito

Para uso personal la arquitectura está muy por debajo de los límites normales
del plan gratuito, pero el consumo real depende de cuánto se use la app.
Revisar periódicamente Workers y D1 en Cloudflare Metrics/Billing.

La sincronización cada 5 segundos solo corre mientras la app está visible y
online; no usa un cron remoto ni mantiene conexiones permanentes.

## 117–120 · Calidad y documentación

- [x] 117. Frontend TypeScript compila.
- [x] 117. API TypeScript compila.
- [x] 117. ESLint forma parte del gate de deploy.
- [x] 118. Build final forma parte del workflow.
- [x] 119. Chrome headless revisa la app compilada.
- [x] 119. Manifest y service worker se revisan automáticamente.
- [x] 120. README explica frontend, Worker, D1, migraciones, secretos,
  arquitectura, pruebas y producción.

## 121 · Criterios finales

- [x] PWA instalable y con service worker.
- [x] Login, registro y logout.
- [x] Aislamiento por usuario.
- [x] Biblioteca y ejercicios personalizados.
- [x] Rutina inicial y CRUD de rutinas.
- [x] Entrenamiento completo.
- [x] Cronómetro y descanso persistente.
- [x] Wake Lock cuando el navegador lo admite.
- [x] Historial y página Progreso.
- [x] Sobrecarga progresiva básica.
- [x] Reemplazar / saltar / agregar ejercicios.
- [x] Series extra y notas.
- [x] Volumen, récords y resumen final.
- [x] Entrenamiento offline y recuperación.
- [x] Outbox, push/pull, cursor, `rev`, idempotencia y conflictos.
- [x] Sincronización al abrir, volver a primer plano, reconectar y cada 5 s.
- [x] Deploy automático de GitHub Pages.
- [x] Pipeline de deploy de Worker preparado y verificable.

## 122 · Cierre

La Etapa 1 queda cerrada técnicamente cuando:

1. el workflow principal de Pages está verde;
2. el workflow **Deploy GymBro API** está verde;
3. la prueba física iPhone ↔ notebook confirma la sincronización real en ambos
   sentidos y el comportamiento al bloquear/desbloquear el teléfono.

Hasta ese momento no se agregan Fotos/R2/Bienestar/Coach IA.
