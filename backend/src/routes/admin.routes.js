const { Router } = require("express");
const {
  getAdminStatus,
  getAdminLogs,
  postAdminCommand,
} = require("../controllers/admin.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { adminCommandSchema } = require("../schemas/command.schema");

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/status", getAdminStatus);
router.get("/logs", getAdminLogs);
router.post("/command", validate(adminCommandSchema), postAdminCommand);

module.exports = router;
