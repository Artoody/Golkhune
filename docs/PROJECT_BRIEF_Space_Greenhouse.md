# Space Greenhouse (گلخانهٔ فضایی) — Complete Project Brief for AI Assistants

> **Purpose of this file:** give any AI (or new teammate) the full context of the project from zero to one hundred: what it is, why it exists, what has been built, how the code works, what the rules are, what is still open. Read sections 1–3 first; everything else is reference.
> **Language note:** the project's user interface is Persian (RTL). Persian UI strings are quoted exactly so you can find them in the code. Explanations are in English.
> **Honesty note:** the assistant that wrote the latest code could not run a browser (no WebGL). Code was syntax-checked only (`node --check`). Treat runtime behavior as *untested* until a human confirms.

---

## 1. TL;DR

A university team is building a **space-greenhouse robotics concept**. In space the environment is observed **only by one fixed "greenhouse camera"** mounted on a curved rail above the plants. A small **rover robot with a 4-axis arm and a water pump** must water potted plants and refill its tank at a **water station**, *navigating only from what the greenhouse camera sees* (QR / AprilTag-like markers).

This repository is a **single-file three.js simulator** of that whole system, plus a tiny Python server that streams the simulated camera as MJPEG (so OpenCV or other code can consume it). Everything is designed to mirror the real **PCB** (ESP32-based board) the team designed.

**Current main deliverable:** `greenhouse_live/` (4 files). The main file is `greenhouse_live_sim.html` (~800 KB, self-contained except CDN libraries).

### Rules from the professor (must be respected by any further work)
1. Add an **irrigation system** (done). *"Everyone may reach a different result for it"* — i.e. design choices must be documented, not assumed correct.
2. **Do not add other things** beyond what is asked (scope discipline).
3. **Sizes of everything matter**; navigation too. The **simulation must be accurate**.
4. A **report of about one hour** (presentation-length) is requested — **still pending** (see §15).
5. The **UI should be prettier**; the environment optimized and nicer (done to a reasonable degree).
6. **Everything must be based on the PCB** (`Space_GreenHouse.PcbDoc`).
7. The team's professor prefers **machine learning** for navigation research (see §14).

---

## 2. Glossary

| Term | Meaning |
|---|---|
| Greenhouse camera ("دوربین گلخانه") | The only sensor of the environment. Mounted on a rail carriage; looks at the field center. |
| Field ("زمین") | Square 150×150 cm plate on a round platform. Everything happens on it. |
| Rail | Half-circle (semicircle) arc, default radius 130 cm. Camera sits at the tip of a rod that tilts (arc angle −90…+90°); the whole rail rotates around the vertical axis (base angle 0…360°). |
| Tag / QR | Square fiducial marker. Corner tags (ids 0–3) define the field plane; other tags mark the robot, plants, station. Not real QR codes: AprilTag-style black squares with white margins. |
| Rover / robot ("ربات سیار") | 4-wheel differential-drive robot with 4-DOF arm; the arm's tip is the water nozzle **and** the soil probe. |
| Station ("ایستگاه آب") | Water tank with a docking spout where the rover refills. Has its own tag (id 7). |
| Probe | Soil-moisture sensor (PCB net `soil`); modeled at the nozzle tip. |
| `CM` | Conversion constant: `CM = 1/30` scene units per cm (1 scene unit = 30 cm). |

---

## 3. System at a glance

