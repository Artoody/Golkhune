const jwt = require("jsonwebtoken");
const { config } = require("../config");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      ok: false,
      error: "Could not validate credentials",
    });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_err) {
    return res.status(401).json({
      ok: false,
      error: "Could not validate credentials",
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin privileges required" });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
