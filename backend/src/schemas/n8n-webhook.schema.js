const { z } = require("zod");

const ledField = z.union([
  z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["on", "off", "true", "false", "1", "0"])),
  z.boolean(),
  z.literal(0),
  z.literal(1),
]);

const n8nWebhookSchema = z
  .object({
    temperature: z
      .number({
        invalid_type_error: "temperature must be a number",
      })
      .optional(),
    humidity: z
      .number({
        invalid_type_error: "humidity must be a number",
      })
      .min(0, "humidity must be at least 0")
      .max(100, "humidity must be at most 100")
      .optional(),
    heater_status: z
      .boolean({
        invalid_type_error: "heater_status must be a boolean",
      })
      .optional(),
    led: ledField.optional(),
    command: ledField.optional(),
  })
  .strip()
  .superRefine((data, ctx) => {
    const hasTelemetry =
      data.temperature !== undefined &&
      data.humidity !== undefined &&
      data.heater_status !== undefined;
    const hasLed = data.led !== undefined || data.command !== undefined;
    if (!hasTelemetry && !hasLed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide greenhouse telemetry (temperature, humidity, heater_status) and/or an LED command (led or command: "on"/"off")',
      });
    }
  });

function isTelemetryPayload(data) {
  return (
    typeof data.temperature === "number" &&
    typeof data.humidity === "number" &&
    typeof data.heater_status === "boolean"
  );
}

function normalizeLedCommand(data) {
  const candidates = [data.led, data.command, data.heater_status];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) {
      continue;
    }
    if (raw === true || raw === 1) {
      return "on";
    }
    if (raw === false || raw === 0) {
      return "off";
    }
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      if (s === "on" || s === "true" || s === "1") {
        return "on";
      }
      if (s === "off" || s === "false" || s === "0") {
        return "off";
      }
    }
  }
  return undefined;
}

module.exports = { n8nWebhookSchema, isTelemetryPayload, normalizeLedCommand };
