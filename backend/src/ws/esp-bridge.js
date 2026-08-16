const { WebSocketServer, WebSocket } = require("ws");
const { insertSystemEvent } = require("../db/sqlite");

const ESP_WS_PATH = "/ws/esp";
const HEARTBEAT_MS = 30000;

function recordEvent(event) {
  try {
    insertSystemEvent(event);
  } catch (err) {
    console.error("[WS] failed to persist system event:", err.message);
  }
}

function attachEspBridge(httpServer, app) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: ESP_WS_PATH,
  });
  const clients = new Set();

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] ESP32 connected from ${ip} path=${ESP_WS_PATH}`);
    clients.add(ws);
    ws.isAlive = true;
    recordEvent({
      level: "info",
      action: "esp.connected",
      message: "ESP32 WebSocket client connected",
      source: "esp32",
      meta: { ip },
    });

    ws.send(
      JSON.stringify({
        message: "Welcome, connected to Golkhune ESP32 bridge",
        path: ESP_WS_PATH,
      })
    );

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      const text = raw.toString();
      console.log(`[WS] telemetry from ESP32: ${text}`);

      try {
        const parsed = JSON.parse(text);
        if (parsed.event === "hello") {
          console.log(`[WS] handshake from device: ${parsed.device || "unknown"}`);
          recordEvent({
            level: "info",
            action: "esp.hello",
            message: `ESP32 handshake from ${parsed.device || "unknown"}`,
            source: "esp32",
            meta: { device: parsed.device || "unknown" },
          });
        }
      } catch (_err) {
        // Non-JSON telemetry is still logged above
      }
    });

    ws.on("close", () => {
      console.log("[WS] ESP32 disconnected");
      clients.delete(ws);
      recordEvent({
        level: "info",
        action: "esp.disconnected",
        message: "ESP32 WebSocket client disconnected",
        source: "esp32",
      });
    });

    ws.on("error", (err) => {
      console.error("[WS] ESP32 client error:", err.message);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  function broadcastToEsp(payload) {
    const message = JSON.stringify(payload);
    let sentCount = 0;

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount += 1;
      }
    });

    return sentCount;
  }

  app.locals.espClients = clients;
  app.locals.broadcastToEsp = broadcastToEsp;
  app.locals.espWsPath = ESP_WS_PATH;

  return { wss, clients, broadcastToEsp };
}

module.exports = { attachEspBridge, ESP_WS_PATH };
