const {
  insertTelemetry,
  insertSystemEvent,
  insertAiCommand,
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

    let telemetryId = null;
    if (telemetry) {
      const saved = insertTelemetry({
        temperature: data.temperature,
        humidity: data.humidity,
        heater_status: data.heater_status,
        source: "n8n",
      });
      telemetryId = saved.id;
    }

    let commandId = null;
    if (data.command) {
      const savedCommand = insertAiCommand({
        command: data.command,
        adminEmail: "n8n",
        status: data.status || "accepted",
      });
      commandId = savedCommand.id;
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
    if (data.command) {
      parts.push(`AI command: ${data.command}`);
    }
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
      action: data.command
        ? "n8n.ai_command"
        : led && !telemetry
          ? "n8n.led"
          : "n8n.webhook",
      message: `n8n webhook: ${parts.join("; ") || "received"}`,
      source: "n8n",
      meta: {
        telemetryId,
        commandId,
        forwardedTo,
        led: led || null,
        status: data.status || null,
      },
    });

    console.log(
      `[n8n webhook] telemetryId=${telemetryId}, commandId=${commandId}, led=${
        led || "none"
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
