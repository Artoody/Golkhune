/**
 * Auth user store remains env-backed (Step 1).
 * Telemetry / logs / AI commands live in SQLite (Step 4).
 */
const { config } = require("./config");
const { getSqliteStatus } = require("./db/sqlite");

function getAdminUser() {
  return {
    id: 1,
    email: config.adminEmail,
    role: "admin",
    isActive: true,
  };
}

function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const admin = getAdminUser();
  if (normalized !== admin.email) {
    return null;
  }
  return admin;
}

function getDbStatus() {
  return {
    adminStore: "env-mock",
    sqlite: getSqliteStatus(),
  };
}

module.exports = {
  getAdminUser,
  findUserByEmail,
  getDbStatus,
};
