# backend

ESP32 ↔ n8n bridge server (Express + WebSocket).

## Run locally

```bash
cd backend
npm install
npm start
```

- Health: `GET /health`
- n8n trigger: `POST /trigger`
- ESP WebSocket: `ws://localhost:3000/`

## Railway

1. New service from this repo
2. **Root Directory:** `backend`
3. Deploy (uses `npm start`)
4. Add a public domain, then point ESP `ws_host` and n8n `/trigger` at it
