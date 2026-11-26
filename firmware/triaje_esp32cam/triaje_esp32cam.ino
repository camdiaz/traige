/*
 * Prototipo AIoT de Triaje Médico — firmware ESP32-CAM (AI-Thinker)
 * DevFest Cartagena 2026
 *
 * Placa en Arduino IDE: "AI Thinker ESP32-CAM" (core esp32 de Espressif 3.x)
 *   Programar con el adaptador ESP32-CAM-MB o un USB-serial (IO0 a GND para cargar).
 * Librerías (Gestor de librerías del Arduino IDE):
 *   - Adafruit ADS1X15 (joystick por I2C)
 *   - SparkFun MAX3010x Pulse and Proximity Sensor Library
 *   - Adafruit MPU6050 (+ Adafruit Unified Sensor, Adafruit BusIO)
 *   - U8g2
 *   - DFRobotDFPlayerMini (solo si USE_DFPLAYER = 1 en config.h)
 *   - ArduinoJson (v7)
 *   (esp_camera, WiFi, HTTPClient vienen con el core)
 *
 * Flujo: Menú (joystick) -> Medir signos -> Síntomas -> Evaluar (backend Gemini)
 *        -> resultado en OLED + LED de estado (+ voz si USE_DFPLAYER = 1).
 *        El backend guarda cada evaluación y el dashboard la muestra, la anuncia
 *        y la guarda en el historial. Telemetría continua cada 2 s.
 *
 * PROTOTIPO EDUCATIVO: no es un dispositivo médico.
 */
#include <Arduino.h>
#include "config.h"
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <U8g2lib.h>
#include <MAX30105.h>
#include <spo2_algorithm.h>
#include <Adafruit_MPU6050.h>
#if USE_DFPLAYER
#include <DFRobotDFPlayerMini.h>
#endif
#include <Adafruit_ADS1X15.h>
#include "esp_camera.h"

// ------------------------------------------------------------
U8G2_SH1107_128X128_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, PIN_I2C_SCL, PIN_I2C_SDA);
MAX30105 pox;
Adafruit_MPU6050 mpu;
#if USE_DFPLAYER
HardwareSerial dfSerial(1);
DFRobotDFPlayerMini df;
#endif
Adafruit_ADS1115 ads;

bool okOled = false, okPox = false, okMpu = false, okDf = false, okCam = false, okAds = false;

// Pistas en /mp3/0001.mp3 ... de la microSD (ver documentación)
enum Track { T_BIENVENIDA = 1, T_DEDO, T_MIDIENDO, T_SINTOMAS, T_ANALIZANDO,
             T_ROJO, T_AMARILLO, T_VERDE, T_CAIDA, T_ERROR_RED };

const char* SINTOMAS[] = {
  "Dolor toracico", "Dificultad respirar", "Confusion/desmayo", "Sangrado abundante",
  "Debilidad un lado", "Fiebre", "Dolor de cabeza", "Mareo", "Dolor abdominal",
  "Nauseas/vomito", "Tos", "Golpe/caida", "Palpitaciones"
};
// Mismos textos que usa el dashboard (con tildes) para enviar al backend
const char* SINTOMAS_API[] = {
  "Dolor torácico", "Dificultad para respirar", "Confusión / desmayo", "Sangrado abundante",
  "Debilidad de un lado del cuerpo", "Fiebre", "Dolor de cabeza intenso", "Mareo", "Dolor abdominal",
  "Náuseas / vómito", "Tos", "Golpe / caída", "Palpitaciones"
};
const int N_SINT = sizeof(SINTOMAS) / sizeof(SINTOMAS[0]);
bool sintSel[N_SINT] = {false};

// Estado clínico
int   vFc = -1, vSpo2 = -1;
float vAcel = 1.0f;
String vMov = "reposo";
String lastNivel = "";
uint32_t fallUntil = 0;

// UI
enum Screen { S_MENU, S_MEDIR, S_SINT, S_EVAL, S_RES, S_SENS };
Screen screen = S_MENU;
int menuIdx = 0, sintIdx = 0;
const char* MENU[] = { "1 Medir signos", "2 Sintomas", "3 Evaluar con IA", "4 Nueva sesion", "5 Sensores" };
const int N_MENU = 5;

