#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>

// ============================================================
//    FIREBASE CONFIG
// ============================================================
const char* WIFI_SSID     = "Airtel_Rutu..";
const char* WIFI_PASSWORD = "Shilpa#2011";

// ✅ FIX: Write to activeSession node (single overwrite, not push)
//    Old: .../sensorData.json          + POST → new key every 2s (thousands of nodes!)
//    New: .../sensorData/activeSession.json + PUT → always overwrites same node
const char* FIREBASE_URL  =
  "https://samved-63bda-default-rtdb.asia-southeast1.firebasedatabase.app"
  "/sensorData/activeSession.json";

// ============================================================
//  PIN CONFIG
// ============================================================
#define DHTPIN          4
#define DHTTYPE         DHT11
#define MQ135_PIN       34
#define BUZZER_PIN      13
#define LED_RED         26
#define LED_YELLOW      27
#define LED_GREEN       14

// GPS PINS (ESP32 Hardware Serial 2)
#define GPS_RX_PIN      16
#define GPS_TX_PIN      17
#define GPS_BAUD        9600

// ============================================================
//  TIMING
// ============================================================
#define WARMUP_MS             60000UL
#define CALIBRATION_SAMPLES   60
#define CALIBRATION_INTERVAL  500UL
#define SENSOR_INTERVAL       2000UL
#define ALERT_COOLDOWN        5000UL
#define RECALIBRATE_EVERY     300000UL

// ============================================================
//  DYNAMIC THRESHOLDS
// ============================================================
#define WARNING_OFFSET    40
#define DANGER_OFFSET     110
#define TEMP_DANGER       40.0f

// ============================================================
//  BUZZER PATTERNS
// ============================================================
#define PASSIVE_BUZZER    false
#define BUZZER_FREQ       2000
#define DANGER_BEEP_ON    100UL
#define DANGER_BEEP_OFF   100UL
#define WARNING_BEEP_ON   300UL
#define WARNING_BEEP_OFF  700UL

// ============================================================
//  STATE MACHINE
// ============================================================
enum SystemState { STATE_WARMUP, STATE_CALIBRATING, STATE_MONITORING, STATE_RECALIBRATING };
enum SafetyState { SAFE, WARNING, DANGER };

SystemState systemState = STATE_WARMUP;
SafetyState safetyState = SAFE;

// ============================================================
//  GLOBALS
// ============================================================
DHT dht(DHTPIN, DHTTYPE);

TinyGPSPlus  gps;
HardwareSerial gpsSerial(2);

double  gpsLat      = 0.0;
double  gpsLng      = 0.0;
double  gpsSpeedKph = 0.0;
int     gpsSats     = 0;
bool    gpsFixed    = false;

int   dynamicBaseline   = 0;
int   GAS_WARNING_LEVEL = 800;
int   GAS_DANGER_LEVEL  = 870;
long  calibSum          = 0;
int   calibCount        = 0;
unsigned long lastCalibSample  = 0;
unsigned long lastRecalibTime  = 0;
unsigned long startupTime      = 0;
unsigned long lastSensorRead   = 0;
unsigned long lastAlertPrint   = 0;
unsigned long buzzerToggleTime = 0;

bool buzzerOn = false;

#define ROLLING_SIZE 5
int rollingBuf[ROLLING_SIZE] = {0};
int rollingIdx   = 0;
bool rollingFull = false;

// ============================================================
//  READ GPS (non-blocking, called every loop tick)
// ============================================================
void readGPS() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (gps.location.isValid() && gps.location.age() < 2000) {
    gpsLat      = gps.location.lat();
    gpsLng      = gps.location.lng();
    gpsSpeedKph = gps.speed.kmph();
    gpsSats     = gps.satellites.value();
    gpsFixed    = true;
  } else {
    gpsFixed = false;
  }
}

