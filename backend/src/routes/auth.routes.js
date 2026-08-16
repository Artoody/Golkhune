const { Router } = require("express");
const { login, me } = require("../controllers/auth.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, requireAdmin, me);

module.exports = router;
