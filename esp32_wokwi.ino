/*
  ESP32 WebSocket Client Code for Wokwi Simulation
  ------------------------------------------------
  This sketch connects to your central live server using WebSockets.
  When n8n triggers the server, the server forwards the message to this ESP32.

  Library dependencies to install in Wokwi (Library Manager / wokwi-project.txt):
  - WebSockets (by Markus Sattler)
  - ArduinoJson (by Benoit Blanchon)
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi Configuration (Wokwi default WiFi credentials)
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// Live Server Configuration (from localhost.run tunnel)
// DO NOT include "https://" or "wss://" in the host name. Just the domain.
const char* ws_host = "d7958324b28a30.lhr.life"; 
const int ws_port = 443; // Standard HTTPS/WSS port
const char* ws_path = "/"; // Path configured in our Node.js server

WebSocketsClient webSocket;

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
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (error) {
        Serial.print(R"(deserializeJson() failed: )");
        Serial.println(error.f_str());
        return;
      }
      
      // Check if it's a trigger from n8n
      if (doc.containsKey("source") && doc["source"] == "n8n") {
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
