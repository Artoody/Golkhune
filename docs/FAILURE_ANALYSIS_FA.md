# Greenhouse Communication Path and Failure Analysis

This report separates the repository's current implementation from the proposed hardware and digital-twin architecture. Numerical thresholds and rates are suggestions for experiments; they must be measured on the real system.

## 1. Current implementation and proposed architecture

### What is implemented in the repository

```
n8n ──HTTP──► backend (Express, Railway or local)
                    ├──► SQLite: telemetry and system_events
                    └──WebSocket /ws/esp──► all connected ESP32 clients

frontend: currently a scaffold; no connected digital-twin dashboard

simulation/greenhouse_live:
browser (3D scene, simulated vision and navigation) ──HTTP──► Python server
                                                         └── MJPEG /stream and /latest.jpg
```

According to the [backend guide](../backend/README.md), the n8n webhook stores telemetry and broadcasts payloads to every connected `/ws/esp` client. The documented WebSocket route has no authentication; the webhook response reports the number of connected clients, but the current documentation does not define an ACK/result lifecycle for device command execution. `CAMERA_STREAM_URL` is a dashboard placeholder. The simulator is separate: its navigation runs in JavaScript in the browser, while its Python server serves the page and camera frames.

### Proposed hardware and digital-twin architecture

```
real camera ─JPEG/LAN─► laptop vision service B ─► pose/frame time ─┐
robot ESP32 ◄── deadline-based WebSocket + ACK ─► backend/controller B ├─► API/events ─► digital twin A
greenhouse ESP32 ◄──── WebSocket/telemetry ─────► backend B           │
n8n/AI ──HTTP mode proposal──► validation and queue in backend B ─────┘
```

This is an **integration proposal**, not the current deployed architecture. Internet loss is different from LAN loss: if local control and devices remain healthy, an accepted local mission may continue under safety rules. Loss of robot communication or invalid vision should stop motion.

## 2. Digital-twin states

The twin should keep observed state separate from the planned path and commands. Every data point should include its sample time and age.

- **Fresh:** the latest observation is valid and within its measured freshness deadline; it may be shown as observed position.
- **Stale:** the camera frame or telemetry deadline has passed; label the last position as the “last observation,” show its age, and stop autonomous motion.
- **Invalid/Unavailable:** tags or sensors cannot provide a trustworthy estimate; do not invent a fresh position or treat commanded motion as confirmed. Enter a safe hold.
- **Pending:** a command was sent but no ACK/result arrived; do not display success. After recovery, check physical state before deciding whether to retry.
- **Diverged:** observed motion differs from the planned path or goal; record the discrepancy and likely causes such as slip, stops, obstacles, or delay. Correct the plan only from a valid observation.

## 3. Failure modes, effects, and mitigations

| # | Area | Failure or delay | Effect | Prevention | Expected response / recovery |
|---|---|---|---|---|---|
| 1 | ESP32 ↔ backend | Wi-Fi or WebSocket disconnect | Commands are not delivered or their result is unknown; continuing motion may be unsafe | Message IDs, short deadlines, heartbeat, and an independent board watchdog | Board zeros motors when the deadline expires; mark status disconnected/unknown; after reconnect, inspect physical state and require operator confirmation for a new command |
| 2 | Camera → vision | Missing/stale frames or low frame rate | Old pose reaches the controller and the robot may leave its route | Frame IDs and timestamps, bounded queues, dropping old frames, and measuring frame age/rate | If frame age exceeds the tested limit or the robot tag is lost, stop motion and mark the twin Stale/Invalid |
| 3 | Localization | Occluded tag, poor calibration/geometry, glare, or bad lighting | Position and heading errors can cause a collision or a wrong destination | Test camera coverage, calibrate, use reference tags, and track estimate quality | Reject low-quality estimates; slow or stop; show position/heading error and log the frame ID |
| 4 | Network/controller | Delayed or out-of-order messages | An old command may execute after a new one; the twin falls behind | Sequence numbers, expiry times, bounded queues, and separating image traffic from control | Reject expired/duplicate messages; verify sequence order; rebuild position from a fresh observation |
| 5 | Backend | Outage or restart | New commands and history are temporarily unavailable; SQLite may be lost on ephemeral Railway storage | Health checks, persistent volume, backups, and event logging | Do not accept new missions; after recovery, check service health and device state; do not resume a mission automatically |
| 6 | AI/n8n → backend | Invalid, late, or repeated response; internet loss | Wrong or duplicate operating mode | AI only proposes; server validates mode, target, freshness, and mission ownership; use idempotent IDs | Reject and log invalid/late responses; keep emergency stop outside the normal queue; internet loss alone need not stop a healthy local mission |
| 7 | Backend ↔ multiple ESP32s | Broadcast to all clients or ambiguous device ID | Wrong boards may receive or execute a payload | Explicit device IDs, per-device authorization, and ACKs that identify the target | Do not mark a command executed until the intended device ACKs; report ambiguous outcomes to the operator |
| 8 | Twin ↔ device | Planned state differs from physical state | Misleading display; next command may rely on a false state | Show observed pose, planned path, command, and observation time separately | Mark Diverged and hold the mission until a fresh observation and controller/operator decision |
| 9 | Arm/pump | Actuator runs after vision loss or without valid preconditions | Arm collision or unintended watering | Board-level interlocks, motion/time/volume limits, and checking permission before every actuator command | Vision loss/emergency stop must stop arm and pump too; investigate unknown outcomes |
| 10 | Dock/water | Robot is near the station but not connected, or fill level/flow is not measured | Twin reports a refill that did not happen | Connection sensor and a testable level/flow confirmation method | Record refill only after sensor feedback; otherwise show “unconfirmed” |