```
                      ┌──────────────── rail (R≈130 cm) ────────────────┐
                      │         greenhouse camera (only "eye")           │
                      └───────────────┬──────────────────────────────────┘
                                      │ sees QR tags (corners 0-3, robot 4,
                                      │ plants 5-6, station 7)
                                      ▼
   ┌────────────────────────── field 150×150 cm ────────────────────────────┐
   │  tag0                                                         tag1     │
   │              plant1(5)                                                  │
   │                              station(7) at (0,-62)                      │
   │      rover(4) ──nozzle/probe──►  pot                                    │
   │                                         plant2(6)                       │
   │  tag3                                                         tag2     │
   └─────────────────────────────────────────────────────────────────────────┘

 Data flow (closed loop, ~4 Hz vision):
 camera image → corner tags → homography → camera pose → ray ∩ tag-height plane
   → estimated (x,z) of robot / plants / station (+ robot heading from 2 tag corners)
   → navigation state machine → drive + arm commands → pump/probe (irrigation physics)
```

---

## 4. Repository layout

```
greenhouse_live/
├─ greenhouse_live_sim.html   ← THE simulator (HTML+CSS+JS in one file)
├─ server.py                  ← Python 3 stdlib server (pages + MJPEG relay)
├─ run.bat                    ← Windows launcher (starts server, opens browser tabs)
└─ feed.html                  ← viewer page for the live camera stream
```
Other files in the conversation history (older, superseded versions): `greenhouse_full_sim.html`, `greenhouse_rover.html`, `Greenhouse_Simulator_Documentation.md`. **Use `greenhouse_live/` only.** Source hardware file: `Space_GreenHouse.PcbDoc` (Altium).

### Run
- Windows: double-click `run.bat` (needs Python 3). Opens `http://localhost:8000/` (simulator) and `/feed`.
- Any OS: `python server.py 8000`.
- Server endpoints: `/` simulator, `/feed` viewer, `/stream` MJPEG (`cv2.VideoCapture("http://localhost:8000/stream")`), `/latest.jpg`, `/status` (JSON), `POST /frame` (simulator uploads JPEG frames when the "پخش زندهٔ دوربین" box is ticked).
- **Internet is required** for CDN scripts: three.js **r128** (cdnjs), `OrbitControls.js` and `GLTFLoader.js` (jsDelivr, three@0.128.0), and Google Fonts (Vazirmatn). Without internet the page does not work (three.js missing). The plant glTF model is **embedded** in the HTML (`<script type="application/json" id="plantGltf">`), so no extra files.

---

## 5. Coordinates, units, constants

- **Axes:** three.js right-handed, **Y up**. Field center is the origin. The platform group (`baseGroup`) never rotates, so world = field-local coordinates.
- **Units:** 1 scene unit = 30 cm (`CM = 1/30`). Almost all UI numbers are in **cm**; code converts with `* CM` / `/ CM`.
- **Heading convention (rover):** `rotation.y = θ`; forward vector = `(sin θ, cos θ)` in (x, z). Rover local **+z is forward**, +x is left.
- Key constants (top of script): `PLAT_Y = 0.25` (platform top), `FIELD_Y = 0.26` (field plate top), `RAIL_Y`, `LENS_DROP = 0.4`.
- State object `S` defaults: `railCm 130, tagCm 10, fieldCm 150, f 2.1 mm, zoom 1, sensorW 5.37 mm, W×H 1280×720, k 0 (distortion), thr 24 px`.
- Platform: cylinder radius 3.8 units (≈114 cm), top at `PLAT_Y`.

---

## 6. Code architecture (`greenhouse_live_sim.html`, ~1160 script lines)

The script is one `<script>` block, roughly in this order:

