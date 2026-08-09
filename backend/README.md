# backend

Your server lives here (Node / Express / etc.).

## Expected role

- Accept HTTP calls from n8n (e.g. `/trigger`)
- Keep WebSocket connections open for ESP32
- Expose status APIs for the frontend

## Railway

- Root Directory: `backend`
- Start command: whatever you define in `package.json`

## Files to add

- `package.json`
- your entry file (e.g. `server.js` / `index.js`)
- `.env` locally (use `.env.example` as a template — never commit real secrets)
