const { config } = require("../config");
const { getLatestTelemetry, MOCK_TELEMETRY } = require("../db/sqlite");

function getPublicDashboard(_req, res, next) {
  try {
    const latest = getLatestTelemetry();
    const telemetry = latest
      ? {
          temperature: latest.temperature,
          humidity: latest.humidity,
          heater_status: latest.heater_status,
          source: latest.source,
          updated_at: latest.created_at,
          is_mock: false,
        }
      : {
          ...MOCK_TELEMETRY,
          source: "mock",
          updated_at: null,
          is_mock: true,
        };

    return res.json({
      telemetry,
      camera: {
        url: config.cameraStreamUrl,
        status: "placeholder",
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getPublicDashboard };
