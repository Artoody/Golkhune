# simulation/ — Space Greenhouse 3D simulator

A single-file **three.js** simulator of the greenhouse project: a fixed rail camera is the only "eye" of the environment, and a small rover with a 4-axis arm and a water pump waters potted plants and refills at a water station, **navigating only from QR tags seen by the greenhouse camera**. Dimensions and parts follow the team's PCB (ESP32 DevKit V1, 2 DC motors, 4 servos, 1 pump, soil / DHT21 / LDR / MQ135 / smoke / UV sensors).

## Run

```
cd simulation/greenhouse_live
python server.py 8000        # or double-click run.bat on Windows
```

- Simulator: http://localhost:8000/
- Live camera viewer: http://localhost:8000/feed
- MJPEG stream (OpenCV, etc.): http://localhost:8000/stream  (tick "پخش زندهٔ دوربین" in the simulator first)

Internet is needed for the CDN libraries (three.js r128, OrbitControls, GLTFLoader, Google Fonts). The plant 3D model is embedded in the HTML.

## What it simulates

- Rail camera with real lens model (focal length, zoom, sensor size, resolution, radial distortion), tag detectability analysis, and localization from the 4 corner tags (homography).
- Rover (WASD + arm keys), differential drive, hills option.
- Irrigation: pump, nozzle/soil probe at the gripper tip, droplet physics, soil moisture per pot, tank.
- Water station + **autonomous navigation** (watering and refilling) driven only by camera estimates.
- Spec tab: every dimension and PCB-derived part in one place.

## Controls

| Key | Action |
|---|---|
| W / S | forward / back |
| A / D | turn |
| Q / E | arm yaw |
| R / F | shoulder |
| T / G | elbow |
| Z / X | gripper |
| P | pump (manual) |

Autopilot buttons are in the "ناوبری خودکار" card (start auto-watering, go refill, stop). Pressing W/A/S/D cancels autopilot.

## Notes

- Code was syntax-checked but not yet verified in a browser by its author — report issues.
- Several water-system numbers (pump flow, tank size, ADC calibration, evaporation speed-up) are assumptions, listed in `docs/PROJECT_BRIEF_Space_Greenhouse.md`.
- Full description for humans and AI assistants: [`docs/PROJECT_BRIEF_Space_Greenhouse.md`](../docs/PROJECT_BRIEF_Space_Greenhouse.md).
