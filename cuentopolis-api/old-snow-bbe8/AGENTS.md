# Cuentópolis — Worker (Cloudflare)

API de Cuentópolis. Contexto general, reglas de trabajo y pendientes: `../../AGENTS.md` (leerlo primero).

---

## Este Worker

- Nombre: `cuentopolis-api`. Entry: `src/index.ts`.
- D1: binding `cuentopolis_db`, base `cuentopolis-db`, id `d5a44579-6515-46a2-a4d9-995251f025c2`.
- CORS: `ALLOWED_ORIGINS` en `wrangler.jsonc` (localhost 5173/5175 + `https://jhonaargoty.github.io`).
- No hay assets estáticos: el frontend vive en GitHub Pages.

### Endpoints

| Endpoint | Función |
|---|---|
| `GET /api/stories` | Cuentos + `audio_triggers` + `resources` agregados |
| `GET /api/stories/:id/resources` | Recursos (`page`, `word`, `audio_url`) |
| `GET /api/audio?id=<fileId>` | Proxy de Drive con `Range`/`206`; detecta HTML de confirmación |
| `GET /api/image?src=<url>` | Proxy de portadas de Drive |

Solo hosts de Google Drive están permitidos como origen de audio/imagen.

### Tablas

- `stories`: `id`, `title`, `description`, `cover`, `content`, `audio_triggers` (JSON string), `created_at`.
- `story_resources`: `id`, `story_id`, `page` (0-based), `word`, `audio_url`.

Migraciones/seed de referencia: `cuentopolis-seed.sql`, `cuentopolis-local.sql`.

---

## Reglas

- No `wrangler deploy` ni `wrangler d1 execute --remote` sin pedido explícito.
- Antes de decir "listo": `npx tsc --noEmit` y `npx vitest run`.
- Respuestas cortas; no pegar el archivo completo, citar `ruta:línea`.
- Si cambias bindings en `wrangler.jsonc`, correr `npx wrangler types`.
- Al cambiar `ALLOWED_ORIGINS` hay que redesplegar para que tome efecto.

---

## Comandos

| Comando | Uso |
|---|---|
| `npx wrangler dev` | API local en `:8787` |
| `npx wrangler deploy` | Publicar (solo si se pide) |
| `npx wrangler types` | Regenerar tipos tras cambiar bindings |
| `npx wrangler d1 execute cuentopolis-db --remote --command "..."` | Consultar D1 remota (solo si se pide) |

Pruebas manuales útiles:

```bash
curl -H "Origin: https://jhonaargoty.github.io" http://localhost:8787/api/stories
curl -H "Range: bytes=0-1023" "http://localhost:8787/api/audio?id=<fileId>" -o /dev/null -w "%{http_code}\n"  # 206
```

---

## Cloudflare (referencia)

La documentación de Workers cambia seguido: consultar antes de asumir APIs o límites.

- Docs: https://developers.cloudflare.com/workers/
- Límites: https://developers.cloudflare.com/workers/platform/limits/
- D1: https://developers.cloudflare.com/d1/
- Errores: https://developers.cloudflare.com/workers/observability/errors/
- Error 1102 (CPU/memoria): revisar límites.

### Local Explorer (con `wrangler dev`)

La URL base se imprime al arrancar. Rutas útiles:

| Endpoint | Uso |
|---|---|
| `GET /cdn-cgi/local/explorer/api/local/workers` | Workers y bindings |
| `GET /cdn-cgi/local/explorer/api/d1/database` | Bases D1 |
| `POST /cdn-cgi/local/explorer/api/local/observability/query` | SQL read-only sobre `spans` y `logs` |

Esquema completo (grande, último recurso): `GET /cdn-cgi/local/explorer/api`.