// ------------------------------------------------------------ audio
void play(int track) {
#if USE_DFPLAYER
  if (okDf) df.playMp3Folder(track);   // /mp3/000N.mp3
#else
  (void)track;                          // versión sin audio
#endif
}

// LED de estado en IO12: fijo = rojo, 2 parpadeos = amarillo, 1 corto = verde
void ledNivel(const String& nivel) {
  if (nivel == "ROJO") { digitalWrite(PIN_LED, HIGH); return; }
  int n = nivel == "AMARILLO" ? 2 : 1;
  for (int i = 0; i < n; i++) { digitalWrite(PIN_LED, HIGH); delay(150); digitalWrite(PIN_LED, LOW); delay(150); }
}

// ------------------------------------------------------------ joystick
enum Joy { J_NONE, J_UP, J_DOWN, J_LEFT, J_RIGHT, J_PRESS };
Joy readJoy() {
  static uint32_t last = 0;
  static bool wasPressed = false;
  if (millis() - last < 180) return J_NONE;
  bool pressed = digitalRead(PIN_JOY_SW) == LOW;
  float x = 1.65f, y = 1.65f;                                   // centro ~1.65 V con joystick a 3V3
  if (okAds) {
    x = ads.computeVolts(ads.readADC_SingleEnded(ADS_CH_X));
    y = ads.computeVolts(ads.readADC_SingleEnded(ADS_CH_Y));
  }
  Joy j = J_NONE;
  if (pressed && !wasPressed) j = J_PRESS;
  else if (y < 0.6f) j = J_UP;
  else if (y > 2.7f) j = J_DOWN;
  else if (x < 0.6f) j = J_LEFT;
  else if (x > 2.7f) j = J_RIGHT;
  wasPressed = pressed;
  if (j != J_NONE) last = millis();
  return j;
}

// ------------------------------------------------------------ OLED
void header(const char* t) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_7x13B_tf);
  oled.drawStr(0, 12, t);
  oled.drawHLine(0, 15, 128);
  oled.setFont(u8g2_font_6x12_tf);
}
void drawMenu() {
  header("TRIAJE AIoT");
  for (int i = 0; i < N_MENU; i++) {
    int y = 34 + i * 18;
    if (i == menuIdx) { oled.drawBox(0, y - 11, 128, 15); oled.setDrawColor(0); }
    oled.drawStr(4, y, MENU[i]);
    oled.setDrawColor(1);
  }
  char b[40];
  snprintf(b, sizeof b, "FC:%s SpO2:%s", vFc > 0 ? String(vFc).c_str() : "--", vSpo2 > 0 ? String(vSpo2).c_str() : "--");
  oled.drawStr(0, 124, b);
  oled.drawStr(110, 12, WiFi.status() == WL_CONNECTED ? "W" : "x");
  oled.sendBuffer();
}
void drawSint() {
  header("SINTOMAS");
  int first = max(0, min(sintIdx - 3, N_SINT - 6));
  for (int i = 0; i < 6 && first + i < N_SINT + 1; i++) {
    int k = first + i, y = 30 + i * 15;
    String line = (k == N_SINT) ? String("> LISTO") : String(sintSel[k] ? "[x] " : "[ ] ") + SINTOMAS[k];
    if (k == sintIdx) { oled.drawBox(0, y - 11, 128, 14); oled.setDrawColor(0); }
    oled.drawStr(2, y, line.c_str());
    oled.setDrawColor(1);
  }
  oled.drawStr(0, 124, "Pulsa=marcar  <=salir");
  oled.sendBuffer();
}
void drawMsg(const char* t, const char* l1, const char* l2 = "") {
  header(t);
  oled.drawStr(0, 40, l1);
  oled.drawStr(0, 58, l2);
  oled.sendBuffer();
}
void drawResult(const String& nivel, const String& msg) {
  oled.clearBuffer();
  oled.setFont(u8g2_font_7x13B_tf);
  oled.drawStr(0, 12, "PRIORIDAD");
  if (nivel == "ROJO") oled.drawBox(0, 18, 128, 44);           // invertido = máxima alerta
  else oled.drawFrame(0, 18, 128, 44);
  oled.setDrawColor(nivel == "ROJO" ? 0 : 1);
  oled.setFont(u8g2_font_logisoso24_tf);
  int w = oled.getStrWidth(nivel.c_str());
  oled.drawStr((128 - w) / 2, 52, nivel.c_str());
  oled.setDrawColor(1);
  oled.setFont(u8g2_font_6x12_tf);
  // mensaje en 3 líneas de ~21 caracteres
  for (int i = 0; i < 3; i++) {
    String part = msg.substring(i * 21, min((int)msg.length(), (i + 1) * 21));
    oled.drawStr(0, 80 + i * 13, part.c_str());
  }
  oled.drawStr(0, 124, "Pulsa para volver");
  oled.sendBuffer();
}

