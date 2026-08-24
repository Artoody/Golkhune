const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { config } = require("../config");

let db;

const MOCK_TELEMETRY = {
  temperature: 25.5,
  humidity: 60,
  heater_status: true,
};

function initDb() {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  db = new Database(config.sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      heater_status INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'n8n',
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      admin_email TEXT,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedMockLogsIfEmpty();
  return db;
}

function getSqlite() {
  if (!db) {
    return initDb();
  }
  return db;
}

function seedMockLogsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM system_events").get().n;
  if (count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO system_events (level, action, message, source, meta_json)
    VALUES (@level, @action, @message, @source, @meta_json)
  `);

  const seed = db.transaction(() => {
    insert.run({
      level: "info",
      action: "system.boot",
      message: "Golkhune backend started (SQLite ready)",
      source: "backend",
      meta_json: null,
    });
    insert.run({
      level: "info",
      action: "n8n.waiting",
      message: "Waiting for the first n8n greenhouse webhook",
      source: "n8n",
      meta_json: null,
    });
    insert.run({
      level: "info",
      action: "esp.waiting",
      message: "No ESP32 WebSocket clients connected yet",
      source: "esp32",
      meta_json: null,
    });
    insert.run({
      level: "info",
      action: "camera.placeholder",
      message: "Live camera URL is a placeholder until the stream is wired",
      source: "camera",
      meta_json: JSON.stringify({ url: config.cameraStreamUrl }),
    });
  });

  seed();
}

function insertTelemetry({ temperature, humidity, heater_status, source = "n8n" }) {
  const sqlite = getSqlite();
  const info = sqlite
    .prepare(
      `
      INSERT INTO telemetry (temperature, humidity, heater_status, source, payload_json)
      VALUES (@temperature, @humidity, @heater_status, @source, @payload_json)
    `
    )
    .run({
      temperature,
      humidity,
      heater_status: heater_status ? 1 : 0,
      source,
      payload_json: JSON.stringify({ temperature, humidity, heater_status }),
    });

  return getTelemetryById(info.lastInsertRowid);
}

function getTelemetryById(id) {
  const row = getSqlite().prepare("SELECT * FROM telemetry WHERE id = ?").get(id);
  return row ? mapTelemetry(row) : null;
}

function getLatestTelemetry() {
  const row = getSqlite()
    .prepare("SELECT * FROM telemetry ORDER BY id DESC LIMIT 1")
    .get();
  return row ? mapTelemetry(row) : null;
}

function mapTelemetry(row) {
  return {
    id: row.id,
    temperature: row.temperature,
    humidity: row.humidity,
    heater_status: Boolean(row.heater_status),
    source: row.source,
    created_at: row.created_at,
  };
}

function insertSystemEvent({ level = "info", action, message, source, meta }) {
  const sqlite = getSqlite();
  const info = sqlite
    .prepare(
      `
      INSERT INTO system_events (level, action, message, source, meta_json)
      VALUES (@level, @action, @message, @source, @meta_json)
    `
    )
    .run({
      level,
      action,
      message,
      source: source || null,
      meta_json: meta ? JSON.stringify(meta) : null,
    });

  return sqlite.prepare("SELECT * FROM system_events WHERE id = ?").get(info.lastInsertRowid);
}

function insertAiCommand({ command, adminEmail, status = "accepted" }) {
  const sqlite = getSqlite();
  const info = sqlite
    .prepare(
      `
      INSERT INTO ai_commands (command, admin_email, status)
      VALUES (@command, @admin_email, @status)
    `
    )
    .run({
      command,
      admin_email: adminEmail || null,
      status: status || "accepted",
    });

  return sqlite.prepare("SELECT * FROM ai_commands WHERE id = ?").get(info.lastInsertRowid);
}

function listRecentLogs(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const events = getSqlite()
    .prepare(
      `
      SELECT id, 'event' AS type, level, action, message, source, meta_json, created_at
      FROM system_events
      ORDER BY id DESC
      LIMIT ?
    `
    )
    .all(safeLimit);

  return events.map((row) => ({
    id: row.id,
    type: row.type,
    level: row.level,
    action: row.action,
    message: row.message,
    source: row.source,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    timestamp: row.created_at,
  }));
}

function getSqliteStatus() {
  return {
    driver: "sqlite",
    path: config.sqlitePath,
    ready: Boolean(db),
  };
}

module.exports = {
  MOCK_TELEMETRY,
  initDb,
  getSqlite,
  insertTelemetry,
  getLatestTelemetry,
  insertSystemEvent,
  insertAiCommand,
  listRecentLogs,
  getSqliteStatus,
};
