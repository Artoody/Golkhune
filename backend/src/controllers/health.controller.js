const { getDbStatus } = require("../db");

function health(req, res) {
  const clients = req.app.locals.espClients;

  res.json({
    ok: true,
    service: "golkhune-backend",
    auth: "ready",
    db: getDbStatus(),
    websocketPath: req.app.locals.espWsPath || "/ws/esp",
    connectedClients: clients ? clients.size : 0,
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

module.exports = { health };
