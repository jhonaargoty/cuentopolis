# Cuentópolis — Contexto para agentes

PWA familiar de cuentos interactivos: el niño lee, la app escucha por micrófono y al detectar una palabra clave reproduce su sonido.

> Este archivo es la fuente de contexto. Leerlo completo al iniciar. No pedir al usuario que re-explique el proyecto.
> Plan histórico y decisiones: `PLAN.md`. Worker: `cuentopolis-api/old-snow-bbe8/AGENTS.md`.

---

## Reglas de trabajo (ahorro de tokens y contexto)

**Respuestas**
- Ir al grano. Sin preámbulo, sin repetir la pregunta, sin resumen final si ya se mostró el cambio.
- Máximo ~8 líneas para tareas normales. Código solo si se pidió o si es necesario para explicar un bug.
- Citar `ruta:línea` en vez de pegar archivos completos.
- No explicar lo obvio ni listar lo que el usuario ya sabe.

**Herramientas y contexto**
- No abrir el navegador ni `browser.*` salvo que el usuario lo pida explícitamente.
- No leer archivos completos si `grep`/`glob` alcanzan. No re-explorar el repo en cada turno.
- No volcar salidas largas de comandos; filtrar con `grep`, `head`, `tail`.
- No crear documentos nuevos (planes, resúmenes, informes) salvo pedido. Actualizar `PLAN.md` o este archivo.
- Preferir `edit` sobre reescribir archivos.

**Ejecución**
- Rama de trabajo: `develop`.
- No hacer `commit`, `push`, `deploy` ni tocar D1 remota sin pedido explícito.
- No instalar dependencias nuevas sin preguntar.
- Antes de decir "listo", correr el check que aplique: `npm run lint`, `npm test`, `npm run build`, y en el Worker `npx tsc --noEmit` + `npx vitest run`.
- Si hay ambigüedad real, una sola pregunta. Si no, elegir la opción más simple y decir cuál se eligió.
- Al terminar: 1 línea de qué cambió + 1 de cómo se verificó.

---

## Stack y despliegue

- React 19 + TypeScript + Vite 8. PWA con `vite-plugin-pwa` (`registerType: 'prompt'`).
- Frontend: **GitHub Pages** → `https://jhonaargoty.github.io/cuentopolis/` (base `/cuentopolis/`, override con `VITE_BASE_PATH`).
- API: **Cloudflare Workers + D1** → `https://cuentopolis-api.cuentopolis.workers.dev`.
- Portadas y audios viven en **Google Drive**; el Worker los proxya.
- Deploy automático: push a `develop`/`main` → `.github/workflows/deploy.yml`. Requiere la repository variable `VITE_API_BASE_URL`.
- CORS: `ALLOWED_ORIGINS` en `wrangler.jsonc` (localhost 5173/5175 + `https://jhonaargoty.github.io`).

## Comandos

```bash
npm run dev      # http://localhost:5173  (requiere .env.development)
npm run lint
npm test         # vitest frontend
npm run build    # tsc -b + vite build

cd cuentopolis-api/old-snow-bbe8
npx wrangler dev          # API local en :8787
npx tsc --noEmit
npx vitest run
npx wrangler deploy       # solo si se pide
```

`.env.development`: `VITE_API_BASE_URL=http://localhost:8787`

---

## Modelo de datos (D1)

`stories`: `id`, `title`, `description`, `cover`, `content`, `audio_triggers` (JSON string), `created_at`.
`story_resources`: `id`, `story_id`, `page` (0-based), `word`, `audio_url`.

```
audio_triggers = [{ "words": ["elefante","Tito"], "audioUrl": "https://drive.google.com/uc?export=download&id=...", "enabled": true }]
```

- Cuento 1 (`El pequeño elefante`): 4 triggers, 9 recursos, 4 páginas.
- Cuento 2 (`La rana y la luna`): **sin triggers ni recursos** (no tiene sonidos).

## API

| Endpoint | Función |
|---|---|
| `GET /api/stories` | Cuentos + `audio_triggers` + `resources` agregados por cuento |
| `GET /api/stories/:id/resources` | Recursos (`page`, `word`, `audio_url`) |
| `GET /api/audio?id=<fileId>` | Proxy de Drive con `Range`/`206`; detecta HTML de confirmación |
| `GET /api/image?src=<url>` | Proxy de portadas de Drive |

El frontend reescribe URLs de Drive: audio → `/api/audio?id=`, portada → `/api/image?src=`.

---

## Flujo de la app

