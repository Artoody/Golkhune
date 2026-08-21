# n8n workflows

## ESP32 LED (`esp32-led-on-off.json`)

Turns the ESP32 LED on **D13 (GPIO 13)** via the Railway backend WebSocket bridge.

1. In n8n: **Workflows → Import from File** → this JSON  
   (Railway image also imports `workflows/*.json` on first boot of an empty volume.)
2. Open the workflow and click **Activate**, or use **Test workflow** on either Manual Trigger.
3. Run **Turn LED On** or **Turn LED Off**.

Each path POSTs to `https://backend-production-33fc.up.railway.app/api/webhooks/n8n`.

LED on:

```json
{ "led": "on" }
```

LED off:

```json
{ "led": "off" }
```

The backend broadcasts `{ "source": "n8n", "data": { "led": "on"|"off" } }` to ESP clients on `/ws/esp`. Flash / simulate `esp32_wokwi.ino` so the board is connected first (`forwardedTo` in the HTTP response should be ≥ 1).
