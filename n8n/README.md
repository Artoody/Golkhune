# n8n — Golkhune (mock ready for Railway)

Includes a **mock workflow** that you can hit over HTTP to confirm n8n is alive.

## What the mock does

Workflow: `workflows/mock-golkhune-ping.json`

1. Receives `GET /webhook/golkhune-mock` (or `/webhook-test/golkhune-mock` while inactive)
2. Calls public `https://httpbin.org/uuid`
3. Returns a fake greenhouse JSON payload

Example response:

```json
{
  "ok": true,
  "project": "Golkhune",
  "message": "n8n mock workflow is working on Railway",
  "temperature_c": 24.5,
  "humidity_pct": 62,
  "uuid": "...",
  "checked_at": "..."
}
```

## Deploy on Railway

1. New project → Deploy from GitHub → this repo
2. **Root Directory:** `n8n`
3. Add a **Volume** mounted at `/home/node/.n8n` (so data survives restarts)
4. Variables (set after you have the public domain):

| Variable | Example |
|----------|---------|
| `N8N_PROTOCOL` | `https` |
| `N8N_HOST` | `your-service.up.railway.app` |
| `WEBHOOK_URL` | `https://your-service.up.railway.app/` |
| `GENERIC_TIMEZONE` | `Asia/Tehran` |
| `N8N_PORT` | leave empty — entrypoint uses Railway `PORT` |

5. Deploy → open the n8n UI → if the workflow is inactive, **Activate** it
6. Test:

```text
https://your-service.up.railway.app/webhook/golkhune-mock
```

On first boot the entrypoint imports the JSON from `workflows/`.

## Local

```bash
cd n8n
docker build -t golkhune-n8n .
docker run --rm -p 5678:5678 -e N8N_PORT=5678 golkhune-n8n
```

Then open http://localhost:5678 and call http://localhost:5678/webhook/golkhune-mock
