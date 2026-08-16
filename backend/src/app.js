const express = require("express");
const cors = require("cors");
const { config } = require("./config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
