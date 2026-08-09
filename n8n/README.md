# n8n

Export your n8n workflows as JSON into `workflows/`.

## Expected role

- Call your backend `/trigger` (or whatever path you implement)
- Optional: schedules, webhooks, sensors, etc.

## Run options

- n8n Cloud
- Local Docker
- Railway service (Root Directory: `n8n`) if you add a Dockerfile

## Files to add

- `workflows/*.json` — exported from n8n
- optional `docker-compose.yml` / `Dockerfile` for self-hosting