**Current-state note:** the backend README says valid webhook payloads are broadcast to all open `/ws/esp` clients. Target-specific addressing and ACKs in this table are recommendations, not current capabilities. The frontend is still a scaffold and no server-connected twin exists.

## 4. Navigation safety-order defect

In the simulator navigation loop, arm interpolation (`NAV.armT`) runs before checking whether the latest camera fix is fresh. If vision is lost while the mission remains active, the arm can continue moving even if base motion is stopped later in the same tick. Before connecting servos to this logic, check frame freshness, emergency stop, and actuator permission before **any** movement command. A useful classroom test is to interrupt the camera feed while the arm is stowing and confirm that every actuator enters a safe state.

The defect is documented here; runtime code was not changed. A real stop threshold must be measured from speed, stopping distance, and latency.

Code reference: [`navTick` in the simulator](../simulation/greenhouse_live/greenhouse_live_sim.html). It updates `NAV.armT` before the `!NAV.on` and `NAV.estT` freshness checks; therefore, while a mission remains active, the arm is updated in a tick even when the camera estimate has expired.

## 5. Suggested classroom demonstrations

1. **Robot communication loss:** run a test LED command with an ACK, then disconnect Wi-Fi. Show that new commands are rejected, the connection becomes stale, and the board zeros motor output after its deadline.
2. **Camera loss:** cover the robot tag or pause the frame stream during motion. Show frame age, safe stop, and the twin's Stale/Invalid state.
3. **Delay/out-of-order message:** deliver an old message after a newer one. The system should reject the expired message and distinguish observed position from the planned route.
4. **Twin/physical mismatch:** move the robot by hand or stop it. Compare observed pose with planned path and verify the twin does not claim success without fresh data.
5. **Internet vs LAN outage:** disconnect internet/n8n while keeping the LAN, then disconnect the robot itself. Demonstrate the difference between a healthy accepted local mission and loss of device communication.
6. **Arm safety:** interrupt vision while the arm is stowing; compare interlock behavior before and after correcting the check order.
7. **Correct-device routing:** connect two boards with separate IDs and verify that only the target board ACKs and executes. Until routing and ACKs are implemented, this is a future acceptance test.

For each demonstration, record event time, frame/telemetry age, command ID, ACK, actuator state, and twin state. Present rates and timeouts as experimental suggestions, not fixed values.

## 6. Differences between the initial report and the repository

