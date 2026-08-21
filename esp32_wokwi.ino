/*
  ESP32 WebSocket Client — n8n LED on D13
  ------------------------------------------------
  Connects to the Railway backend over WSS. When n8n POSTs to
  /api/webhooks/n8n, the backend broadcasts { source: "n8n", data: {...} }
  here. LED on GPIO 13 (D13) turns HIGH for "on" and LOW for "off".

  n8n: import n8n/workflows/esp32-led-on-off.json → Activate → run
  "Turn LED On" / "Turn LED Off" (or Test workflow on either Manual Trigger).

  Library dependencies (Wokwi Library Manager / wokwi-project.txt):
  - WebSockets (by Markus Sattler)
  - ArduinoJson (by Benoit Blanchon)
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi Configuration (Wokwi default WiFi credentials)
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// Live Server Configuration (Railway production WSS)
// DO NOT include "https://" or "wss://" in the host name. Just the domain.
const char* ws_host = "backend-production-33fc.up.railway.app";
const int ws_port = 443; // Standard HTTPS/WSS port
const char* ws_path = "/ws/esp"; // ESP bridge path on Railway backend

// ESP32 DevKit D13 == GPIO 13
const int LED_PIN = 13;

WebSocketsClient webSocket;

bool parseOnOff(JsonVariant v, bool &on) {
  if (v.isNull()) {
    return false;
  }

  if (v.is<bool>()) {
    on = v.as<bool>();
    return true;
  }

  if (v.is<int>()) {
    on = v.as<int>() != 0;
    return true;
  }

  if (v.is<const char*>()) {
    String s = v.as<const char*>();
    s.trim();
    s.toLowerCase();
    if (s == "on" || s == "true" || s == "1" || s == "high") {
      on = true;
      return true;
    }
    if (s == "off" || s == "false" || s == "0" || s == "low") {
      on = false;
      return true;
    }
  }

  return false;
}

void setLed(bool on) {
  digitalWrite(LED_PIN, on ? HIGH : LOW);
  Serial.printf("[LED] D13 (GPIO %d) -> %s\n", LED_PIN, on ? "ON" : "OFF");
}

void applyLedFromN8n(JsonVariant doc) {
  bool on = false;
  JsonVariant data = doc["data"];

  if (parseOnOff(data["led"], on) ||
      parseOnOff(data["command"], on) ||
      parseOnOff(data["heater_status"], on) ||
      parseOnOff(doc["led"], on) ||
      parseOnOff(doc["command"], on) ||
      parseOnOff(doc["heater_status"], on)) {
    setLed(on);
    return;
  }

  Serial.println("[LED] No on/off command (expected data.led, data.command, or data.heater_status)");
}

// WebSocket event handler (Note the correct WStype_t with lowercase 's')
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from server!");
      break;

    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to url: %s\n", payload);
      // Send a handshake/hello message
      webSocket.sendTXT("{\"event\":\"hello\",\"device\":\"ESP32_Wokwi\"}");
      break;

    case WStype_TEXT: {
      Serial.printf("[WS] Received raw text: %s\n", payload);

      // Parse JSON payload
      StaticJsonDocument<768> doc;
      DeserializationError error = deserializeJson(doc, payload, length);

      if (error) {
        Serial.print(R"(deserializeJson() failed: )");
        Serial.println(error.f_str());
        return;
      }

      // Check if it's a trigger from n8n
      if (doc["source"] == "n8n") {
        Serial.println("\n--- [TRIGGER RECEIVED FROM n8n] ---");

        // Print timestamp
        if (doc.containsKey("timestamp")) {
          const char* ts = doc["timestamp"];
          Serial.printf("Timestamp: %s\n", ts);
        }

        // Print HTTP body data sent by n8n
        if (doc.containsKey("data")) {
          String dataStr;
          serializeJson(doc["data"], dataStr);
          Serial.printf("n8n Payload Data: %s\n", dataStr.c_str());
        }

        // Print HTTP query parameters sent by n8n
        if (doc.containsKey("query")) {
          String queryStr;
          serializeJson(doc["query"], queryStr);
          Serial.printf("n8n Query Params: %s\n", queryStr.c_str());
        }

        applyLedFromN8n(doc);

        Serial.println("------------------------------------\n");
      } else {
        // Handle other messages (e.g. system messages)
        if (doc.containsKey("message")) {
          const char* msg = doc["message"];
          Serial.printf("[WS Message] %s\n", msg);
        }
      }
      break;
    }

    case WStype_BIN:
      Serial.printf("[WS] Received binary length: %u\n", length);
      break;

    case WStype_PING:
      Serial.println("[WS] Received Ping from Server");
      break;

    case WStype_PONG:
      Serial.println("[WS] Received Pong from Server");
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(10);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.printf("[LED] Pin D13 (GPIO %d) initialized OFF\n", LED_PIN);

  Serial.println();
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Configure WebSocket connection (using secure WSS over port 443)
  webSocket.beginSSL(ws_host, ws_port, ws_path);

  // Set event handler
  webSocket.onEvent(webSocketEvent);

  // Try reconnecting automatically every 5000ms if connection is lost
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
}
