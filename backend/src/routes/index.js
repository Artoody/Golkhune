const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const webhookRoutes = require("./webhook.routes");
const publicRoutes = require("./public.routes");
const adminRoutes = require("./admin.routes");

const router = Router();
router.use(healthRoutes);
router.use(authRoutes);
router.use("/api/webhooks", webhookRoutes);
router.use("/api/public", publicRoutes);
router.use("/api/admin", adminRoutes);

module.exports = router;
