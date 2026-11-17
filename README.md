# Cuentópolis

PWA de cuentos interactivos con lectura por voz. El frontend es React + Vite y la API corre en Cloudflare Workers con D1. Las portadas y los audios viven en Google Drive y se sirven a través del Worker.

## Qué incluye

- Biblioteca de cuentos cargada desde D1.
- Lector por páginas de dos frases.
- Reconocimiento de voz con resultados interinos, cooldown por palabra y reinicio continuo.
- Reproducción con Web Audio API (buffers decodificados, sin huecos de `<audio>`).
- Preparación completa del cuento desde la portada: portada + todos los audios, con progreso y gate de “Comenzar a leer”.
- Caché persistente por cuento (`Cache API` + índice en `localStorage`), invalidada por hash de contenido.
- Actualizaciones PWA con aviso, sin recargar a mitad de un cuento.
- Guía de instalación en iOS y Android.

## Desarrollo local

```bash
npm install
cp .env.example .env.development   # si no existe
npm run dev
```

`.env.development`:

```env
VITE_API_BASE_URL=http://localhost:8787
```

Para la API:

```bash
cd cuentopolis-api/old-snow-bbe8
npm install
npx wrangler dev
```

La app queda en `http://localhost:5173/`.

## Comprobaciones

```bash
npm run lint
npm test
npm run build

cd cuentopolis-api/old-snow-bbe8
npx tsc --noEmit
npx vitest run
```

`npm test` ejecuta las pruebas de `storySounds` y `createStoryPages` con Vitest.

## Variables y orígenes

- `VITE_API_BASE_URL`: URL base del Worker. Es obligatoria en build.
- `ALLOWED_ORIGINS`: orígenes permitidos para CORS, separados por comas (`wrangler.jsonc`). Incluye `localhost:5173`, `localhost:5175` y `https://jhonaargoty.github.io`.

Si cambia el dominio de Pages, actualiza `ALLOWED_ORIGINS` y vuelve a desplegar el Worker.

## Despliegue en GitHub Pages

1. En **Settings → Pages**, elige **GitHub Actions** como fuente.
2. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_API_BASE_URL` con la URL del Worker (`https://cuentopolis-api.cuentopolis.workers.dev`).
3. Haz push a `develop` o `main`. El workflow `.github/workflows/deploy.yml` compila y publica.
4. `ci.yml` ejecuta lint, tests, build y comprobaciones del Worker en PR y push.

El sitio se publica en `https://jhonaargoty.github.io/cuentopolis/`. La base `/cuentopolis/` se configura en `vite.config.ts`; puedes sobreescribirla con `VITE_BASE_PATH`.

## API

```bash
cd cuentopolis-api/old-snow-bbe8
npx wrangler deploy
```

Endpoints:

- `GET /api/stories`: cuentos con `audio_triggers` y `resources` agrupados.
- `GET /api/stories/:id/resources`: recursos (`page`, `word`, `audio_url`) de un cuento.
- `GET /api/audio?id=<fileId>`: proxy de audio de Drive con soporte `Range` (`206`) y detección de páginas HTML de confirmación.
- `GET /api/image?src=<url>`: proxy de portadas de Drive.

## Base de datos

`stories` guarda el cuento y `audio_triggers` (JSON). `story_resources` guarda los sonidos por página:

```sql
CREATE TABLE story_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  page INTEGER NOT NULL,          -- 0-based
  word TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);
```

Los SQL de referencia están en `cuentopolis-api/old-snow-bbe8/cuentopolis-seed.sql` y `cuentopolis-local.sql`.

## Agregar un cuento

1. Sube la portada y los audios a Google Drive y compártelos como “cualquiera con el enlace”.
2. Inserta el cuento en `stories`. `cover` debe ser una URL de Drive (`https://lh3.googleusercontent.com/d/<id>=w1200`) y `audio_triggers` un JSON como:

```json
[
  {
    "words": ["elefante", "Tito"],
    "audioUrl": "https://drive.google.com/uc?export=download&id=<fileId>",
    "enabled": true
  }
]
```

3. Añade sus filas en `story_resources` para que cada página conozca sus sonidos.
4. Verifica `ALLOWED_ORIGINS` y despliega el Worker.

## Cómo funciona la preparación

Al abrir la portada, `storyResources` calcula un hash de `cover + content + audioTriggers + resources`. Descarga con concurrencia 4 todo lo que falte, reintenta hasta 3 veces por recurso y guarda en `cuentopolis-story-<id>-<hash>`. Si el hash y los recursos coinciden, entra sin red.

Si un recurso falla tras los reintentos, el botón se habilita igualmente, ese sonido se desactiva y aparece “Reintentar”. Los cuentos de más de 20 MB no se persisten.
