require("dotenv").config();

const http = require("http");
const { createApp } = require("./src/app");
const { config } = require("./src/config");
const { attachEspBridge, ESP_WS_PATH } = require("./src/ws/esp-bridge");
const { initDb } = require("./src/db/sqlite");

initDb();
console.log(`SQLite ready at ${config.sqlitePath}`);

const app = createApp();
const server = http.createServer(app);

attachEspBridge(server, app);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${config.port}`);
  console.log(`Health check: http://<host>/health`);
  console.log(`Login: POST http://<host>/login`);
  console.log(`n8n webhook: POST http://<host>/api/webhooks/n8n`);
  console.log(`Public dashboard: GET http://<host>/api/public/dashboard`);
  console.log(`ESP32 WebSocket: ws(s)://<host>${ESP_WS_PATH}`);
});
