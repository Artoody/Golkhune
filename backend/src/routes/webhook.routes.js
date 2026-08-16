const { Router } = require("express");
const { receiveN8nWebhook } = require("../controllers/webhook.controller");
const { validate } = require("../middleware/validate.middleware");
const { n8nWebhookSchema } = require("../schemas/n8n-webhook.schema");

const router = Router();

router.post("/n8n", validate(n8nWebhookSchema), receiveN8nWebhook);

module.exports = router;
