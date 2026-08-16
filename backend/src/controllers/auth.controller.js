const {
  authenticateAdmin,
  signAccessToken,
  jwtExpiresInSeconds,
} = require("../services/auth.service");

async function login(req, res, next) {
  try {
    const email = req.body?.email;
    const password = req.body?.password;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }

    const user = await authenticateAdmin(email, password);
    if (!user) {
      return res.status(401).json({ ok: false, error: "Incorrect email or password" });
    }

    return res.json({
      access_token: signAccessToken(user),
      token_type: "bearer",
      expires_in: jwtExpiresInSeconds(),
    });
  } catch (err) {
    return next(err);
  }
}

function me(req, res) {
  return res.json({
    id: Number(req.user.sub),
    email: req.user.email,
    role: req.user.role,
  });
}

module.exports = { login, me };