void drawSensors() {
  sensors_event_t a, g, t;
  if (okMpu) mpu.getEvent(&a, &g, &t);

  oled.clearBuffer();
  oled.setFont(u8g2_font_7x13B_tf);
  oled.drawStr(0, 12, "SENSORES EN VIVO");
  oled.drawHLine(0, 15, 128);
  oled.setFont(u8g2_font_6x12_tf);

  char buf[32];

  // Pulsímetro MAX30102
  snprintf(buf, sizeof buf, "FC : %s lpm", vFc > 0 ? String(vFc).c_str() : "--");
  oled.drawStr(0, 30, buf);
  snprintf(buf, sizeof buf, "SpO2: %s %%", vSpo2 > 0 ? String(vSpo2).c_str() : "--");
  oled.drawStr(0, 44, buf);

  // Acelerómetro (m/s²)
  if (okMpu) {
    snprintf(buf, sizeof buf, "Ax:%.1f Ay:%.1f", a.acceleration.x, a.acceleration.y);
    oled.drawStr(0, 60, buf);
    snprintf(buf, sizeof buf, "Az:%.1f  [%s]", a.acceleration.z, vMov.c_str());
    oled.drawStr(0, 73, buf);
    // Giroscopio (rad/s)
    snprintf(buf, sizeof buf, "Gx:%.1f Gy:%.1f", g.gyro.x, g.gyro.y);
    oled.drawStr(0, 87, buf);
    snprintf(buf, sizeof buf, "Gz:%.1f", g.gyro.z);
    oled.drawStr(0, 100, buf);
  } else {
    oled.drawStr(0, 60, "MPU6050: no detectado");
  }

  oled.drawStr(0, 124, "<=volver");
  oled.sendBuffer();
}

// ------------------------------------------------------------ cámara
bool initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0; c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = CAM_Y2; c.pin_d1 = CAM_Y3; c.pin_d2 = CAM_Y4; c.pin_d3 = CAM_Y5;
  c.pin_d4 = CAM_Y6; c.pin_d5 = CAM_Y7; c.pin_d6 = CAM_Y8; c.pin_d7 = CAM_Y9;
  c.pin_xclk = CAM_XCLK; c.pin_pclk = CAM_PCLK; c.pin_vsync = CAM_VSYNC; c.pin_href = CAM_HREF;
  c.pin_sccb_sda = CAM_SIOD; c.pin_sccb_scl = CAM_SIOC;
  c.pin_pwdn = CAM_PWDN; c.pin_reset = CAM_RESET;
  c.sccb_i2c_port = 1;          // la cámara usa I2C 1; los sensores usan Wire (I2C 0)
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAMESIZE_VGA;
  c.jpeg_quality = 14;
  c.fb_count = psramFound() ? 2 : 1;
  c.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;
  return esp_camera_init(&c) == ESP_OK;
}

// ------------------------------------------------------------ HTTP
String api(const String& path) { return String(BACKEND_URL) + path; }

