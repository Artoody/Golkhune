const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const { findUserByEmail } = require("../db");

const adminPasswordHash = bcrypt.hashSync(config.adminPassword, 10);
const dummyPasswordHash = bcrypt.hashSync("invalid-password-placeholder", 10);

async function authenticateAdmin(email, password) {
  const user = findUserByEmail(email);
  const passwordOk = await bcrypt.compare(
    password,
    user ? adminPasswordHash : dummyPasswordHash
  );

  if (!user || !passwordOk || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function jwtExpiresInSeconds() {
  const raw = config.jwtExpiresIn;
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) {
    return 3600;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

module.exports = {
  authenticateAdmin,
  signAccessToken,
  jwtExpiresInSeconds,
};