- The initial report diagrams “camera → laptop OpenCV → estimate → local server → SSE/WebSocket → twin.” The repository does not currently connect that entire chain. Its backend receives HTTP from n8n and sends WebSocket payloads to ESPs; the frontend is still a placeholder.
- The meeting architecture with two ESP32s and local control is a **target design**; the current backend has a simpler role and broadcasts payloads to all connected WebSocket clients.
- The report assumes a real camera and OpenCV. The current simulator performs localization and navigation in its browser page; the Python server serves the page and MJPEG stream.
- SSE, a single command queue, full permission validation, ACKs, and a command-state lifecycle are not established in the current backend documentation; describe them as development requirements.
- Simulator autopilot does not prove hardware control. Real motor, servo, pump, and docking confirmation require separate tests.

## Repository references

- [Project brief and architecture gaps](PROJECT_BRIEF_Space_Greenhouse.md)
- [Backend guide and current routes](../backend/README.md)
- [Simulator guide](../simulation/README.md)
- [Current frontend status](../frontend/README.md)

---

# تحلیل مسیر ارتباط و سناریوهای خرابی گلخونه

این سند برای ارائهٔ کلاسی، وضعیت واقعی مخزن را از طرح پیشنهادی جلسه جدا می‌کند. آستانه‌ها و نرخ‌های عددی زیر معیار نهایی سخت‌افزار نیستند و باید با اندازه‌گیری تعیین شوند.

## ۱. معماری موجود و مسیر پیشنهادی

### آنچه اکنون در مخزن پیاده‌سازی شده است

```
n8n ──HTTP──► backend (Express، Railway یا اجرای محلی)
                    │
                    ├──► SQLite: telemetry و system_events
                    └──WebSocket /ws/esp──► همهٔ ESP32های متصل

frontend: فعلاً اسکلت/راهنما؛ داشبورد دوقلوی دیجیتال پیاده‌سازی نشده است

simulation/greenhouse_live:
مرورگر (سه‌بعدی، بینایی و ناوبری شبیه‌سازی‌شده) ──HTTP──► Python server
                                                      └── MJPEG /stream و /latest.jpg
```

طبق [راهنمای backend](../backend/README.md)، وب‌هوک n8n داده را ذخیره و payload را به همهٔ کلاینت‌های باز `/ws/esp` می‌فرستد. رابط WS فعلاً بدون احراز هویت معرفی شده، پاسخ شامل تعداد کلاینت‌های متصل است و چرخهٔ ACK/نتیجه برای اجرای فرمان در مستندات فعلی تعریف نشده. `CAMERA_STREAM_URL` در داشبورد صرفاً placeholder است. شبیه‌ساز نیز مستقل است: ناوبری‌اش در JavaScript داخل صفحه اجرا می‌شود و Python server فقط صفحه و فریم دوربین را سرو می‌کند.

### معماری هدف برای سخت‌افزار و دوقلو

```
دوربین واقعی ─JPEG/LAN─► سرویس بینایی روی لپ‌تاپ B ─► موقعیت/زمان فریم ─┐
ESP32 ربات ◄──── WebSocket با مهلت و ACK ───► بک‌اند/کنترل‌گر B            ├─► API/رویداد ─► دوقلوی دیجیتال A
ESP32 گلخانه ◄── WebSocket/تله‌متری ───────► بک‌اند B                    │
n8n/AI ──HTTP پیشنهاد حالت──► اعتبارسنجی و صف در بک‌اند B ────────────────┘
```

این نمودار **پیشنهاد یکپارچه‌سازی** است، نه معماری اجراشدهٔ فعلی. قطع اینترنت با قطع LAN یکی نیست: اگر کنترل محلی و دستگاه‌ها سالم باشند، می‌توان مأموریت پذیرفته‌شده را طبق قواعد ایمنی ادامه داد؛ قطع ارتباط ربات یا نامعتبرشدن دید باید حرکت را متوقف کند.

## ۲. حالت‌های دوقلوی دیجیتال

دوقلو باید وضعیت مشاهده‌شده را از مسیر/فرمان برنامه‌ریزی‌شده جدا نگه دارد. هر داده باید زمان نمونه و سن داده داشته باشد.

