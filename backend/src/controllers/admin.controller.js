const { config } = require("../config");
const {
  insertSystemEvent,
  insertAiCommand,
  listRecentLogs,
  getLatestTelemetry,
} = require("../db/sqlite");

function getAdminStatus(req, res, next) {
  try {
    const clients = req.app.locals.espClients;
    const espCount = clients ? clients.size : 0;
    const latest = getLatestTelemetry();

    return res.json({
      n8n: {
        status: latest ? "received" : "idle",
        lastPayloadAt: latest ? latest.created_at : null,
      },
      esp32: {
        status: espCount > 0 ? "connected" : "disconnected",
        clients: espCount,
      },
      camera: {
        status: "placeholder",
        url: config.cameraStreamUrl,
      },
    });
  } catch (err) {
    return next(err);
  }
}

function getAdminLogs(req, res, next) {
  try {
    const logs = listRecentLogs(req.query.limit);
    return res.json({ logs });
  } catch (err) {
    return next(err);
  }
}

function postAdminCommand(req, res, next) {
  try {
    const { command } = req.validated;
    const adminEmail = req.user?.email || null;

    console.log("[admin command] AI command:", { command, adminEmail });

    const saved = insertAiCommand({ command, adminEmail });
    insertSystemEvent({
      level: "info",
      action: "admin.ai_command",
      message: `Admin sent AI command: ${command}`,
      source: "admin",
      meta: { commandId: saved.id, adminEmail },
    });

    return res.json({
      status: "success",
      message: "Command accepted for the AI",
      command: {
        id: saved.id,
        text: saved.command,
        status: saved.status,
        created_at: saved.created_at,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAdminStatus,
  getAdminLogs,
  postAdminCommand,
};
