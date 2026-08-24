const { z } = require("zod");

function emptyToUndefined(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return value;
}

function unwrapN8nBody(input) {
  if (typeof input === "string") {
    try {
      return unwrapN8nBody(JSON.parse(input));
    } catch {
      return input;
    }
  }

  if (Array.isArray(input) && input.length > 0) {
    return unwrapN8nBody(input[0]);
  }

  if (input && typeof input === "object") {
    if (input.json && typeof input.json === "object" && !Array.isArray(input.json)) {
      return { ...input, ...input.json };
    }
  }

  return input;
}

const optionalNumber = z.preprocess((value) => {
  const next = emptyToUndefined(value);
  if (next === undefined) {
    return undefined;
  }
  if (typeof next === "string" && next.trim() !== "") {
    return Number(next);
  }
  return next;
}, z.number({ invalid_type_error: "must be a number" }).optional());

const optionalHumidity = z.preprocess((value) => {
  const next = emptyToUndefined(value);
  if (next === undefined) {
    return undefined;
  }
  if (typeof next === "string" && next.trim() !== "") {
    return Number(next);
  }
  return next;
}, z
  .number({ invalid_type_error: "humidity must be a number" })
  .min(0, "humidity must be at least 0")
  .max(100, "humidity must be at most 100")
  .optional());

const optionalBoolean = z.preprocess((value) => {
  const next = emptyToUndefined(value);
  if (next === undefined) {
    return undefined;
  }
  if (typeof next === "boolean") {
    return next;
  }
  if (next === 1 || next === "1" || next === "true" || next === "on" || next === "ON") {
    return true;
  }
  if (next === 0 || next === "0" || next === "false" || next === "off" || next === "OFF") {
    return false;
  }
  return next;
}, z.boolean({ invalid_type_error: "heater_status must be a boolean" }).optional());

const optionalTrimmedString = (max) =>
  z.preprocess((value) => {
    const next = emptyToUndefined(value);
    if (next === undefined) {
      return undefined;
    }
    const text = String(next).trim();
    return text === "" ? undefined : text;
  }, z.string().max(max).optional());

const ledField = z.union([
  z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["on", "off", "true", "false", "1", "0"])),
  z.boolean(),
  z.literal(0),
  z.literal(1),
]);

const n8nWebhookFields = z
  .object({
    temperature: optionalNumber,
    humidity: optionalHumidity,
    heater_status: optionalBoolean,
    led: ledField.optional(),
    command: optionalTrimmedString(2000),
    status: optionalTrimmedString(200),
  })
  .strip()
  .superRefine((data, ctx) => {
    const hasTelemetry =
      data.temperature !== undefined &&
      data.humidity !== undefined &&
      data.heater_status !== undefined;
    const hasLed = data.led !== undefined;
    const hasAiCommand = data.command !== undefined || data.status !== undefined;
    if (!hasTelemetry && !hasLed && !hasAiCommand) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide greenhouse telemetry, an LED command (led), and/or an AI command (command/status)",
      });
    }
  });

const n8nWebhookSchema = z.preprocess(unwrapN8nBody, n8nWebhookFields);

function isTelemetryPayload(data) {
  return (
    typeof data.temperature === "number" &&
    typeof data.humidity === "number" &&
    typeof data.heater_status === "boolean"
  );
}

function normalizeLedCommand(data) {
  const candidates = [data.led, data.heater_status];
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

  if (typeof data.command === "string") {
    const s = data.command.trim().toLowerCase();
    if (s === "on" || s === "off") {
      return s;
    }
  }

  return undefined;
}

module.exports = {
  n8nWebhookSchema,
  isTelemetryPayload,
  normalizeLedCommand,
};