- **همگام (Fresh):** آخرین مشاهده معتبر و در محدودهٔ مهلت است؛ نمایش موقعیت به‌عنوان مشاهده‌شده مجاز است.
- **کهنه (Stale):** مهلت فریم یا تله‌متری گذشته؛ آخرین موقعیت فقط با برچسب «آخرین مشاهده» نمایش داده شود، حرکت خودکار متوقف و زمان آخرین داده آشکار باشد.
- **نامعتبر/ناموجود (Invalid/Unavailable):** تگ یا حسگر قابل اتکا نیست؛ موقعیت تازه جعل یا از روی فرمان قطعی فرض نشود، مأموریت به توقف امن برود.
- **در انتظار تأیید (Pending):** فرمان ارسال شده اما ACK/نتیجه نرسیده؛ وضعیت موفقیت نشان داده نشود. پس از بازیابی، ابتدا وضعیت فیزیکی بررسی شود و سپس دربارهٔ تکرار فرمان تصمیم گرفته شود.
- **اختلاف (Diverged):** مشاهدهٔ واقعی از مسیر/هدف فرمان فاصله دارد؛ اختلاف و علت احتمالی (لغزش، توقف، مانع یا تأخیر) ثبت شود و کنترل‌گر مسیر را فقط پس از مشاهدهٔ معتبر اصلاح کند.

## ۳. خرابی، اثر و رفتار پیشنهادی

| # | بخش | خرابی یا تأخیر | اثر | پیشگیری | رفتار/بازیابی |
|---|---|---|---|---|---|
| ۱ | ESP32 ↔ بک‌اند | قطع Wi‑Fi یا WebSocket | فرمان نمی‌رسد یا نتیجه نامعلوم می‌ماند؛ حرکت بازمانده می‌تواند خطرناک باشد | پیام دارای شناسه، مهلت کوتاه، heartbeat و watchdog مستقل روی برد | برد با پایان مهلت موتور را صفر کند؛ وضعیت «قطع/نامعلوم» ثبت شود؛ پس از اتصال مجدد وضعیت واقعی بررسی و فرمان تازه با تأیید اپراتور صادر شود |
| ۲ | دوربین → بینایی | قطع فریم، فریم کهنه یا افت نرخ | موقعیت قدیمی به کنترل‌گر می‌رسد و ربات از مسیر منحرف می‌شود | شماره و زمان هر فریم، محدودکردن صف، حذف فریم‌های قدیمی و سنجش نرخ/تأخیر | اگر سن فریم از حد آزموده‌شده گذشت یا تگ ربات دیده نشد، حرکت متوقف و twin روی Stale/Invalid بماند |
| ۳ | تخمین موقعیت | تگ پوشیده، کالیبراسیون/هندسه نادرست، انعکاس یا نور نامناسب | خطای مکان و زاویه؛ برخورد یا رسیدن به نقطهٔ اشتباه | آزمون پوشش دوربین، کالیبراسیون، چند تگ مرجع و سنجهٔ کیفیت تخمین | تخمین کم‌کیفیت رد شود؛ سرعت کم یا توقف؛ نمایش خطای مکان/زاویه و ثبت تصویر/شناسهٔ فریم |
| ۴ | شبکه و کنترل‌گر | تأخیر یا رسیدن خارج از ترتیب | فرمان قدیمی پس از فرمان جدید اجرا می‌شود؛ twin عقب می‌ماند | شمارهٔ توالی، زمان انقضا، صف محدود و جداسازی ترافیک تصویر از کنترل | پیام منقضی/تکراری رد شود؛ ترتیب با sequence بررسی شود؛ موقعیت از مشاهدهٔ تازه بازسازی شود |
| ۵ | بک‌اند | خاموشی یا راه‌اندازی مجدد | پذیرش فرمان و تاریخچه موقتاً متوقف؛ SQLite ممکن است روی دیسک موقت Railway از دست برود | health check، volume پایدار، backup و ثبت رویداد | مأموریت جدید پذیرفته نشود؛ پس از بالا آمدن سلامت سرویس و وضعیت دستگاه بررسی شود، مأموریت خودکار از سر گرفته نشود |
| ۶ | AI/n8n → بک‌اند | پاسخ نامعتبر، دیررس یا تکراری؛ اینترنت قطع | حالت اشتباه یا فرمان تکراری | AI فقط پیشنهاددهنده؛ اعتبارسنجی enum/هدف/تازگی/مالک مأموریت در سرور؛ شناسهٔ idempotent | پاسخ دیررس/نامعتبر رد و ثبت شود؛ توقف اضطراری خارج از صف معمول اولویت داشته باشد؛ قطع اینترنت به‌تنهایی مأموریت محلی سالم را مختل نکند |
| ۷ | بک‌اند ↔ چند ESP32 | broadcast به کلاینت‌های متصل یا شناسهٔ دستگاه مبهم | برد اشتباه payload را می‌گیرد یا چند دستگاه هم‌زمان واکنش می‌دهند | آدرس‌دهی صریح به device ID، مجوز هر دستگاه و ACK شامل شناسهٔ مقصد | تا دریافت ACK از همان دستگاه فرمان «اجراشده» تلقی نشود؛ نتیجهٔ مبهم به اپراتور گزارش شود |
| ۸ | دوقلو ↔ دستگاه | اختلاف بین مسیر فرمانی و وضعیت واقعی | نمایش گمراه‌کننده؛ فرمان بعدی بر پایهٔ حالت نادرست صادر می‌شود | نمایش جداگانهٔ observed pose، planned path، فرمان و زمان مشاهده | هنگام اختلاف، twin حالت Diverged نشان دهد؛ مأموریت hold شود تا مشاهدهٔ تازه و تصمیم اپراتور/کنترل‌گر |
| ۹ | بازو/پمپ | اجرای عملگر هنگام گم‌شدن دید یا بدون شرط مجاز | برخورد بازو یا آبیاری بی‌هدف | interlock محلی روی برد، حد حرکت/زمان/حجم و بررسی مجوز پیش از هر فرمان عملگر | قطع دید/توقف اضطراری باید حرکت بازو و پمپ را نیز متوقف کند؛ نتیجهٔ نامعلوم بررسی شود |
| ۱۰ | داک و آب | قرارگرفتن کنار ایستگاه بدون اتصال واقعی یا نبود سنجش سطح/جریان | دوقلو پرشدن را نشان می‌دهد ولی آب وارد مخزن نشده | حسگر اتصال و روش قابل آزمون برای تأیید سطح/جریان | فقط پس از بازخورد سنسور، پرشدن ثبت شود؛ در نبود بازخورد، وضعیت «تأییدنشده» بماند |