// ============================================================
//  SEND DATA TO FIREBASE
//  ✅ KEY CHANGES vs old code:
//    1. Uses http.PUT() instead of http.POST()
//       → PUT overwrites sensorData/activeSession every 2s
//       → POST was creating a new auto-key node every 2s (the bug)
//    2. Adds "gasDiff" field (was computed locally but never sent)
//    3. Adds "timestamp" (millis-based, helps dashboard know data freshness)
// ============================================================
void sendToFirebase(float temp, float hum, int gas, int rawGas, int diff, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi not connected — skipping Firebase upload");
    return;
  }

  HTTPClient http;
  http.begin(FIREBASE_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  // Field names must match WorkerDashboard.jsx exactly
  String payload = "{";
  payload += "\"temperature\":"  + String(temp, 2)          + ",";
  payload += "\"humidity\":"     + String(hum,  2)          + ",";
  payload += "\"gasLevel\":"     + String(gas)              + ",";  // rolling avg
  payload += "\"gasRaw\":"       + String(rawGas)           + ",";  // instantaneous
  payload += "\"gasDiff\":"      + String(diff)             + ",";  // ✅ NEW: gas - baseline
  payload += "\"baseline\":"     + String(dynamicBaseline)  + ",";
  payload += "\"status\":\""     + status                   + "\",";

  // GPS fields
  if (gpsFixed) {
    payload += "\"latitude\":"   + String(gpsLat,      6)  + ",";
    payload += "\"longitude\":"  + String(gpsLng,      6)  + ",";
    payload += "\"speedKph\":"   + String(gpsSpeedKph, 1)  + ",";
    payload += "\"satellites\":" + String(gpsSats)         + ",";
    payload += "\"gpsFixed\":true,";
  } else {
    payload += "\"gpsFixed\":false,";
  }

  payload += "\"uptime\":"       + String(millis() / 1000);
  payload += "}";

  // ✅ PUT replaces the node completely — no duplicate keys, no history buildup
  int responseCode = http.PUT(payload);

  if (responseCode == 200) {
    Serial.println("☁️  Firebase: activeSession updated ✅");
  } else {
    Serial.print("☁️  Firebase Error: ");
    Serial.println(responseCode);
  }

  http.end();
}

// ============================================================
//  BUZZER
// ============================================================
void buzzOn() {
#if PASSIVE_BUZZER
  tone(BUZZER_PIN, BUZZER_FREQ);
#else
  digitalWrite(BUZZER_PIN, HIGH);
#endif
  buzzerOn = true;
}

void buzzOff() {
#if PASSIVE_BUZZER
  noTone(BUZZER_PIN);
#else
  digitalWrite(BUZZER_PIN, LOW);
#endif
  buzzerOn = false;
}

void silenceBuzzer() { buzzOff(); buzzerToggleTime = millis(); }

void handleBuzzer(unsigned long onMs, unsigned long offMs) {
  unsigned long now = millis();
  if (buzzerOn  && now - buzzerToggleTime >= onMs)  { buzzOff(); buzzerToggleTime = now; }
  if (!buzzerOn && now - buzzerToggleTime >= offMs)  { buzzOn();  buzzerToggleTime = now; }
}

// ============================================================
//  LEDs
// ============================================================
void setLEDs(bool red, bool yellow, bool green) {
  digitalWrite(LED_RED,    red    ? HIGH : LOW);
  digitalWrite(LED_YELLOW, yellow ? HIGH : LOW);
  digitalWrite(LED_GREEN,  green  ? HIGH : LOW);
}

// ============================================================
//  ROLLING AVERAGE
// ============================================================
int rollingAverage(int newVal) {
  rollingBuf[rollingIdx] = newVal;
  rollingIdx = (rollingIdx + 1) % ROLLING_SIZE;
  if (rollingIdx == 0) rollingFull = true;
  int count = rollingFull ? ROLLING_SIZE : rollingIdx;
  long sum = 0;
  for (int i = 0; i < count; i++) sum += rollingBuf[i];
  return (int)(sum / count);
}

