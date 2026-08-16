const {
  insertTelemetry,
  insertSystemEvent,
} = require("../db/sqlite");

function receiveN8nWebhook(req, res, next) {
  try {
    const data = req.validated;

    console.log("[n8n webhook] validated payload:", data);

    const saved = insertTelemetry({
      temperature: data.temperature,
      humidity: data.humidity,
      heater_status: data.heater_status,
      source: "n8n",
    });

    const message = {
      source: "n8n",
      timestamp: new Date().toISOString(),
      data,
    };

    const broadcast = req.app.locals.broadcastToEsp;
    const forwardedTo = typeof broadcast === "function" ? broadcast(message) : 0;

    insertSystemEvent({
      level: "info",
      action: "n8n.webhook",
      message: `n8n telemetry: ${data.temperature}°C, ${data.humidity}% humidity, heater ${
        data.heater_status ? "on" : "off"
      }`,
      source: "n8n",
      meta: { telemetryId: saved.id, forwardedTo },
    });

    console.log(`[n8n webhook] saved id=${saved.id}, forwarded to ${forwardedTo} ESP32 client(s)`);
    if (forwardedTo === 0) {
      console.warn("[n8n webhook] no ESP32 clients connected on /ws/esp");
    }

    return res.json({
      status: "success",
      forwardedTo,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { receiveN8nWebhook };