bool httpJson(const char* method, const String& path, const String& body, String* out = nullptr, int timeoutMs = 4000) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure cli; cli.setInsecure();      // PROTOTIPO: en producción valida el certificado
  HTTPClient h; h.setTimeout(timeoutMs);
  if (!h.begin(cli, api(path))) return false;
  h.addHeader("Content-Type", "application/json");
  h.addHeader("X-Device-Token", DEVICE_TOKEN);
  int code = (String(method) == "GET") ? h.GET() : h.POST(body);
  bool ok = code >= 200 && code < 300;
  if (ok && out) *out = h.getString();
  h.end();
  return ok;
}

void sendPhoto() {
  if (!okCam || WiFi.status() != WL_CONNECTED) return;
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;
  WiFiClientSecure cli; cli.setInsecure();
  HTTPClient h; h.setTimeout(6000);
  if (h.begin(cli, api("/api/camera?device=" DEVICE_ID))) {
    h.addHeader("Content-Type", "image/jpeg");
    h.addHeader("X-Device-Token", DEVICE_TOKEN);
    h.POST(fb->buf, fb->len);
    h.end();
  }
  esp_camera_fb_return(fb);
}

void sendTelemetry() {
  JsonDocument d;
  d["device"] = DEVICE_ID;
  if (vFc > 0) d["fc"] = vFc;
  if (vSpo2 > 0) d["spo2"] = vSpo2;
  d["acel"] = round(vAcel * 100) / 100.0;
  d["movimiento"] = vMov;
  JsonArray s = d["sintomas"].to<JsonArray>();
  for (int i = 0; i < N_SINT; i++) if (sintSel[i]) s.add(SINTOMAS_API[i]);
  String b; serializeJson(d, b);
  httpJson("POST", "/api/telemetry", b, nullptr, 2000);
}

void pollCommands() {
  String r;
  if (!httpJson("GET", "/api/device/commands?device=" DEVICE_ID, "", &r, 2000)) return;
  JsonDocument d;
  if (deserializeJson(d, r)) return;
  for (JsonObject c : d["comandos"].as<JsonArray>()) {
    String cmd = c["cmd"] | "";
    if (cmd == "play") play(c["track"] | 1);
    else if (cmd == "result") {
      lastNivel = String((const char*)(c["nivel"] | "VERDE"));
      drawResult(lastNivel, "Resultado desde el panel web");
      ledNivel(lastNivel);
      screen = S_RES;
    } else if (cmd == "photo") sendPhoto();
  }
}

// ------------------------------------------------------------ medición MAX30102
// Algoritmo de Maxim (incluido en la librería SparkFun): 100 muestras a 25 Hz = 4 s por ventana.
uint32_t irBuf[100], redBuf[100];

bool measureVitals() {
  if (!okPox) { drawMsg("ERROR", "MAX30102 no", "detectado"); delay(1500); return false; }
  play(T_DEDO);
  drawMsg("MEDICION", "Coloque el dedo", "sobre el sensor");
  uint32_t t0 = millis();
  while (pox.getIR() < FINGER_IR_MIN) {
    if (millis() - t0 > 15000) { drawMsg("MEDICION", "No se detecto", "el dedo"); delay(1500); return false; }
    if (readJoy() == J_LEFT) return false;
    delay(50);
  }
  play(T_MIDIENDO);
  int fcSum = 0, spSum = 0, nOk = 0;
  for (int win = 0; win < 4; win++) {                 // 4 ventanas ≈ 16 s
    char l2[24]; snprintf(l2, sizeof l2, "Ventana %d/4", win + 1);
    drawMsg("MIDIENDO", "No se mueva...", l2);
    for (int i = 0; i < 100; i++) {
      while (!pox.available()) pox.check();
      redBuf[i] = pox.getRed(); irBuf[i] = pox.getIR();
      pox.nextSample();
    }
    int32_t spo2, hr; int8_t vS, vH;
    maxim_heart_rate_and_oxygen_saturation(irBuf, 100, redBuf, &spo2, &vS, &hr, &vH);
    if (vS && vH && hr > 30 && hr < 220 && spo2 > 70 && spo2 <= 100) { fcSum += hr; spSum += spo2; nOk++; }
  }
  if (!nOk) { drawMsg("MEDICION", "Lectura inestable", "Intente de nuevo"); delay(1800); return false; }
  vFc = fcSum / nOk; vSpo2 = spSum / nOk;
  char l1[24], l2[24];
  snprintf(l1, sizeof l1, "FC: %d lpm", vFc);
  snprintf(l2, sizeof l2, "SpO2: %d %%", vSpo2);
  drawMsg("RESULTADO", l1, l2);
  sendTelemetry();
  delay(2500);
  return true;
}