1. **Constants & data** — `TAGS`, `TAG_B64` (base64 PNG tags), `makeTagURL()` (generates the station tag), `S`.
2. **`//<<PURE … //PURE>>` math section** — no three.js dependency: vectors (`sub, dot, cross, norm, vlen`), rotations (`rotX, rotY`), `camPose`, `camParams`, `undistToDist`, `undistPx`, `project`, `pixelRay`, `analyzeTag`, `hfovOf`, `solveLS`, `orthoCols`, **`estimateScene`**. Keep this section dependency-free (it may be unit-tested in Node).
3. **Scene** — renderer (shadow map, pixel ratio capped at 2), lights, platform, field (`buildField`), hills (`genHills`, `th(x,z)`), rail (`buildRail`), carriage + camera body.
4. **Tags, robot, plants** — `TAGS.forEach` creates tag meshes (+ pots, station geometry); `layoutTags`, `tagGeos` (world-space tag corners, also for uploaded images).
5. **Graphics extras** (layer 1 only): floor disc, edge glow ring, particles, glass dome (`makeDome`), `applyShadows`.
6. **Rover** — `bx/cy` helpers, wheels, 4-DOF arm (`armYaw → shoulder → elbow → wrist`, gripper fingers), `applyArm`, keyboard, `updateRover`, `groundFollow` (hills).
7. **Irrigation** — `IRR`, droplet pool, `irrigTick`.
8. **Navigation** — plant glTF loader IIFE, `WP` (water pose search), `navFix`, `planDock`, `via`, `navTick`, `navBegin`, `navStop`.
9. **Uploaded images/QR** — upload, drag, `refreshImgList`, analysis as tags `U1…`.
10. **Camera view** — `renderCameraView` (distortion shader), `drawOverlay`, `updateInfo`, `updateFrustum`.
11. **Localization UI** — `locTick` (card "تخمین موقعیت از روی تگ‌های گوشه") → calls `navFix`.
12. **Live stream** — `streamTick`.
13. **Environment sensors** — `updEnv` (temp/air sliders).
14. **Spec tab** — `SPECS`, `updateSpecs`, `showTab`.
15. **Main loop** — `frame()`; last line boots everything.

### Render layers
Display-only helpers (dome, particles, floor, frustum, glow ring) live on **layer 1**. The main viewer camera sees layers 0+1; the simulated greenhouse camera sees **layer 0 only**, so effects never contaminate the analysis. Tag/image materials are `MeshBasicMaterial` (unlit) so lighting does not affect detection.

### Per-frame order (approx.)
`controls.update` → `updateRover` (calls `navTick` first) → arm/pose updates → `scene.updateMatrixWorld` → `irrigTick` → `tagGeos` → tag analysis → `renderCameraView` → overlay/info → `updateSpecs` → `renderer.render` (skipped while the spec tab is shown) → `streamTick`, `locTick` (4 Hz throttle).

---

## 7. Camera & lens model

- **Pose (`camPose`)**: carriage at radius `rc = railCm·CM − LENS_DROP` from the arc center; rod tilt `arc` about X, rail rotation `base` about Y; camera always **looks at the field center** `(0, FIELD_Y, 0)`; up-vector perpendicular to the rod plane.
- **Intrinsics (`camParams`)**: `feff = f·zoom`, `fpx = feff·W / sensorW`, `hfov = 2·atan(sensorW / (2·feff))`. Principal point at image center.
- **Distortion**: radial, `r_d = r_u + k·r_u³` (r normalized by half-diagonal). Analysis inverts with 10 Newton steps (`undistToDist`/`undistPx`); rendering inverts in a fragment shader.
- **Projection (`project`)**: `x = cx + fpx·(d·R)/z`, `y = cy − fpx·(d·U)/z` then distortion; points with `z ≤ 0.01` are behind the camera.
- **Tag analysis (`analyzeTag`)**: status per tag — out of view / partial / weak (mean side < `thr` px **or** tilt > `TILT_MAX = 65°`) / ok. Tilt = angle between view ray and the tag normal. *Purely geometric: no occlusion, lighting, blur, or real decoder.*

---

## 8. Localization from QR + camera (`estimateScene`) — the "eyes" of the robot

Triggered every 250 ms by `locTick` (checkboxes `lc0…lc3` choose which corner tags are used; slider `locNoise` = Gaussian pixel noise σ).