**نکته دربارهٔ وضعیت موجود:** README بک‌اند می‌گوید payload معتبر وب‌هوک به همهٔ کلاینت‌های باز `/ws/esp` broadcast می‌شود؛ بنابراین آدرس‌دهی اختصاصی و ACKهای جدول، نیازهای پیشنهادی‌اند و نباید به‌عنوان قابلیت فعلی معرفی شوند. همچنین frontend فعلاً اسکلت است و دوقلوی متصل به سرور وجود ندارد.

## ۴. ایراد ترتیب بررسی ایمنی در ناوبری بینایی

در حلقهٔ ناوبری شبیه‌سازی، به‌روزرسانی/حرکت بازو (`NAV.armT`) پیش از بررسی تازگی آخرین fix دوربین انجام می‌شود. در نتیجه با گم‌شدن دید، بازو ممکن است به حرکت ادامه دهد، حتی اگر بخش حرکت پایه بعداً متوقف شود. پیش از اتصال هر سروو به این منطق، بررسی تازگی فریم، وضعیت توقف اضطراری و مجوز عملگر باید قبل از **هر** فرمان حرکتی انجام شود. آزمون کلاسی روشن: هنگام جمع‌شدن بازو تصویر را قطع کنید و بررسی کنید آیا همهٔ عملگرها به حالت ایمن می‌روند.

این مورد را در این تغییر به‌عنوان باگ مستند کرده‌ایم؛ runtime code تغییر نکرده است. آستانهٔ توقف واقعی باید با سرعت، فاصلهٔ توقف و تأخیر اندازه‌گیری شود.

## ۵. سناریوهای پیشنهادی برای ارائهٔ کلاس

