# Prototipo AIoT de Triaje Médico — DevFest Cartagena 2026

Estructura:

```
firmware/triaje_esp32cam/     Firmware principal: ESP32-CAM AI-Thinker (config.example.h + .ino)
firmware/triaje_esp32s3/      Firmware alternativo: ESP32-S3 WROOM CAM (ver firmware/README.md)
backend/                      Backend NestJS (TypeScript) + Gemini; en producción sirve el dashboard
dashboard/                    Dashboard Vite + React 18 + TypeScript
esquematico/index.html        Esquema eléctrico Rev. B + mapa de pines (abrir en navegador)
audio/pistas_dfplayer.txt     Mensajes de voz para la microSD del DFPlayer (opcional)
Dockerfile                    Imagen única: build de React + build de NestJS
```

API (todo bajo `/api`): `GET /health` · `POST /telemetry` · `GET /telemetry/latest` ·
`POST /camera` · `GET /camera/latest` · `POST /device/command` · `GET /device/commands` ·
`POST /triage` · `GET /triage/latest`.

## Flujo de la demo

1. En el dispositivo, el paciente mide sus signos, marca síntomas con el joystick y elige "3 Evaluar con IA".
2. La ESP32-CAM toma una foto y envía el caso al backend; Gemini clasifica (las reglas locales son el piso de seguridad).
3. El dispositivo muestra el resultado en la OLED y en el LED.
4. El dashboard detecta la evaluación en ~2 s: muestra la prioridad, hace sonar la alerta con voz,
   llena signos y síntomas, carga la foto y la guarda en el historial del paciente seleccionado
   (se puede apagar en Ajustes).

Al abrir el dashboard, haz clic una vez en cualquier botón de alerta: el navegador no reproduce
sonido hasta que la página recibe un clic.

## Desarrollo local

```bash
cd backend && cp .env.example .env   # pon tu GEMINI_API_KEY y DEVICE_TOKEN
npm install && npm run start:dev     # http://localhost:3000/api
```

```bash
cd dashboard && npm install && npm run dev   # http://localhost:5173
```

En Ajustes del dashboard pega la URL del backend y el mismo `DEVICE_ID` del firmware.

## Cloud Run

Se despliega desde la raíz del repo (usa el `Dockerfile` de la raíz):

```bash
gcloud config set project TU_PROYECTO
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
printf "TU_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
gcloud run deploy triaje-backend --source . --region us-central1 \
  --allow-unauthenticated --max-instances=1 \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars=DEVICE_TOKEN=cambia-este-token,GEMINI_MODEL=gemini-2.0-flash
```

Verifica el nombre del modelo vigente en https://ai.google.dev/gemini-api/docs/models.
El estado vive en memoria, por eso `--max-instances=1`. El historial de pacientes se guarda
en el navegador: usa el mismo equipo durante la demo.

## Firmware

- Comparación de placas y pines en [firmware/README.md](firmware/README.md).
- Copia `firmware/triaje_esp32cam/config.example.h` a `config.h` y pon tu Wi-Fi, la URL del backend y el token.
  `config.h` está en `.gitignore` para que tus claves no se suban al repositorio.
- Placa "AI Thinker ESP32-CAM"; programar con el adaptador ESP32-CAM-MB.
- `USE_DFPLAYER 0` = versión sin audio (el sonido lo da el dashboard). Con `1` se usa el DFPlayer en IO13.

Prototipo educativo: no es un dispositivo médico.