1. Collect tags in `useIds` (corner tags) whose `analyzeTag` status is **ok**; take their 4 corners' known field coordinates `(X, Z)` in meters and noisy undistorted pixels.
2. Solve the **plane homography** by least squares (`solveLS`), normalize and **orthonormalize** to get rotation columns and translation → **camera pose** (reports camera-position error vs truth).
3. For every non-corner numeric tag: project its center, take the noisy pixel, intersect the viewing ray with the **horizontal plane at the tag's height** → estimated `(x, z)` in cm.
4. **Robot heading (added in this work):** for tag id 4, corners 0 and 3 are back-projected the same way; the vector from corner 0 to corner 3 equals the rover's forward direction → `hdg = atan2(Δx, Δz)`.
5. Output `R = { ok, used, cam, targets:[{id,name,tru,est,hdg,err}] }`; `locTick` draws it on `locMap` and passes it to `navFix(R)`.

Known weakness: the plane assumption breaks on hills (the page says so); noise in tag corners limits heading accuracy to a few degrees.

---

## 9. The rover

### Geometry (`RS = 0.55`, one local unit = `UCM = RS·30 = 16.5 cm`)
| Item | Value |
|---|---|
| Chassis | 10.2 cm wide (inner), ≈11.6 cm with side panels, 16.5 cm long |
| Wheels | 4, diameter ≈ 6.6 cm, track ≈ 13.9 cm, wheelbase ≈ 11.2 cm |
| Deck height | ≈ 8.6 cm (robot tag at h = 8.5 cm, 3.8 cm **behind** center) |
| Arm length (shoulder→gripper) | ≈ 17.5 cm |
| Robot tag | black square = 0.7 × standard (`tagCm`), plate = 1.25 × black |

Why this size: the PCB (**91.6 × 89.8 mm**) must fit inside the chassis (earlier 9.5 cm body did not).

### Motion (`updateRover`)
- Differential drive; `rotation.y += tr·2·dt` (rad/s), position advances `curSpeed·dt` with `curSpeed = fw·spd` (units/s). Speed slider `spd`: 0.1–2 units/s, default 0.5 (= 15 cm/s). Wheels spin from distance ± turn. Clamped to `fieldCm/2 − 8` cm. On hills the rover follows the ground (`groundFollow`).
- Keys (`e.code`, layout-independent): **W/S** forward/back, **A/D** turn, **Q/E** arm yaw, **R/F** shoulder, **T/G** elbow, **Z/X** gripper, **P** pump toggle. Pressing W/A/S/D during autopilot cancels it.
- Arm limits: shoulder −0.6…1.4 rad, elbow 0…2.3 rad, gripper 0…1.
- No physics (mass/friction/slip) and **no collisions** — kinematic only.

---

## 10. Irrigation system (PCB-based)

**PCB link:** header `Pump` (2-pin, 12 V rail), soil-moisture header `soil` (analog, ESP32 ADC), `DHT21` (air temp/humidity). Pump switching by NPN `Q2` and/or relay `K1` placed next to the Pump header — **this is an inference from board placement, not verified pin-by-pin**.

**Model (`IRR`, `irrigTick`)**
- Nozzle & probe at the gripper tip (`nozzle` object on the wrist; water exits along the wrist +Y axis).
- Pump flow `flowLpm` (0.2–1.5, default **0.8 L/min**), orifice 4 mm → exit speed `v = Q / A` (≈1.06 m/s at default).
- Droplets: pool of 600 points, ~400 droplets/s, ballistic motion with gravity `g = 9.81/0.3` scene-units/s², small angular/speed jitter.
- A droplet entering the **pot top circle** (radius 3.8 cm, rim height 7.4 cm) adds `volume / capacity` to that plant's moisture; landing elsewhere counts as waste.
- **Pot capacity:** `POT_CAP_ML = (π·h/3)(rTop² + rTop·rBot + rBot²)·0.4 ≈ 108 mL` (porosity 0.4).
- **Evaporation:** `EVAP = 0.04 %/s` at 26 °C, scaled by `temp/26` and `(1.4 − airHumidity/100)` — **intentionally ~50× faster than reality** so effects are visible.
- **Probe validity:** nozzle within 5 cm horizontally of a pot axis and < 15 cm above its rim.
- **Auto mode:** hysteresis — pump ON when probe < `low` (30 %), OFF at ≥ `high` (65 %); OFF when no pot under probe or tank empty. Manual: button / key **P**.
- **Tank:** `tankMax 1.5 L` (assumed; not in PCB). Counters: water used, delivered to pots, wasted.
- ADC display: `ADC ≈ 3000 − moisture%·17` (assumed capacitive-sensor calibration).
- Env sliders `temp`, `air` stand in for DHT21; soil moisture is **not** a slider any more — it comes from the simulated pots.

