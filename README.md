# GymBro

GymBro es una PWA personal para registrar rutinas y entrenamientos desde el
celular o la notebook. La prioridad de la Etapa 1 es que el entrenamiento no
dependa de tener señal: los cambios se guardan primero en IndexedDB y se
sincronizan con Cloudflare cuando vuelve Internet.

## Arquitectura

- **Frontend:** React + Vite + TypeScript + Tailwind CSS.
- **PWA:** `vite-plugin-pwa` + Workbox.
- **Persistencia local:** IndexedDB.
- **Backend:** Cloudflare Workers + Hono.
- **Base remota:** Cloudflare D1.
- **Autenticación:** PBKDF2-HMAC-SHA256 + JWT + sesiones revocables.
- **Producción frontend:** GitHub Pages bajo `/gyymmm/`.
- **Producción API:** Cloudflare Workers.

La cola local usa UUID de mutación, revisiones (`rev`) y cursor de cambios
para soportar sincronización idempotente, detección de conflictos y varios
dispositivos.

## Requisitos

- Node.js 24 o compatible con el workflow.
- npm.
- Git.
- Wrangler autenticado para tareas de Cloudflare.

## Desarrollo local

Desde la raíz:

```bash
npm ci
npm run dev
```

El frontend queda normalmente en:

```text
http://localhost:5173/gyymmm/
```

En otra terminal:

```bash
cd api
npm ci
cp .dev.vars.example .dev.vars
```

Reemplazá el valor de `JWT_SECRET` de `.dev.vars` por una clave aleatoria.
Ese archivo está ignorado por Git.

Generación rápida de una clave local:

```bash
printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 48)" > .dev.vars
```

Aplicá las migraciones locales:

```bash
npx wrangler d1 migrations apply gymbro-db --local
```

Y levantá el Worker:

```bash
npm run dev
```

La API queda normalmente en:

```text
http://localhost:8787
```

Comprobación:

```bash
curl http://localhost:8787/health
```

## Variables del frontend

Para desarrollo existe `.env.development` con autenticación obligatoria.

El ejemplo general es:

```env
VITE_API_URL=http://localhost:8787
VITE_AUTH_REQUIRED=true
```

Nunca coloques secretos en variables `VITE_*`: Vite las incorpora al bundle
del navegador.

## Base de datos D1

Las migraciones están en `api/migrations`.

Aplicar local:

```bash
cd api
npx wrangler d1 migrations apply gymbro-db --local
```

Aplicar producción:

```bash
cd api
npx wrangler d1 migrations apply gymbro-db --remote
```

Revisá siempre la lista que Wrangler muestra antes de confirmar una migración
remota.

## JWT secret de producción

El secreto de producción no debe guardarse en el repositorio ni en
`wrangler.jsonc`.

Desde `api/`:

```bash
npx wrangler secret put JWT_SECRET
```

Pegá una clave aleatoria larga cuando Wrangler la solicite.

## Publicar la API

Desde `api/`, después de aplicar migraciones y configurar el secreto:

```bash
npm run typecheck
npx wrangler deploy
```

Después verificá:

```bash
curl https://gymbro-api.ileanasanabria14.workers.dev/health
```

`/health` devuelve 200 solamente cuando el secreto de autenticación y el
esquema esperado están listos.

## Publicar el frontend

`.github/workflows/deploy-pages.yml` se ejecuta al hacer push a `main`.

Antes del deploy el workflow:

1. instala frontend y API;
2. revisa patrones comunes de secretos en el historial;
3. ejecuta ESLint;
4. ejecuta typecheck del Worker;
5. aplica las migraciones en una D1 local temporal;
6. prueba registro, login, logout, CRUD y aislamiento entre dos usuarios;
7. compila el frontend con autenticación obligatoria;
8. verifica manifest, iconos y service worker;
9. abre la PWA con Chrome headless y falla si hay errores relevantes de
   consola/red o si el service worker no queda listo;
10. publica el resultado en GitHub Pages.

Producción:

```text
https://ilean01.github.io/gyymmm/
```

## Comprobaciones locales

Frontend:

```bash
npm run lint
npm run build
npm run verify:pwa
npm run check:secrets
```

API:

```bash
cd api
npm run typecheck
```

El smoke test de API se puede ejecutar con el Worker local levantado:

```bash
npm run test:api
```

El smoke test de navegador necesita primero un build y `npm run preview`:

```bash
npm run test:browser
```

## Qué está incluido en la Etapa 1

- instalación PWA y uso offline;
- registro, login, logout y sesiones;
- aislamiento de datos por usuario;
- biblioteca de ejercicios y ejercicios personalizados;
- rutinas offline;
- rutina inicial de pierna y glúteo;
- inicio y recuperación de entrenamiento;
- snapshots para preservar historial;
- peso, repeticiones y series reales;
- cronómetro total basado en timestamps;
- descanso persistente;
- Wake Lock cuando el navegador lo permite;
- última sesión y sobrecarga progresiva básica;
- reemplazar, saltar y añadir ejercicios durante la sesión;
- series extra;
- notas;
- calentamiento y estiramiento sugeridos;
- volumen total y récords;
- finalizar, abandonar y recuperar entrenamiento;
- historial y progreso;
- sincronización automática cada 5 segundos mientras la app está visible;
- sincronización al abrir, reconectar o volver a primer plano;
- cola offline, mutaciones idempotentes, revisiones y conflictos;
- indicadores globales de conexión/sincronización;
- layout móvil/notebook y safe areas de iPhone;
- pruebas automáticas de API, seguridad, PWA y consola del navegador.

## Prueba manual final recomendada

La automatización cubre gran parte de la Etapa 1, pero una PWA móvil también
necesita una comprobación física final:

1. instalá GymBro en el iPhone;
2. iniciá sesión con la misma cuenta en iPhone y notebook;
3. iniciá una rutina con conexión;
4. cortá Internet en el iPhone;
5. registrá varias series, bloqueá la pantalla y volvé;
6. verificá cronómetro y descanso;
7. terminá el entrenamiento todavía offline;
8. recuperá Internet;
9. comprobá que el indicador pasa de pendiente a sincronizado;
10. verificá en la notebook que la sesión aparece sin tocar el botón manual;
11. repetí con cambios offline independientes en ambos equipos para comprobar
    que un conflicto no sobreescribe silenciosamente datos.

## Seguridad

- `.dev.vars`, `.env` y archivos locales de Wrangler están ignorados.
- `JWT_SECRET` se guarda como secreto de Cloudflare.
- cada consulta privada del Worker deriva el usuario desde el JWT/sesión;
- los endpoints de edición verifican propiedad antes de modificar;
- CORS permite únicamente los orígenes configurados;
- los tests automáticos crean dos usuarios y comprueban que uno no pueda leer
  o editar datos privados del otro.

## Alcance

Etapa 1 termina en la base estable de entrenamiento + offline + sync.
Fotos/R2, bienestar avanzado y Coach IA pertenecen a etapas posteriores.