1. **قطع ارتباط ربات:** ابتدا LED آزمایشی را با ACK اجرا کنید؛ سپس Wi‑Fi را قطع کنید. نشان دهید که فرمان تازه پذیرفته نمی‌شود، وضعیت ارتباط stale می‌شود و برد پس از مهلت، خروجی موتور را صفر می‌کند.
2. **قطع دید دوربین:** حین حرکت تگ ربات را بپوشانید یا فریم را متوقف کنید. سن فریم را نشان دهید، سپس توقف امن و حالت Stale/Invalid دوقلو را بررسی کنید.
3. **تأخیر/ترتیب اشتباه:** یک پیام قدیمی را پس از پیام جدید وارد کنید. سیستم باید پیام منقضی را رد کند و twin موقعیت مشاهده‌شدهٔ تازه را از مسیر برنامه‌ریزی‌شده جدا نشان دهد.
4. **اختلاف twin و واقعیت:** دست ربات را دستی جابه‌جا کنید یا حرکت را متوقف کنید؛ مقایسه کنید مسیر برنامه‌ریزی‌شده با مشاهده فرق دارد و twin بدون دادهٔ تازه، موفقیت ادعا نمی‌کند.
5. **قطع اینترنت در برابر LAN:** دسترسی اینترنت/n8n را قطع کنید ولی شبکهٔ محلی را نگه دارید؛ سپس ارتباط خود ربات را قطع کنید. تفاوت ادامهٔ مأموریت محلیِ پذیرفته‌شده با توقف هنگام قطع دستگاه را نشان دهید.
6. **ایمنی بازو:** هنگام stow شدن بازو دید را قطع کنید؛ پیش و پس از اصلاح ترتیب interlock، رفتار بازو و پمپ را مقایسه کنید.
7. **ارسال به دستگاه درست:** دو برد با ID جدا وصل کنید و بررسی کنید که فقط برد مقصد ACK و اجرا می‌دهد. این آزمون تا وقتی routing و ACK در backend پیاده‌سازی نشده، فقط معیار پذیرش آینده است.

برای هر نمایش، زمان رویداد، سن فریم/تله‌متری، شناسهٔ فرمان، ACK، وضعیت عملگر و وضعیت دوقلو را ثبت کنید. نرخ‌ها و timeoutها را به‌عنوان «مقدار پیشنهادی برای آزمایش» معرفی کنید، نه مقدار قطعی.

## ۶. تفاوت‌های گزارش اولیه با کد و مخزن

- گزارش اولیه مسیر «دوربین → OpenCV لپ‌تاپ → تخمین → سرور محلی → SSE/WebSocket → twin» را ترسیم می‌کند؛ مخزن فعلی چنین زنجیرهٔ یکپارچه‌ای ندارد. Backend از n8n با HTTP داده می‌گیرد و به ESPها WebSocket می‌فرستد؛ frontend هنوز placeholder است.
- معماری مستند جلسه دو ESP32 و کنترل محلی را **طرح هدف** می‌داند؛ کد backend کنونی نقش ساده‌تری دارد و payload را به کل WSهای متصل broadcast می‌کند.
- دوربین واقعی/OpenCV در گزارش فرض شده‌اند؛ شبیه‌ساز فعلی در مرورگر خودش localization و navigation را انجام می‌دهد و Python server فقط MJPEG/صفحه را ارائه می‌کند.
- SSE، صف فرمان واحد، اعتبارسنجی کامل مجوز، ACK و چرخهٔ وضعیت فرمان در backend فعلی اثبات/مستند نشده‌اند؛ باید به‌عنوان نیازهای توسعه مطرح شوند.
- حرکت خودکار شبیه‌ساز به‌تنهایی اثبات‌کنندهٔ کنترل سخت‌افزار نیست؛ اتصال واقعی موتور، سروو، پمپ و تأیید داک نیازمند آزمون جداگانه است.

کد مرجع ایراد ترتیب بررسی: [`navTick` در شبیه‌ساز](../simulation/greenhouse_live/greenhouse_live_sim.html) — در این تابع، به‌روزرسانی `NAV.armT` پیش از شرط `!NAV.on` و بررسی `NAV.estT` انجام می‌شود. بنابراین اگر دید دوربین منقضی شود ولی مأموریت هنوز فعال باشد، در همان tick بازو همچنان به‌روزرسانی می‌شود.

## منابع داخل مخزن

- [راهنمای اصلی و تحلیل معماری/اختلاف‌های شبیه‌ساز با طرح](PROJECT_BRIEF_Space_Greenhouse.md)
- [راهنمای backend و مسیرهای فعلی](../backend/README.md)
- [راهنمای شبیه‌ساز](../simulation/README.md)
- [وضعیت فعلی frontend](../frontend/README.md)