---

## 11. Water station & autonomous navigation (camera-only)

### Station (tag id 7, default position `(0, −62)` cm)
Tank Ø12 cm × 14 cm, base plate, docking spout pointing **+z** (tip at z = +9.5 cm from the station center, height 6.9 cm = rover inlet height). Dock pose: rover center at `station + (0, DOCK_D = 19 cm)` facing **−z** (heading π). Refill rate `0.1 L/s` (assumed), water source unlimited.

### Navigation design principle
The robot has **no environment sensors**. `NAV.est` (robot x, z, θ) comes **only** from the camera estimate (`navFix`), tag center + `3.8 cm·forward` offset. Between camera fixes (≈4 Hz) the state is **dead-reckoned from the commanded v, ω**. If no fix for **1.5 s** the robot stops ("QR ربات در دید دوربین نیست؛ ربات ایستاده است"). Plant/station positions are exponentially smoothed (α = 0.35) from camera estimates.

### State machine (`navTick`)
`plan → drive → align → (arm → water → stow) | (dockcheck → refill → undock) → plan …`
- **plan:** pops next task (`{type:'plant', id}` or `{type:'station'}`); if a plant task starts with tank < 0.25 L, a station task is inserted first. `planDock` picks, among 16 approach directions, the dock pose that stays inside the field, ≥ 14 cm from other obstacles, closest to the robot; `via` inserts one detour waypoint around obstacles near the segment.
- **drive:** proportional heading control (`tr = clamp(2.2·err)`), forward speed ∝ distance and ∝ cos(err); waypoint tolerance 4 cm, final dock 1.2 cm.
- **align:** rotate in place to goal heading (±3°).
- **arm/water:** arm moves to `WP` — a pose found at load time by brute-force search (sh −0.6…1.4, el 0…2.3, step 0.05) on the real scene graph so that the nozzle points down (axis·Y < −0.9) with the tip 6 cm above the pot rim; `WP.d` is the resulting nozzle distance ahead of the rover center. Then the irrigation auto logic does the watering; done when pump off and probe ≥ `low` (or 120 s timeout; retry once if nozzle never gets over the pot).
- **dockcheck (station):** physical mating test using **true** pose (|x err| ≤ 2 cm, |z err| ≤ 2.5 cm, |heading err| ≤ 0.15 rad). Failing means camera error was too big → back off and retry (max 3). This is how camera noise shows up as a real consequence.
- **refill:** tank += 0.1 L/s until full; **undock:** reverse until ~12 cm clear.
- UI card "ناوبری خودکار (دوربین گلخانه + QR)": buttons «شروع آبیاری خودکار», «پر کردن مخزن (برو به ایستگاه)», «توقف», live status line with estimation error.

Requirements for it to work: the camera must see the corner tags (`analyzeTag` ok), the robot tag, and the target tag. Set camera angle/base so the whole field is visible (default arc 0).

---

## 12. UI map

**Two tabs:** «شبیه‌سازی» (`paneSim`) and «مشخصات کامل» (`paneSpec`).

