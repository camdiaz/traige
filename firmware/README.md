# Firmware

Sketch para la **ESP32-CAM AI-Thinker** (OV2640 + PSRAM), programada con el adaptador ESP32-CAM-MB.

## Configuración

```bash
cd triaje_esp32cam
cp config.example.h config.h
```

Edita `config.h` con tu Wi-Fi, la URL del backend y el `DEVICE_TOKEN`.  
Los `config.h` están en `.gitignore`: solo se sube `config.example.h`, sin claves.

## Pines principales

| Función | Pin |
|---|---|
| I2C SDA (OLED, MAX30102, MPU6050) | 15 |
| I2C SCL | 14 |
| Joystick X/Y | ADS1115 por I2C (A0/A1) — el ADC2 no funciona con Wi-Fi |
| Pulsador del joystick | IO2 |
| LED de estado | IO12 (330 Ω a GND) |

## Arduino IDE

- Placa: **AI Thinker ESP32-CAM**
- Para subir: mantén IO0 a GND mientras enciendes, suelta después de flashear
