const { z } = require("zod");

const adminCommandSchema = z
  .object({
    command: z
      .string({
        required_error: "command is required",
        invalid_type_error: "command must be a string",
      })
      .trim()
      .min(1, "command cannot be empty")
      .max(2000, "command is too long"),
  })
  .strip();

module.exports = { adminCommandSchema };