**Sidebar accordions** (in order): ربات سیار · ناوبری خودکار · سیستم آبیاری (پمپ روی برد) · اپتیک و حسگر تصویر · ریل و پلتفرم · QR و تصاویر روی زمین · تخمین موقعیت از روی تگ‌های گوشه · پخش زندهٔ دوربین · تپه‌ها و زمین ناهموار · حسگرهای محیطی (شبیه‌سازی) · نشانک‌های زاویه.
**Stage:** 3D view (`canvasWrap`) + "خروجی دوربین" (`camCanvas` + overlay `ov`) + tag table (`tagTable`).

**Spec tab** (`SPECS` array): rover mechanics, electronics per PCB, irrigation, station & navigation, live rover state, camera & lens, rail & platform, field/tags/results. Rows that are functions update live (`updateSpecs`).

**Key element ids:** `spd, followBtn, roverReset, navMission, navRefill, navStop, navStatus, irrAuto, irrPump, irrFlow, irrLow, irrHigh, irrRefill, irrStatus, focal, zoom, hfovIn, dist, sensor, res, thr, tagCm, fieldCm, showFrustum, arc, base, railCm, play, reset, fileInput, imgScale, imgList, lc0–lc3, locNoise, locMap, locOut, liveOn, liveFps, hillsOn, slope, temp, air, noteAngle, tabSim, tabSpec`.

Uploaded images/QR: any number; each is placed on the field, draggable, editable (x, z, rotation, size in cm in a table), and analyzed as a tag `U1, U2, …` using the whole image rectangle.

Styling: CSS variables `--acc #5DCAA5`, `--acc2 #9992e8`; glass cards; dashboard grid (sidebar 410 px + stage); RTL; Vazirmatn font.

---

## 13. Hardware facts from the PCB (`Space_GreenHouse.PcbDoc`)

Extracted by parsing component names and nets (**pad-level connectivity was not traced**):

| Item | Detail |
|---|---|
| Board | ≈ 91.6 × 89.8 mm, 32 components |
| MCU | ESP32 DevKit V1 |
| Drive motors | 2 DC (header `Motors1`, nets `Motor1_IN1/IN2`, `Motor2_IN1/IN2`) |
| Servos | 4 (`Servo1…Servo4`) → arm yaw, shoulder, elbow, gripper |
| Pump | 1 (`Pump` header, 12 V) |
| Switching parts | relays `K1`, `K2`; NPN transistors `Q1…Q4` |
| Sensors | 4×LDR, MQ135 (gas), smoke, DHT21, soil moisture, UV |
| Other | RGB LED, buzzer, battery `BT1`, regulator `VR1`, switch `S1`, diode `D1` |

Total actuators: **7** (2 DC + 4 servo + 1 pump). The simulator mirrors this: 2-motor differential drive, 4-DOF arm, 1 pump.

---

## 14. Machine-learning navigation research (requested by the professor)

Status: **research done, not implemented.** Summary:
- Reference practice: robots trained in simulation (e.g., a humanoid carrying boxes, Atlas moving a fridge) transfer to hardware using **domain randomization** and **model calibration with real data** (sim-to-real).
- Proposed pipeline: (1) port the 2-wheel kinematic model + camera-noise model into a Python **Gymnasium** env; (2) **imitation learning** from recorded WASD drives, then **PPO** (Stable-Baselines3, CPU) fine-tuning; observations = goal distance/angle, heading, speed, obstacle ranges (or tag-estimated positions with noise); actions = (v, ω); reward = progress − time − collision + goal bonus; curriculum from empty field to random layouts; (3) export policy to **ONNX**, run in the browser with ONNX Runtime Web as an "AI mode" next to the state machine; (4) compare against the classical controller / A* (success rate, time, path length, collisions); (5) sim-to-real: randomize friction, motor mismatch, command delay, tag detection loss; calibrate speed vs PWM.
- Important design link: the **observation noise should come from this simulator's camera model** (tag-based localization), because that is the robot's only sensor.

