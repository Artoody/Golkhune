# Golkhune

Classroom monorepo. Students implement each part and deploy their own Railway services.

```
golkhune/
├── backend/     # API + WebSocket bridge
├── frontend/    # Web dashboard
├── esp/         # ESP32 firmware versions
├── n8n/         # n8n workflows
├── assets/      # reference media (3D, etc.)
└── docs/        # class notes / guides
```

## Flow (target)

`n8n` → HTTP → `backend` → WebSocket → `ESP32`  
`frontend` talks to `backend`

## Student workflow

1. Fork this repo.
2. Implement code inside each folder (see each folder’s README).
3. On Railway, create separate services and set **Root Directory** to `backend`, `frontend`, or `n8n`.
4. Point ESP + n8n at **your** backend URL.

Do not put secrets (WiFi passwords, API keys) in public commits.
