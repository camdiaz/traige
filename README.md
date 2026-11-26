# Prototipo AIoT de Triaje Médico — DevFest Cartagena 2026

Estructura:

```
esquematico/index.html        Esquema eléctrico + mapa de pines (abrir en navegador)
firmware/triaje_esp32s3/      Firmware Arduino para ESP32-S3-CAM (config.h + .ino)
backend/                      Servidor Node.js 20 sin dependencias para Cloud Run + Gemini
backend/public/index.html     Dashboard (el mismo del artifact) servido por el backend
dashboard/index.html          Copia del dashboard
audio/pistas_dfplayer.txt     Mensajes de voz para la microSD del DFPlayer
```

## Backend en Cloud Run (resumen)

```bash
gcloud config set project TU_PROYECTO
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
printf "TU_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
cd backend
gcloud run deploy triaje-backend --source . --region us-central1 \
  --allow-unauthenticated --max-instances=1 \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars=DEVICE_TOKEN=cambia-este-token,GEMINI_MODEL=gemini-3.6-flash
```

Verifica el nombre del modelo vigente en https://ai.google.dev/gemini-api/docs/models
y cambia GEMINI_MODEL si hace falta. Abre la URL de Cloud Run: verás el dashboard
con cámara y micrófono en vivo. En Ajustes pega la misma URL del backend.

## Prueba local

```bash
cd backend && DEVICE_TOKEN=t1 GEMINI_API_KEY=... node server.js   # http://localhost:8080
```

Prototipo educativo: no es un dispositivo médico.
# traige