1. `StoryListPage` → `getStories()` → destacado + lista.
2. Elegir cuento → `StoryReaderPage` → intro fullscreen con la portada. No descarga nada todavía.
3. Al pulsar "Comenzar a leer" → `useStoryPreparation.start()` → `prepareStory()` descarga **portada + todos los audios únicos** con concurrencia 4 y reintentos (3), mostrando progreso. Si falla algún audio: error + "Reintentar" y no se entra al texto. Si solo falla la portada, se entra igual (usa la URL remota).
4. `createStoryPages()` parte el `content` en páginas de 2 frases y asigna `resources` por página (usa `story_resources`; si la página no tiene, cae a `audioTriggers`).
5. `StoryVoiceReader` escucha con `SpeechRecognition` (`es-CO`, `continuous`, interinos), dispara con cooldown de 1.5 s y reproduce con **Web Audio API** (buffer decodificado).
6. Al pausar la escucha se detiene; al terminar el audio se reanuda. El `AudioContext` se desbloquea en el tap de "Iniciar".

## Mapa de archivos

```
src/pages/StoryListPage.tsx        biblioteca
src/pages/StoryReaderPage.tsx      intro/preparación + lector por páginas
src/hooks/useStoryPreparation.ts   estado de preparación (progreso, retry, cover blob)
src/services/storyResources.ts     descarga total del cuento + Cache API + índice localStorage
src/services/storyPages.ts         split en páginas, recursos por página, URLs de audio
src/services/storyService.ts       fetch /api/stories + parseo/validación + proxy de URLs
src/services/audioCache.ts         blobs en memoria + Cache API (cuentopolis-audio-v1)
src/services/audioPlayback.ts      AudioContext, decodeAudioData, play/stop
src/services/perf.ts               métricas de latencia (debug)
src/data/storySounds.ts            normalización de texto y matching de palabras
src/components/stories/StoryVoiceReader.tsx  reconocimiento + reproducción
src/components/UpdateBanner.tsx    aviso de versión nueva (no recarga leyendo)
src/components/InstallGuide.tsx    guía "añadir a pantalla de inicio"
src/types/story.ts                 Story, StoryPage, PageResource, StoryResource
```

## Caché (3 capas, a tener en cuenta)

| Capa | Nombre | Invalidación |
|---|---|---|
| Preparación | `cuentopolis-story-<id>-<hash>` | hash de `cover + content + audioTriggers + resources` |
| Audio suelto | `cuentopolis-audio-v1` | ninguna |
| Service Worker | `cuentopolis-story-audio`, `cuentopolis-drive-cover-images` | expiración 60 días / 200 entradas |
| Lista del home | `sessionStorage: cuentopolis-stories-v1` + memoria | TTL 5 min; "Intentar de nuevo" fuerza recarga |

- El hash usa **URLs y texto, no bytes**. Si reemplazas el contenido de un archivo en Drive con el mismo `fileId`, se sirve el audio viejo.
- El mismo audio puede quedar guardado en las 3 capas.
- Tope de persistencia: 20 MB por cuento (si lo supera, no se guarda).

---

## Pendientes conocidos (post-plan)

No están implementados; no asumir que existen.

1. **Invalidación real de caché**: TTL o botón "Actualizar cuento" para audios reemplazados en Drive con el mismo id.
2. **`main` desactualizado**: `deploy.yml` publica en push a `main`, que está muy atrás de `develop`. Alinear o quitar `main` del trigger.
3. **Logo en raster**: `logo.png` (677×369) es la fuente; los iconos PWA se generan desde un recorte de 316 px, así que el `512` va escalado. Falta el SVG vectorial maestro.
4. **Cuento 2 sin sonidos**: faltan triggers y filas en `story_resources`.
5. **Recursos incompletos en D1 silencian palabras**: `createStoryPages` ignora `audioTriggers` si la página tiene al menos un recurso guardado.
6. **C6 parcial**: el progreso muestra MB descargados, pero no usa `Content-Length` para un total previo.
7. **A5 parcial**: no hay variantes morfológicas; "elefantito" no dispara. Se resuelve agregando la palabra en D1.
8. **Sin medición en dispositivo** de la latencia voz→audio (`getMetrics()` no se usa).
9. **Banners** de instalar y actualizar comparten posición fija y pueden solaparse.
10. **Copy**: "Preparando sonidos… 1 de N" incluye la portada.
11. **Código muerto**: `StoryCover.onLoadSettled`, `isAudioUnlocked`, `getMetrics`, `StoryIndexEntry.complete`, `src/data/stories.ts`.
12. **`AGENTS.md` del Worker** es la plantilla genérica de Cloudflare; no describe este proyecto.

---

## Gotchas

- `VITE_API_BASE_URL` es obligatoria; sin ella `getApiBaseUrl()` lanza.
- En producción `base` es `/cuentopolis/`; no usar rutas absolutas `/...` en HTML ni en el manifest.
- `src/data/stories.ts` es data de ejemplo sin uso.
- El reconocimiento de voz es en la nube (Safari/Chrome): la latencia depende de la red.
- No hace falta `public/audio/`: los audios vienen de Drive.
- Tests: `vitest.config.ts` incluye `src/**/*.test.{ts,tsx}`; el Worker tiene su propio vitest.