---

## 15. Open tasks / to-do (ordered)

1. **One-hour report** for the professor (presentation script with ~minute-by-minute timing; include accuracy experiments below).
2. **Accuracy experiments** (not run yet): localization error vs noise σ and vs camera pose; docking success rate vs noise; irrigation delivery efficiency (pot vs waste). Pure-math part (`estimateScene`) can be tested in Node with synthetic corner data.
3. **Browser verification** of everything added recently (nav state machine, glTF plants, station docking). Report bugs with the status text from the "ناوبری خودکار" card.
4. Replace assumed numbers with real ones: pump model/flow, tank size, nozzle diameter, ADC calibration, refill rate, evaporation scaling.
5. Verify **pin-level PCB connectivity** (which transistor/relay drives the pump).
6. Optional later: collisions, ML navigation implementation, real-robot link (ESP32) to compare sim vs reality.

---

## 16. Assumptions & known limitations (be skeptical of these)

- Tag detection is geometric only (no occlusion by robot/arm, lighting, blur, real decoder). Tag id 7's pattern is simulated, not a real AprilTag.
- Localization assumes a **flat field**; hills add error.
- Plant model (Poly-Haven-style glTF, ~6k vertices) was **scaled** from 16.8 cm pot diameter to 7.6 cm to match the scene's pot size and robot scale.
- Water-physics numbers (flow, orifice, tank, capacity, evaporation, ADC mapping) are assumptions, not PCB-derived.
- Evaporation is accelerated ~50×.
- No collision detection; avoidance exists only in route planning.
- Camera must see the necessary tags for navigation; otherwise the robot waits.
- Rover vs station mating uses true pose (a deliberate "physical truth" check).

---

## 17. Working conventions for AI contributors

1. **Single file.** Keep the simulator in one HTML file; embed assets as data URIs. Do not require build steps.
2. **Small patches.** Prefer targeted string replacements with assertions that each anchor matches exactly once; after editing run `node --check` on the extracted last `<script>` block. Beware Persian text contains ZWNJ (U+200C); copy anchors exactly or use regex with `.`.
3. **UI language is Persian, RTL.** Add new labels in Persian. Use existing CSS variables/classes (`.card`, `details.acc`, `.row`, `.out`, `.hint`, `.bars`).
4. **Keep layer discipline:** decorative objects → `layers.set(1)`; anything the simulated camera should see → layer 0.
5. **Units:** accept cm in the UI, convert with `CM`. Update the **spec tab** when you change dimensions or add parts (rows are generated from constants where possible).
6. **Do not add unrequested features** (the professor's rule). Document assumptions instead.
7. **Accuracy first:** if you change geometry, re-check consistency with the PCB size, tag sizes and rover dimensions; mention it to the user.
8. **Be honest about testing:** say when code was not executed in a browser.
9. When answering the user: reply in Persian unless asked otherwise; keep answers practical and short.

---

## 18. Quick FAQ for another AI

- *Where do I change the robot's size?* `RS` constant (rover block). Tag z-offset (`mesh.position.z = -3.8 * CM`), robot tag height (`h: 8.5` in `TAGS`) and `TAG_BACK = 3.8` must stay consistent with it.
- *Where are plant pots defined?* `TAGS` (ids 5, 6) + `POT` constants; visual replaced by the glTF at load.
- *How do I add another plant?* Add a `TAGS` entry with `role:'plant'`, a tag image in `TAG_B64` (or `makeTagURL(id)`), `pos` in cm; `plants` and `NAV` tasks are built from `role === 'plant'` — update `navMission` task list if needed.
- *Why does the robot not move in autopilot?* Camera cannot see corner tags / robot tag (check "تخمین موقعیت" card and the status line).
- *How do I get the simulated camera into OpenCV?* Run `server.py`, tick "پخش زندهٔ دوربین", open `http://localhost:8000/stream`.
