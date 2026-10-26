# Cuentópolis — Contexto del proyecto

## Stack

- React 19 + TypeScript + Vite 8.
- PWA con `vite-plugin-pwa` (autoUpdate, manifest e iconos).
- API en Cloudflare Workers + D1 (`cuentopolis-api/old-snow-bbe8`).
- Endpoint: `GET /api/stories`.

## Datos

D1 devuelve 2 cuentos: `El pequeño elefante` y `La rana y la luna`.

Campos: `id`, `title`, `description`, `cover`, `content`.

## Flujo implementado

1. `StoryListPage` carga los cuentos desde la API y muestra destacado + lista.
2. Al elegir uno, `StoryReaderPage` muestra el cover como intro y espera a que la imagen cargue.
3. El `content` se parte en páginas de 2 frases (`createStoryPages`).
4. Hay navegación anterior/siguiente y barra de progreso.
5. Existe un prototipo `ElephantVoiceTest` (sin commit):
   - Usa `webkitSpeechRecognition` / `SpeechRecognition`.
   - Detecta la palabra “elefante”.
   - Reproduce `public/audio/elefante.m4a`.
   - Reinicia la escucha automáticamente con límite de intentos.
   - Solo se muestra en el cuento con `id === 1` y título que contenga “elefante”.

## PWA / caché

- Hay `runtimeCaching` para imágenes de portada de Google Drive.
- El audio del elefante está en precache (`includeAssets`).
- No hay caché genérica de audio ni descarga por página.

## Hito actual

El usuario lee el cuento, la app reconoce su voz y, al detectar una palabra clave (ej. “elefante”), reproduce el sonido correspondiente ya descargado.

Los recursos no se descargan todos al inicio: al avanzar de página se descargan los de la página siguiente.

## Diferencias con el hito

1. **Modelo de recursos por página**
   Hoy la palabra y el audio están hardcodeados al cuento del elefante. Falta algo como:
   ```ts
   interface PageResource {
     word: string
     audioUrl: string
   }
   ```

2. **Descarga incremental**
   Falta:
   - Precargar recursos de la página actual.
   - Al avanzar, descargar en segundo plano los de la página siguiente.
   - Cachearlos (Cache API / Service Worker) para uso offline.

3. **Reconocimiento genérico**
   `ElephantVoiceTest` debería:
   - Recibir las palabras activas de la página actual.
   - Comparar contra todas ellas.
   - Reproducir el audio correspondiente.
   - Actualizarse o reiniciarse al cambiar de página.

4. **Descarga inicial desde el cover**
   El cover espera solo la imagen. Debería esperar también texto y recursos de la primera página antes de habilitar “Comenzar a leer”.

5. **Recursos en backend**
   La API aún no devuelve qué sonidos corresponden a cada cuento/página. Opciones:
   - Añadir tabla `story_resources` en D1 (recomendado).
   - Empezar con un mapa local en frontend y migrar después.

## Siguiente paso recomendado

1. Definir `StoryPage` con `text` y `resources`.
2. Crear servicio de precarga con Cache API y deduplicación.
3. Convertir `ElephantVoiceTest` en `StoryVoiceReader` que reciba las palabras de la página.
4. Precargar página actual + siguiente al avanzar.
5. Integrar todo en `StoryReaderPage`.

## Notas de trabajo

- Trabajar sobre la rama `develop`.
- Mantener respuestas breves y sin explicación extensa.