// ============================================================
//  CALIBRATION
// ============================================================
void applyThresholds(int baseline) {
  dynamicBaseline   = baseline;
  GAS_WARNING_LEVEL = baseline + WARNING_OFFSET;
  GAS_DANGER_LEVEL  = baseline + DANGER_OFFSET;

  Serial.println("\n╔══════════════════════════════════╗");
  Serial.println("║      📐 CALIBRATION RESULT       ║");
  Serial.println("╠══════════════════════════════════╣");
  Serial.print  ("║  Baseline  : "); Serial.println(baseline);
  Serial.print  ("║  WARNING > : "); Serial.println(GAS_WARNING_LEVEL);
  Serial.print  ("║  DANGER  > : "); Serial.println(GAS_DANGER_LEVEL);
  Serial.println("╚══════════════════════════════════╝\n");
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  dht.begin();

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("📡 GPS Serial started on UART2 (RX=16, TX=17)");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN,  OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  setLEDs(false, false, false);

  Serial.println("🔔 Buzzer self-test...");
  for (int i = 0; i < 3; i++) { buzzOn(); delay(150); buzzOff(); delay(150); }
  Serial.println("✅ Buzzer OK");

  Serial.print("📶 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n⚠️  WiFi Failed — running offline mode");
  }

  startupTime = millis();

  Serial.println("\n╔══════════════════════════════════╗");
  Serial.println("║   🛡️  Smart Safety System v2.3   ║");
  Serial.println("║  activeSession Firebase mode     ║");
  Serial.println("║  + NEO-6M GPS Tracking           ║");
  Serial.println("╚══════════════════════════════════╝");
  Serial.println("⏳ Phase 1: MQ135 warm-up (60s)...\n");
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  // Always read GPS in background (non-blocking)
  readGPS();

  // ── PHASE 1 — WARM-UP ──────────────────────────────────
  if (systemState == STATE_WARMUP) {
    long remaining = (long)(WARMUP_MS - (now - startupTime));
    digitalWrite(LED_GREEN, (now / 500) % 2 == 0 ? HIGH : LOW);

    static unsigned long lastWarmupPrint = 0;
    if (now - lastWarmupPrint >= 10000UL) {
      lastWarmupPrint = now;
      Serial.print("⏳ Warm-up: ");
      Serial.print(max(remaining / 1000L, 0L));
      Serial.println("s remaining...");
    }

    if (remaining <= 0) {
      setLEDs(false, false, false);
      systemState    = STATE_CALIBRATING;
      calibSum       = 0;
      calibCount     = 0;
      lastCalibSample = now;
      Serial.println("\n🔬 Phase 2: Calibrating baseline (30s)...");
    }
    return;
  }

  // ── PHASE 2 — CALIBRATION ──────────────────────────────
  if (systemState == STATE_CALIBRATING) {
    digitalWrite(LED_YELLOW, (now / 250) % 2 == 0 ? HIGH : LOW);

    if (now - lastCalibSample >= CALIBRATION_INTERVAL) {
      lastCalibSample = now;
      calibSum += analogRead(MQ135_PIN);
      calibCount++;
      if (calibCount % 10 == 0) {
        Serial.print("   📊 Progress: ");
        Serial.print((calibCount * 100) / CALIBRATION_SAMPLES);
        Serial.println("%");
      }
      if (calibCount >= CALIBRATION_SAMPLES) {
        applyThresholds((int)(calibSum / calibCount));
        lastRecalibTime = now;
        rollingIdx = 0; rollingFull = false;
        for (int i = 0; i < ROLLING_SIZE; i++) rollingBuf[i] = 0;
        setLEDs(false, false, true);
        systemState = STATE_MONITORING;
        Serial.println("✅ Phase 3: Monitoring started!\n");
      }
    }
    return;
  }

  // ── AUTO-RECALIBRATION TRIGGER ──────────────────────────
  if (systemState == STATE_MONITORING && safetyState == SAFE &&
      now - lastRecalibTime >= RECALIBRATE_EVERY) {
    systemState = STATE_RECALIBRATING;
    calibSum = 0; calibCount = 0; lastCalibSample = now;
    Serial.println("\n🔄 Auto-recalibrating in background (30s)...\n");
  }

  // ── RECALIBRATION SAMPLES ───────────────────────────────
  if (systemState == STATE_RECALIBRATING) {
    if (now - lastCalibSample >= CALIBRATION_INTERVAL) {
      lastCalibSample = now;
      calibSum += analogRead(MQ135_PIN);
      calibCount++;
      if (calibCount >= CALIBRATION_SAMPLES) {
        int   newBaseline = (int)(calibSum / calibCount);
        float drift       = abs(newBaseline - dynamicBaseline) / (float)dynamicBaseline;
        if (drift < 0.15f) { applyThresholds(newBaseline); Serial.println("✅ Auto-recalibration accepted.\n"); }
        else               { Serial.println("⚠️  Recalibration rejected — keeping old baseline.\n"); }
        lastRecalibTime = now;
        systemState     = STATE_MONITORING;
      }
    }
  }

  // ── PHASE 3 — READ & SEND SENSORS every 2s ─────────────
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;

    float temp   = dht.readTemperature();
    float hum    = dht.readHumidity();
    int   rawGas = analogRead(MQ135_PIN);

    if (isnan(temp) || isnan(hum)) {
      Serial.println("⚠️  DHT read failed — retrying...");
      return;
    }

    int gas  = rollingAverage(rawGas);
    int diff = gas - dynamicBaseline;   // ✅ now sent to Firebase as gasDiff

    SafetyState newSafety;
    if      (gas > GAS_DANGER_LEVEL || temp > TEMP_DANGER) newSafety = DANGER;
    else if (gas > GAS_WARNING_LEVEL)                       newSafety = WARNING;
    else                                                    newSafety = SAFE;

    bool stateChanged = (newSafety != safetyState);
    bool cooldownDone = (now - lastAlertPrint >= ALERT_COOLDOWN);

    if (stateChanged || cooldownDone) {
      safetyState    = newSafety;
      lastAlertPrint = now;

      String statusStr;
      switch (safetyState) {
        case DANGER:  statusStr = "DANGER";  break;
        case WARNING: statusStr = "WARNING"; break;
        default:      statusStr = "SAFE";    break;
      }

      Serial.println("─────────────────────────────────────");
      Serial.print("⏱  Uptime    : "); Serial.print(now / 1000); Serial.println("s");
      Serial.print("🌡  Temp      : "); Serial.print(temp, 1);    Serial.println(" °C");
      Serial.print("💧 Humid     : "); Serial.print(hum,  1);    Serial.println(" %");
      Serial.print("🧪 Gas Raw   : "); Serial.println(rawGas);
      Serial.print("📈 Gas Avg   : "); Serial.println(gas);
      Serial.print("📊 Gas Diff  : "); Serial.println(diff);
      Serial.print("📐 Baseline  : "); Serial.println(dynamicBaseline);

      if (gpsFixed) {
        Serial.print("📍 GPS       : ");
        Serial.print(gpsLat, 6); Serial.print(", "); Serial.println(gpsLng, 6);
        Serial.print("🚗 Speed     : "); Serial.print(gpsSpeedKph, 1); Serial.println(" km/h");
        Serial.print("🛰  Sats      : "); Serial.println(gpsSats);
      } else {
        Serial.println("📍 GPS       : Waiting for fix...");
        Serial.print  ("🛰  Chars rcvd: "); Serial.println(gps.charsProcessed());
      }

      switch (safetyState) {
        case DANGER:
          Serial.println("🚨 STATUS    : !! DANGER !!");
          setLEDs(true, false, false);
          buzzOn(); buzzerToggleTime = now;
          break;
        case WARNING:
          Serial.println("⚠️  STATUS    : WARNING");
          setLEDs(false, true, false);
          buzzOn(); buzzerToggleTime = now;
          break;
        case SAFE:
          Serial.println("✅ STATUS    : SAFE");
          setLEDs(false, false, true);
          silenceBuzzer();
          break;
      }

      // ✅ Send to Firebase — PUT to activeSession, includes gasDiff
      sendToFirebase(temp, hum, gas, rawGas, diff, statusStr);
    }
  }

  // ── BUZZER PATTERN ──────────────────────────────────────
  if      (safetyState == DANGER)  handleBuzzer(DANGER_BEEP_ON,  DANGER_BEEP_OFF);
  else if (safetyState == WARNING) handleBuzzer(WARNING_BEEP_ON, WARNING_BEEP_OFF);
}