// ------------------------------------------------------------ caída (MPU6050)
void updateMotion() {
  if (!okMpu) return;
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  float mag = sqrtf(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y +
                    a.acceleration.z * a.acceleration.z) / 9.80665f;
  vAcel = vAcel * 0.7f + mag * 0.3f;
  float gyro = fabsf(g.gyro.x) + fabsf(g.gyro.y) + fabsf(g.gyro.z);
  if (mag > FALL_G_THRESHOLD && millis() > fallUntil) {
    vMov = "caida"; fallUntil = millis() + 10000;
    play(T_CAIDA);
    sendTelemetry();
  } else if (millis() > fallUntil) {
    vMov = gyro > 1.5f ? "temblor" : "reposo";
  }
}

// ------------------------------------------------------------ reglas locales (respaldo sin red)
String localTriage() {
  int s = 0; bool hard = false;
  auto add = [&](int p) { s += p; if (p >= 3) hard = true; };
  if (vSpo2 > 0) { if (vSpo2 <= 91) add(3); else if (vSpo2 <= 93) add(2); else if (vSpo2 <= 95) add(1); }
  if (vFc > 0)   { if (vFc <= 40 || vFc >= 131) add(3); else if (vFc >= 111) add(2); else if (vFc <= 50 || vFc >= 91) add(1); }
  if (vMov == "caida") add(2);
  bool flag = false; for (int i = 0; i < 5; i++) if (sintSel[i]) flag = true;
  if (flag) add(2);
  if (hard || s >= 7 || (flag && s >= 4)) return "ROJO";
  if (s >= 3 || flag) return "AMARILLO";
  return "VERDE";
}

void evaluate() {
  play(T_ANALIZANDO);
  drawMsg("ANALIZANDO", "Consultando a", "Gemini...");
  sendPhoto();
  JsonDocument d;
  d["device"] = DEVICE_ID;
  JsonObject c = d["caso"].to<JsonObject>();
  JsonObject v = c["vitales"].to<JsonObject>();
  if (vFc > 0) v["fc"] = vFc; else v["fc"] = nullptr;
  if (vSpo2 > 0) v["spo2"] = vSpo2; else v["spo2"] = nullptr;
  c["movimiento"] = vMov;
  JsonArray s = c["sintomas"].to<JsonArray>();
  for (int i = 0; i < N_SINT; i++) if (sintSel[i]) s.add(SINTOMAS_API[i]);
  c["dolor"] = 0;
  c["origen"] = "ESP32";
  d["usarFotoDelDispositivo"] = true;
  String body; serializeJson(d, body);

  String resp, nivel, msg;
  if (httpJson("POST", "/api/triage", body, &resp, 20000)) {
    JsonDocument r;
    if (!deserializeJson(r, resp)) {
      nivel = String((const char*)(r["nivel"] | ""));
      msg = String((const char*)(r["mensaje_paciente"] | ""));
    }
  }
  if (nivel != "ROJO" && nivel != "AMARILLO" && nivel != "VERDE") {
    play(T_ERROR_RED);
    delay(2500);
    nivel = localTriage();
    msg = "Evaluacion local (sin conexion)";
  }
  lastNivel = nivel;
  drawResult(nivel, msg);
  play(nivel == "ROJO" ? T_ROJO : nivel == "AMARILLO" ? T_AMARILLO : T_VERDE);
  ledNivel(nivel);
  screen = S_RES;
}

