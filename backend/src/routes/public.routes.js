const { Router } = require("express");
const { getPublicDashboard } = require("../controllers/public.controller");

const router = Router();
router.get("/dashboard", getPublicDashboard);

module.exports = router;
