# GymBro

GymBro es una PWA personal para registrar entrenamientos, rutinas y progreso en el gimnasio. Está diseñada para seguir funcionando sin señal y sincronizar los cambios cuando vuelve Internet.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS.
- PWA: `vite-plugin-pwa`, Workbox y manifest instalable.
- Offline: IndexedDB con outbox local y control de revisiones.
- Backend: Cloudflare Workers + Hono.
- Base de datos: Cloudflare D1.
- Producción frontend: GitHub Pages.
- Autenticación: PBKDF2-HMAC-SHA256 + JWT + sesiones revocables.

## URLs

- Frontend de producción: `https://ilean01.github.io/gyymmm/`
- API de producción: `https://gymbro-api.ileanasanabria14.workers.dev`
- Health: `https://gymbro-api.ileanasanabria14.workers.dev/health`

## Requisitos locales

- Node.js 24 o compatible.
- npm.
- Git.
- Cuenta de Cloudflare autenticada en Wrangler para migraciones/deploy del Worker.

## Ejecutar el frontend

```bash
git clone https://github.com/ilean01/gyymmm.git
cd gyymmm
npm ci
npm run dev
```

Vite abre normalmente en `http://localhost:5173/gyymmm/`.

El archivo `.env.development` apunta la PWA local a:

```text
VITE_API_URL=http://localhost:8787
VITE_AUTH_REQUIRED=true
```

## Ejecutar la API

Primero crear el secreto local a partir del ejemplo:

```bash
cd api
cp .dev.vars.example .dev.vars
```

Reemplazar el valor de `JWT_SECRET` por una clave aleatoria larga. El archivo `api/.dev.vars` está ignorado por Git y nunca debe subirse.

Luego:

```bash
npm ci
npm run typecheck
npm run dev
```

La API local queda normalmente en `http://localhost:8787`.

## Migraciones D1

Migraciones locales:

```bash
cd api
npx wrangler d1 migrations apply gymbro-db --local
```

Migraciones de producción:

```bash
cd api
npx wrangler d1 migrations apply gymbro-db --remote
```

Las migraciones se mantienen en `api/migrations/`. No editar una migración ya aplicada; agregar una nueva.

## Secreto JWT de producción

El secreto real se carga exclusivamente con Wrangler:

```bash
cd api
npx wrangler secret put JWT_SECRET
```

No colocar el valor real en `wrangler.jsonc`, archivos `.env`, README, variables `VITE_*` ni commits.

## Deploy del Worker

Después de aplicar las migraciones remotas:

```bash
cd api
npm run typecheck
npm run deploy
```

Verificar después:

```bash
curl https://gymbro-api.ileanasanabria14.workers.dev/health
```

El health check informa si autenticación, D1 y el esquema requerido están listos, pero no expone secretos.

## Deploy del frontend

Cada push a `main` ejecuta GitHub Actions. El workflow:

1. instala frontend y API;
2. revisa el historial Git por patrones comunes de secretos;
3. ejecuta ESLint;
4. ejecuta typecheck del Worker;
5. compila el frontend con autenticación obligatoria;
6. comprueba manifest, service worker e iconos PWA;
7. genera fallback `404.html` para React Router;
8. publica en GitHub Pages.

No hace falta ejecutar un deploy manual del frontend.

## Validaciones locales

Validación completa del frontend:

```bash
npm run check
```

Validar historial por secretos:

```bash
npm run check:secrets
```

Validar API:

```bash
cd api
npm run typecheck
```

## Arquitectura offline-first

Cuando el usuario modifica un entrenamiento, rutina o ejercicio:

1. GymBro escribe primero en IndexedDB.
2. La UI se actualiza inmediatamente.
3. Se agrega una mutación al outbox local.
4. Si hay Internet, el heartbeat intenta sincronizar automáticamente.
5. El servidor aplica la mutación y devuelve la nueva revisión.
6. La PWA elimina del outbox únicamente la mutación confirmada.
7. Después descarga los cambios remotos.

La sincronización también se intenta al abrir la app, volver a primer plano y recuperar conexión.

## Conflictos

Las entidades sincronizadas usan `rev`. Si dos dispositivos modifican offline la misma versión:

- el servidor no acepta que una versión vieja pise una nueva;
- devuelve conflicto;
- la copia local se conserva;
- el conflicto queda guardado en IndexedDB;
- el indicador global avisa al usuario.

Nunca se resuelve un conflicto sobrescribiendo datos silenciosamente.

## Entrenamiento

La Etapa 1 incluye:

- biblioteca de ejercicios y ejercicios personalizados;
- CRUD de rutinas;
- rutina inicial Pierna y glúteo;
- inicio y recuperación de sesión;
- peso y reps reales por serie;
- temporizador general y de descanso;
- Wake Lock cuando el navegador lo soporta;
- última sesión y sugerencia de progresión;
- reemplazar/saltar/agregar ejercicios;
- series extra;
- notas;
- volumen;
- récords personales;
- abandono seguro;
- resumen final;
- historial en Progreso;
- funcionamiento offline;
- sincronización entre dispositivos.

## Seguridad

- PBKDF2-HMAC-SHA256 para contraseñas.
- JWT firmado solo en el Worker.
- Sesiones revocables.
- Todas las consultas privadas se filtran por `user_id`.
- CORS limitado a los orígenes permitidos.
- La PWA de producción exige autenticación.
- `.dev.vars` y otros secretos están ignorados por Git.
- GitHub Actions ejecuta un control de patrones comunes de secretos.

## PWA

El manifest usa:

- nombre: GymBro;
- scope/start URL: `/gyymmm/`;
- modo: `standalone`;
- iconos 192×192, 512×512, maskable y Apple Touch;
- service worker con actualización automática;
- cache de recursos esenciales, imágenes y fuentes.

En iPhone se instala desde Safari con “Agregar a pantalla de inicio”.

## Prueba de aceptación de Etapa 1

Antes de declarar estable una versión se comprueba:

- registro, login y logout;
- aislamiento entre usuarios;
- crear y editar rutinas;
- iniciar y completar un entrenamiento;
- temporizadores y Wake Lock;
- recuperar una sesión activa;
- uso completamente offline;
- reconexión y vaciado del outbox;
- sincronización iPhone ↔ notebook;
- detección de conflictos;
- historial y resumen;
- build sin errores;
- PWA instalable;
- Worker y D1 listos en producción;
- consola sin errores relevantes;
- ningún secreto público.

Funciones de Fotos/R2, Bienestar/Nutrición y Coach IA quedan fuera de esta etapa.
