const { z } = require("zod");

const n8nWebhookSchema = z
  .object({
    temperature: z.number({
      required_error: "temperature is required",
      invalid_type_error: "temperature must be a number",
    }),
    humidity: z
      .number({
        required_error: "humidity is required",
        invalid_type_error: "humidity must be a number",
      })
      .min(0, "humidity must be at least 0")
      .max(100, "humidity must be at most 100"),
    heater_status: z.boolean({
      required_error: "heater_status is required",
      invalid_type_error: "heater_status must be a boolean",
    }),
  })
  .strip();

module.exports = { n8nWebhookSchema };
