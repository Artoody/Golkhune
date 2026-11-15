# backend - Provided by SadeghMATA

Golkhune Node.js (Express) backend. Target flow:

`n8n` → HTTP → `backend` → WebSocket → `ESP32`  
`frontend` ↔ `backend` (JWT)

## Implemented so far

| Method | Path | Auth | Role |
|--------|------|------|------|
| `GET` | `/health` | no | Railway healthcheck |
| `POST` | `/login` | no | Issue JWT for the env-backed admin |
| `GET` | `/me` | Bearer JWT | Current admin profile |
| `POST` | `/api/webhooks/n8n` | no | Mock n8n greenhouse payload → SQLite + ESP32 |
| WS | `/ws/esp` | no | ESP32 (or Wokwi) realtime bridge |
| `GET` | `/api/public/dashboard` | no | Latest telemetry + camera placeholder |
| `GET` | `/api/admin/status` | Bearer JWT | n8n / ESP32 / camera status |
| `GET` | `/api/admin/logs` | Bearer JWT | Recent system logs |
| `POST` | `/api/admin/command` | Bearer JWT | Admin text command for the AI |

### Frontend API

Public dashboard (no auth):

```bash
curl http://localhost:3000/api/public/dashboard
```

Returns latest n8n telemetry from SQLite, or a mock `{ temperature: 25.5, humidity: 60, heater_status: true }` until the first webhook. Camera URL comes from `CAMERA_STREAM_URL` (`status: "placeholder"`).

Admin routes need `Authorization: Bearer <access_token>` from `POST /login`.

```bash
curl http://localhost:3000/api/admin/status -H "Authorization: Bearer TOKEN"
curl http://localhost:3000/api/admin/logs -H "Authorization: Bearer TOKEN"
curl -X POST http://localhost:3000/api/admin/command ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"command\":\"turn on the heater if humidity stays above 70\"}"
```

### SQLite

On startup the backend creates `data/golkhune.db` (override with `SQLITE_PATH`) with:

- `telemetry` — n8n greenhouse readings
- `system_events` — n8n / ESP32 / admin actions (seeded with a few mock rows)
- `ai_commands` — text commands from `POST /api/admin/command`

`POST /api/webhooks/n8n` now persists telemetry before broadcasting to ESP32. Railway disk is ephemeral unless you mount a volume at `data/`.

### Mock n8n webhook → ESP32

Telemetry:

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n ^
  -H "Content-Type: application/json" ^
  -d "{\"temperature\":25.5,\"humidity\":60,\"heater_status\":true}"
```

LED on/off (no telemetry required) — ESP32 GPIO 13 / D13:

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n -H "Content-Type: application/json" -d "{\"led\":\"on\"}"
curl -X POST http://localhost:3000/api/webhooks/n8n -H "Content-Type: application/json" -d "{\"led\":\"off\"}"
```

AI command (telemetry fields are optional):

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n ^
  -H "Content-Type: application/json" ^
  -d "{\"command\":\"turn on the heater\",\"status\":\"pending\"}"
```

`led` (`"on"`/`"off"`), free-text `command`, and optional `status` are accepted. Numbers/booleans may arrive as strings from n8n. Invalid bodies return `400` with Zod details. Valid payloads are broadcast to every open `/ws/esp` client as:

```json
{
  "source": "n8n",
  "timestamp": "2026-08-15T13:00:00.000Z",
  "data": {
    "temperature": 25.5,
    "humidity": 60,
    "heater_status": true
  }
}
```

HTTP response: `{ "status": "success", "forwardedTo": <connected ESP count>, "led": "on"|"off"|null }`. Telemetry payloads are stored in SQLite; LED-only commands are forwarded without writing telemetry. ESP connect/disconnect events are saved.

ESP / Wokwi should connect to `ws://localhost:3000/ws/esp` locally and `wss://<railway-host>/ws/esp` in production. HTTP and WebSocket share Railway's single `PORT`.

## Local setup

```bash
cd backend
copy .env.example .env
# edit JWT_SECRET and ADMIN_PASSWORD (placeholders are rejected)
npm install
npm start
```

Login:

```bash
curl -X POST http://localhost:3000/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@golkhune.local\",\"password\":\"your-admin-password\"}"
```

Then call `/me` with `Authorization: Bearer <access_token>`.

## Environment variables

All secrets come from `.env` / Railway variables. Do not hardcode credentials.

| Name | Purpose |
|------|---------|
| `PORT` | Listen port (Railway injects this) |
| `JWT_SECRET` | JWT signing key (min 16 chars) |
| `JWT_EXPIRES_IN` | Access token lifetime (`1h`, `60m`, …) |
| `ADMIN_EMAIL` | Mock admin email |
| `ADMIN_PASSWORD` | Mock admin password |
| `DATABASE_URL` | Reserved for PostgreSQL later (login is still env-backed) |
| `SQLITE_PATH` | SQLite file path (default `data/golkhune.db`) |
| `CAMERA_STREAM_URL` | Placeholder live-camera URL for the public dashboard |
| `CORS_ORIGINS` | Comma-separated frontend origins |

Step 1 authenticates a single admin from environment variables. `DATABASE_URL` is accepted so a real user table can be wired later without changing the login contract.

## Railway

1. New service from this repo
2. **Root Directory:** `backend`
3. Start command: `npm start`
4. Set `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, optionally `CAMERA_STREAM_URL`
5. Healthcheck: `GET /health`
6. ESP32 connects with `wss://<public-host>/ws/esp` — same service/`PORT` as HTTP; do not open a second port
7. Optional: mount a volume at `/app/data` (or set `SQLITE_PATH`) so SQLite survives redeploys