// ------------------------------------------------------------ setup / loop
void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  pinMode(PIN_JOY_SW, INPUT_PULLUP);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);
  okOled = oled.begin();
  if (okOled) { oled.setContrast(200); drawMsg("TRIAJE AIoT", "Iniciando...", "DevFest 2026"); }

  okPox = pox.begin(Wire, I2C_SPEED_FAST);
  if (okPox) pox.setup(60, 4, 2, 100, 411, 4096);   // brillo, prom., modo rojo+IR, 100 sps, 411 us, 4096 nA
  okAds = ads.begin(ADS_ADDR, &Wire);
  if (okAds) ads.setGain(GAIN_ONE);              // ±4.096 V: cubre 0–3.3 V del joystick
  okMpu = mpu.begin(0x68, &Wire);
  if (okMpu) { mpu.setAccelerometerRange(MPU6050_RANGE_8_G); mpu.setFilterBandwidth(MPU6050_BAND_21_HZ); }

  // Enlace de una sola vía (sin RX): el DFPlayer recibe órdenes pero no responde.
#if USE_DFPLAYER
  dfSerial.begin(9600, SERIAL_8N1, -1, PIN_DF_TX);
  okDf = df.begin(dfSerial, false, false);
  if (okDf) df.volume(DF_VOLUME);
#else
  okDf = false;                     // sin audio: el LED de estado y la OLED dan la retroalimentación
#endif

  okCam = initCamera();
  Serial.printf("OLED:%d MAX30102:%d MPU6050:%d ADS1115:%d CAM:%d\n", okOled, okPox, okMpu, okAds, okCam);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(250);
  play(T_BIENVENIDA);
  drawMenu();
}

void loop() {
  static uint32_t tTel = 0, tCmd = 0, tMot = 0, tSens = 0;
  if (millis() - tMot > 50) { tMot = millis(); updateMotion(); }
  if (millis() - tTel > TELEMETRY_MS) { tTel = millis(); sendTelemetry(); }
  if (millis() - tCmd > COMMANDS_MS) { tCmd = millis(); pollCommands(); }
  if (screen == S_SENS && millis() - tSens > 500) { tSens = millis(); drawSensors(); }
  if (WiFi.status() != WL_CONNECTED && millis() % 10000 < 60) WiFi.reconnect();

  Joy j = readJoy();
  if (j == J_NONE) { delay(10); return; }

  switch (screen) {
    case S_MENU:
      if (j == J_UP)   menuIdx = (menuIdx + N_MENU - 1) % N_MENU;
      if (j == J_DOWN) menuIdx = (menuIdx + 1) % N_MENU;
      if (j == J_PRESS || j == J_RIGHT) {
        if (menuIdx == 0) { measureVitals(); }
        else if (menuIdx == 1) { play(T_SINTOMAS); sintIdx = 0; screen = S_SINT; drawSint(); return; }
        else if (menuIdx == 2) { evaluate(); return; }
        else if (menuIdx == 3) { vFc = vSpo2 = -1; vMov = "reposo"; for (int i = 0; i < N_SINT; i++) sintSel[i] = false; digitalWrite(PIN_LED, LOW); play(T_BIENVENIDA); }
        else if (menuIdx == 4) { screen = S_SENS; drawSensors(); return; }
      }
      drawMenu();
      break;
    case S_SENS:
      if (j == J_LEFT || j == J_PRESS) { screen = S_MENU; drawMenu(); return; }
      drawSensors();
      break;
    case S_SINT:
      if (j == J_UP)   sintIdx = max(0, sintIdx - 1);
      if (j == J_DOWN) sintIdx = min(N_SINT, sintIdx + 1);
      if (j == J_PRESS) {
        if (sintIdx == N_SINT) { screen = S_MENU; menuIdx = 2; drawMenu(); return; }
        sintSel[sintIdx] = !sintSel[sintIdx];
      }
      if (j == J_LEFT) { screen = S_MENU; drawMenu(); return; }
      drawSint();
      break;
    case S_RES:
      if (j == J_PRESS || j == J_LEFT) { screen = S_MENU; drawMenu(); }
      break;
    default: screen = S_MENU; drawMenu();
  }
}
