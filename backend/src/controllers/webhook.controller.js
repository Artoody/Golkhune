const {
  insertTelemetry,
  insertSystemEvent,
} = require("../db/sqlite");
const {
  isTelemetryPayload,
  normalizeLedCommand,
} = require("../schemas/n8n-webhook.schema");

function receiveN8nWebhook(req, res, next) {
  try {
    const data = req.validated;

    console.log("[n8n webhook] validated payload:", data);

    const telemetry = isTelemetryPayload(data);
    const led = normalizeLedCommand(data);

    let saved = null;
    if (telemetry) {
      saved = insertTelemetry({
        temperature: data.temperature,
        humidity: data.humidity,
        heater_status: data.heater_status,
        source: "n8n",
      });
    }

    const payload = { ...data };
    if (led) {
      payload.led = led;
    }

    const message = {
      source: "n8n",
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const broadcast = req.app.locals.broadcastToEsp;
    const forwardedTo = typeof broadcast === "function" ? broadcast(message) : 0;

    const parts = [];
    if (led) {
      parts.push(`LED ${led}`);
    }
    if (telemetry) {
      parts.push(
        `${data.temperature}°C, ${data.humidity}% humidity, heater ${
          data.heater_status ? "on" : "off"
        }`
      );
    }

    insertSystemEvent({
      level: "info",
      action: led && !telemetry ? "n8n.led" : "n8n.webhook",
      message: `n8n webhook: ${parts.join("; ")}`,
      source: "n8n",
      meta: { telemetryId: saved ? saved.id : null, forwardedTo, led: led || null },
    });

    console.log(
      `[n8n webhook] ${led ? `led=${led}` : "telemetry"} saved=${
        saved ? saved.id : "none"
      }, forwarded to ${forwardedTo} ESP32 client(s)`
    );
    if (forwardedTo === 0) {
      console.warn("[n8n webhook] no ESP32 clients connected on /ws/esp");
    }

    return res.json({
      status: "success",
      forwardedTo,
      led: led || null,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { receiveN8nWebhook };
