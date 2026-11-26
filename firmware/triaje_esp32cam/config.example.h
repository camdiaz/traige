// ============================================================
//  Configuración del prototipo AIoT de Triaje — DevFest Cartagena 2026
//  Placa: ESP32-CAM AI-Thinker (módulo ESP-32S + OV2640 + PSRAM)
//  Cambia los valores y NO subas este archivo a un repo público.
// ============================================================
#pragma once

// ---- Wi-Fi ----
#define WIFI_SSID      "TU_RED_WIFI"
#define WIFI_PASS      "TU_CLAVE_WIFI"

// ---- Backend (Cloud Run) ----
#define BACKEND_URL    "https://triaje-backend-xxxxxxxx.a.run.app"   // sin "/" final
#define DEVICE_ID      "esp32-triaje-01"
#define DEVICE_TOKEN   "cambia-este-token"   // debe coincidir con DEVICE_TOKEN del backend

// ---- Pines expuestos de la ESP32-CAM (fila del 5V) ----
#define PIN_I2C_SDA    15    // bus I2C: OLED, MAX30102, MPU6050, ADS1115
#define PIN_I2C_SCL    14
#define USE_DFPLAYER   0     // 0 = versión sin audio (sin DFPlayer ni parlante); 1 = con DFPlayer en IO13
#define PIN_DF_TX      13    // ESP TX -> R1 1k -> DFPlayer RX (enlace de una sola vía)
#define PIN_LED        12    // LED de estado -> 330 ohm -> GND (mantiene IO12 en bajo al arrancar)
#define PIN_JOY_SW     2     // pulsador del joystick, INPUT_PULLUP, activo en bajo
// IO4 = LED flash de la placa · IO0 = reloj de cámara · IO16 = PSRAM · U0R/U0T = programación

// ---- ADS1115 (joystick analógico; el ADC2 del ESP32 no funciona con Wi-Fi) ----
#define ADS_ADDR       0x48  // ADDR a GND
#define ADS_CH_X       0     // VRx -> A0
#define ADS_CH_Y       1     // VRy -> A1

// ---- Cámara OV2640 (ESP32-CAM AI-Thinker) ----
#define CAM_PWDN   32
#define CAM_RESET  -1
#define CAM_XCLK    0
#define CAM_SIOD   26
#define CAM_SIOC   27
#define CAM_Y9     35
#define CAM_Y8     34
#define CAM_Y7     39
#define CAM_Y6     36
#define CAM_Y5     21
#define CAM_Y4     19
#define CAM_Y3     18
#define CAM_Y2      5
#define CAM_VSYNC  25
#define CAM_HREF   23
#define CAM_PCLK   22

// ---- Ajustes ----
#define DF_VOLUME          24      // 0..30
#define TELEMETRY_MS       2000    // cada envío HTTPS tarda ~0.3–0.8 s en el ESP32
#define COMMANDS_MS        2500
#define FALL_G_THRESHOLD   2.5f    // pico de aceleración para sospechar caída
#define FINGER_IR_MIN      50000   // IR mínimo para detectar el dedo en el MAX30102
