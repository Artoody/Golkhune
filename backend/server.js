/*
  ESP32 <-> n8n Bridge Server
  ---------------------------
  What this does:
  - Runs a WebSocket server that your ESP32 (Wokwi) connects to.
  - Runs an HTTP endpoint (POST /trigger) that n8n calls.
  - Whenever n8n hits /trigger, this server forwards the payload to every
    connected ESP32 as JSON in the exact shape your sketch expects:
      { "source": "n8n", "timestamp": "...", "data": {...}, "query": {...} }

  Setup:
    npm init -y
    npm install express ws

  Run:
    node server.js

  Then expose it with your tunnel (e.g. localhost.run):
    ssh -R 80:localhost:3000 nokey@localhost.run
  Copy the hostname it gives you into ws_host in the ESP32 sketch,
  and point n8n's HTTP Request node at https://<that-host>/trigger
*/

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json()); // parse JSON bodies from n8n

const server = http.createServer(app);

// WebSocket server shares the same HTTP server/port as Express.
// path must match ws_path in the ESP32 sketch ("/")
const wss = new WebSocket.Server({ server, path: "/" });

// Track connected ESP32 (or other) clients
const clients = new Set();

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${ip}`);
  clients.add(ws);

  // Let the device know it's connected (optional)
  ws.send(JSON.stringify({ message: "Welcome, connected to bridge server" }));

  ws.on("message", (raw) => {
    const text = raw.toString();
    console.log(`[WS] Message from client: ${text}`);

    // Try to parse the device's hello/handshake or any other message
    try {
      const parsed = JSON.parse(text);
      if (parsed.event === "hello") {
        console.log(`[WS] Handshake received from device: ${parsed.device}`);
      }
    } catch (err) {
      // Not JSON, or malformed — that's fine, just log it above
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("[WS] Client error:", err.message);
  });
});

// Broadcast a message to every connected ESP32
function broadcast(payload) {
  const message = JSON.stringify(payload);
  let sentCount = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  return sentCount;
}

// Endpoint n8n calls to trigger a push to the ESP32
app.post("/trigger", (req, res) => {
  const payload = {
    source: "n8n",
    timestamp: new Date().toISOString(),
    data: req.body || {},
    query: req.query || {},
  };

  const sentCount = broadcast(payload);

  console.log(`[HTTP] /trigger called, forwarded to ${sentCount} client(s)`);

  if (sentCount === 0) {
    // No ESP32 currently connected — this is what causes
    // "Service unavailable" style errors upstream in n8n if it
    // expects a live device to respond.
    return res.status(503).json({
      ok: false,
      error: "No ESP32 clients connected",
    });
  }

  res.json({ ok: true, forwardedTo: sentCount, payload });
});

// Simple health check — hit this in a browser to confirm the
// tunnel + server are alive, independent of the ESP32 or n8n.
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    connectedClients: clients.size,
    uptimeSeconds: process.uptime(),
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`WebSocket path: ws(s)://<host>/`);
  console.log(`n8n should POST to: http://<host>/trigger`);
  console.log(`Health check: http://<host>/health`);
});
