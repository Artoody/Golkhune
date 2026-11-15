# Golkhune

Classroom monorepo. Students implement each part and deploy their own Railway services.

```
golkhune/
├── backend/     # API + WebSocket bridge
├── frontend/    # Web dashboard
├── esp/         # ESP32 firmware versions
├── n8n/         # n8n workflows
├── simulation/  # 3D greenhouse simulator (three.js) + camera stream server
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

## 3D simulator (Space Greenhouse)

`simulation/` contains a browser-based **3D simulator** of the greenhouse: rail camera (the only sensor of the environment), a rover with arm and pump, plants, a water station, and QR-based autonomous navigation. It mirrors the project's PCB (ESP32, 2 DC motors, 4 servos, 1 pump, soil/DHT21 sensors).

```
cd simulation/greenhouse_live
python server.py 8000      # then open http://localhost:8000/
```

- Details and controls: [`simulation/README.md`](simulation/README.md)
- Full project brief (for people and AI assistants): [`docs/PROJECT_BRIEF_Space_Greenhouse.md`](docs/PROJECT_BRIEF_Space_Greenhouse.md)
