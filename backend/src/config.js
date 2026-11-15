require("dotenv").config();

const path = require("path");

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function parseOrigins(raw) {
  const value = String(raw || "").trim();
  if (value === "*") {
    return true;
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const PLACEHOLDERS = new Set([
  "replace-with-a-long-random-secret",
  "replace-with-a-strong-password",
  "password",
  "admin",
  "secret",
]);

const jwtSecret = required("JWT_SECRET");
const adminPassword = required("ADMIN_PASSWORD");

if (jwtSecret.length < 16) {
  throw new Error("JWT_SECRET must be at least 16 characters");
}
if (PLACEHOLDERS.has(jwtSecret) || PLACEHOLDERS.has(adminPassword)) {
  throw new Error("Replace placeholder JWT_SECRET and ADMIN_PASSWORD in your .env file");
}

const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  adminEmail: required("ADMIN_EMAIL").toLowerCase(),
  adminPassword,
  databaseUrl: process.env.DATABASE_URL || "",
  sqlitePath: path.resolve(process.env.SQLITE_PATH || path.join("data", "golkhune.db")),
  cameraStreamUrl:
    process.env.CAMERA_STREAM_URL || "https://example.com/live/golkhune-camera",
  corsOrigins: parseOrigins(
    process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000"
  ),
};

module.exports = { config };
