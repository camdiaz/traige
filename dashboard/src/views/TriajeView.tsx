import { useCallback, useEffect, useRef, useState } from 'react';
import { VitalMonitor } from '../components/VitalMonitor';
import { useApp } from '../store/context';
import { useTelemetry } from '../hooks/useTelemetry';
import { applyRules } from '../utils/rules';
import { compressImage, blobToDataURL } from '../utils/format';
import { apiTriage, apiTriageLatest, apiCameraLatest, apiDeviceCommand } from '../api';
import type { TriageOutput, Vitals, MovimientoKey } from '../types';
import { SYMPTOMS } from '../types';

const RANK: Record<string, number> = { VERDE: 0, AMARILLO: 1, ROJO: 2 };
const PHR: Record<string, string> = {
  ROJO: 'Prioridad roja. Atención inmediata.',
  AMARILLO: 'Prioridad amarilla. Atención urgente, espere ser llamado pronto.',
  VERDE: 'Prioridad verde. No urgente, puede esperar su turno.',
};

interface LastEval { caso: any; result: TriageOutput; fecha: number; origen?: 'ESP32' | 'simulador'; saved?: boolean }

const LEVELS = ['ROJO', 'AMARILLO', 'VERDE'];

export function TriajeView() {
  const { patients, currentPatientId, token, config, setCurrentPatient,
          showToast, navigate, setDevOnline: ctxSetDevOnline, setAiEngine, updateConfig } = useApp();
  const autoSave = config.autoSave !== false;
  const { telemetry, devOnline, scenario, setScenario } = useTelemetry(config);

  // Push live device status up to the Header pill
  useEffect(() => { ctxSetDevOnline(devOnline); }, [devOnline]);

  // --- form state ---
  const [vitals, setVitals] = useState<Vitals>({});
  const [movimiento, setMovimiento] = useState<MovimientoKey>('reposo');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [pain, setPain] = useState(0);
  const [onset, setOnset] = useState('Menos de 1 hora');
  const [notes, setNotes] = useState('');

  // --- capture ---
  const [capturing, setCapturing] = useState(false);
  const [captureSeconds, setCaptureSeconds] = useState(10);
  const bufRef = useRef<typeof telemetry[]>([]);
  const [captureMsg, setCaptureMsg] = useState('FC, SpO₂ y movimiento llegan del sensor; temperatura, FR y PA se ingresan a mano.');

  // --- camera ---
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const filePhotoRef = useRef<HTMLInputElement>(null);

  // --- audio ---
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [recTime, setRecTime] = useState('');
  const [audioResult, setAudioResult] = useState<{ url: string; dur?: number } | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const fileAudRef = useRef<HTMLInputElement>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval>>();
  const actxRef = useRef<AudioContext | null>(null);

  // --- dictation ---
  const wsrRef = useRef<any>(null);
  const [dictOn, setDictOn] = useState(false);
  const [dictMsg, setDictMsg] = useState('');
  const [hasSpeech, setHasSpeech] = useState(false);

  // --- triage result ---
  const [lastEval, setLastEval] = useState<LastEval | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);

  const curPatient = patients.find(p => p.id === currentPatientId);

  // fall detection
  const fallWarnedRef = useRef(false);
  useEffect(() => {
    if (telemetry.mv === 'caida' && !fallWarnedRef.current) {
      fallWarnedRef.current = true;
      showToast('Posible caída detectada por el MPU6050');
    }
    if (telemetry.mv !== 'caida') fallWarnedRef.current = false;
  }, [telemetry.mv]);

  // buffer for capture
  const telRef = useRef(telemetry);
  telRef.current = telemetry;
  useEffect(() => {
    if (capturing) bufRef.current.push({ ...telemetry });
  }, [telemetry, capturing]);

  // speech recognition init
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) { setHasSpeech(true); }
  }, []);

  // Assign stream to video element as soon as both are ready
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup: stop camera stream and recording on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (rec) { try { rec.stop(); } catch {} }
      clearInterval(recTimerRef.current);
    };
  }, []);

  function getAudioCtx() {
    if (!actxRef.current) actxRef.current = new AudioContext();
    actxRef.current.resume();
    return actxRef.current;
  }

  function tone(ctx: AudioContext, freq: number, t0: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
    const o = ctx.createOscillator();
    const v = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    v.gain.setValueAtTime(0, t0);
    v.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    v.gain.setValueAtTime(gain, t0 + dur - 0.05);
    v.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(v).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur);
  }

  function playAlert(level: 'ROJO' | 'AMARILLO' | 'VERDE') {
    try {
      const ctx = getAudioCtx();
      const t = ctx.currentTime + 0.05;
      if (level === 'ROJO') {
        for (let i = 0; i < 4; i++) { tone(ctx, 960, t + i * 0.6, 0.3, 'square', 0.15); tone(ctx, 770, t + i * 0.6 + 0.3, 0.3, 'square', 0.15); }
      } else if (level === 'AMARILLO') {
        tone(ctx, 880, t, 0.18, 'triangle'); tone(ctx, 880, t + 0.3, 0.18, 'triangle'); tone(ctx, 660, t + 0.9, 0.25, 'triangle');
      } else {
        tone(ctx, 523, t, 0.2); tone(ctx, 659, t + 0.18, 0.2); tone(ctx, 784, t + 0.36, 0.4);
      }
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(PHR[level]);
        u.lang = 'es-ES';
        setTimeout(() => { speechSynthesis.cancel(); speechSynthesis.speak(u); }, level === 'ROJO' ? 2500 : 1200);
      }
    } catch { /* non-critical */ }
  }

  function startCapture() {
    if (capturing) return;
    setCapturing(true);
    bufRef.current = [];
    let s = 10;
    setCaptureSeconds(s);
    const iv = setInterval(() => {
      s--;
      setCaptureSeconds(s);
      if (s <= 0) {
        clearInterval(iv);
        setCapturing(false);
        const ok = bufRef.current.filter(x => x.hr != null);
        if (!ok.length) { showToast('Sin datos del sensor'); return; }
        const avg = (k: 'hr' | 'sp') => Math.round(ok.reduce((a, x) => a + (x[k] ?? 0), 0) / ok.length);
        setVitals(v => ({ ...v, fc: avg('hr'), spo2: avg('sp') }));
        setMovimiento(ok.some(x => x.mv === 'caida') ? 'caida' : ok.some(x => x.mv === 'temblor') ? 'temblor' : 'reposo');
        const src = telRef.current.src === 'dev' ? 'ESP32' : 'simulador';
        setCaptureMsg(`Lectura promedio de ${ok.length} muestras (${src}) a las ${new Date().toLocaleTimeString('es-CO')}.`);
        if (config.url && devOnline) apiDeviceCommand(config.url, config.dev, { cmd: 'play', track: 3 });
      }
    }, 1000);
  }

  // Camera
  async function activateCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no');
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 960 } }, audio: false });
      setStream(s); // useEffect assigns srcObject once the video element renders
    } catch {
      showToast('La cámara en vivo no está disponible; usa capturar foto');
      filePhotoRef.current?.click();
    }
  }

  async function snapPhoto() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    const url = await compressImage(canvas.toDataURL('image/jpeg', 0.9));
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setPhoto(url);
    showToast('Foto capturada');
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await blobToDataURL(f);
    setPhoto(await compressImage(url));
    e.target.value = '';
  }

  async function getEspCamPhoto() {
    try {
      const url = await apiCameraLatest(config.url, config.dev);
      setPhoto(await compressImage(url));
    } catch { showToast('El ESP32-CAM aún no ha enviado una foto'); }
  }

  // Audio
  async function startRecording() {
    if (rec) { rec.stop(); return; }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('no');
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      const opts = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 } : {};
      const mr = new MediaRecorder(st, opts);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      const ctx = getAudioCtx();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(st).connect(an);
      const arr = new Uint8Array(an.fftSize);
      const t0 = Date.now();
      recTimerRef.current = setInterval(() => {
        an.getByteTimeDomainData(arr);
        let m = 0;
        arr.forEach(v => m = Math.max(m, Math.abs(v - 128)));
        setAudioLevel(Math.min(100, m / 1.28));
        const s = Math.round((Date.now() - t0) / 1000);
        setRecTime(`Grabando ${s} s`);
        if (s >= 60) mr.stop();
      }, 100);
      mr.onstop = async () => {
        clearInterval(recTimerRef.current);
        setAudioLevel(0);
        st.getTracks().forEach(t => t.stop());
        const dur = Math.round((Date.now() - t0) / 1000);
        const url = await blobToDataURL(new Blob(chunks, { type: mr.mimeType }));
        setAudioResult({ url, dur });
        setRec(null);
        setRecTime('');
      };
      mr.start();
      setRec(mr);
    } catch {
      showToast('El micrófono no está disponible; sube un archivo de audio');
      fileAudRef.current?.click();
    }
  }

  async function handleAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 180000) showToast('Audio grande: se escuchará ahora, pero podría no caber en el historial');
    setAudioResult({ url: await blobToDataURL(f) });
    e.target.value = '';
  }

  function toggleDictation() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (!wsrRef.current) {
      const wsr = new SR();
      wsr.lang = 'es-CO'; wsr.continuous = true; wsr.interimResults = true;
      wsr.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) setNotes(n => n + (n ? ' ' : '') + r[0].transcript);
          else setDictMsg(r[0].transcript);
        }
      };
      wsr.onend = () => { setDictOn(false); setDictMsg(''); };
      wsrRef.current = wsr;
    }
    if (dictOn) { wsrRef.current.stop(); setDictOn(false); }
    else { wsrRef.current.start(); setDictOn(true); }
  }

  function caseData() {
    return {
      paciente: { notas: curPatient?.notas ?? null },
      patientId: curPatient?.id ?? null,
      vitales: vitals,
      movimiento,
      sintomas: SYMPTOMS.filter(s => selectedSymptoms.has(s.key)).map(s => s.label),
      dolor: pain,
      inicio: onset,
      notas: notes.trim(),
    };
  }

  async function evaluate() {
    const caso = caseData();
    const hasVitals = Object.values(caso.vitales).some(v => v != null);
    if (!hasVitals && caso.sintomas.length === 0) {
      showToast('Toma una lectura o marca síntomas primero');
      return;
    }
    setEvaluating(true);
    if (devOnline && config.url) apiDeviceCommand(config.url, config.dev, { cmd: 'play', track: 5 });
    const base = applyRules(caso);
    let result: TriageOutput;
    try {
      if (config.eng === 'rules' || !config.url) throw new Error('solo reglas');
      const r = await apiTriage(config.url, config.dev, { caso, foto: photo ?? null }, token ?? undefined);
      r.nivel = String(r.nivel).toUpperCase();
      result = r;
    } catch {
      result = { ...base, nota: config.url ? 'IA no disponible, se usó la evaluación local.' : undefined };
    }
    if (RANK[base.nivel] > RANK[result.nivel]) {
      result.ajuste = `Reglas locales indican ${base.nivel}; se conserva el nivel más alto.`;
      result.nivel = base.nivel;
    }
    result.reglas = { nivel: base.nivel, puntaje: base.puntaje! };
    setLastEval({ caso, result, fecha: Date.now() });
    setAiEngine(result.motor ?? 'Reglas locales');
    setEvaluating(false);
    playAlert(result.nivel as any);
    if (devOnline && config.url) apiDeviceCommand(config.url, config.dev, { cmd: 'result', nivel: result.nivel });
  }

  async function saveToHistory() {
    if (!lastEval || lastEval.saved) return;
    // The report was already persisted to DB by the backend when apiTriage was called.
    // This button just confirms to the user and resets the form.
    if (lastEval.result.reportId) {
      showToast('Informe ya guardado en la base de datos');
      setLastEval({ ...lastEval, saved: true });
      resetForm();
      return;
    }
    // If offline evaluation (no backend), nothing to persist here.
    showToast('Evaluación guardada (modo sin conexión)');
    setLastEval({ ...lastEval, saved: true });
    resetForm();
  }

  // --- evaluaciones hechas en el dispositivo (menú "3 Evaluar con IA") ---
  const lastTriTsRef = useRef(Date.now());
  const deviceEvalRef = useRef<(d: any) => Promise<void>>();
  deviceEvalRef.current = async (d: any) => {
    const c = d.caso ?? {};
    const v = c.vitales ?? {};
    const caso = {
      paciente: { notas: curPatient?.notas ?? null },
      patientId: curPatient?.id ?? null,
      vitales: { fc: v.fc ?? null, spo2: v.spo2 ?? null, temp: v.temp ?? null, fr: v.fr ?? null, pas: v.pas ?? null },
      movimiento: (c.movimiento ?? 'reposo') as MovimientoKey,
      sintomas: (c.sintomas ?? []) as string[],
      dolor: c.dolor ?? 0,
      inicio: c.inicio ?? '',
      notas: c.notas ?? '',
    };
    setVitals(caso.vitales);
    setMovimiento(caso.movimiento);
    setSelectedSymptoms(new Set(SYMPTOMS.filter(s => caso.sintomas.includes(s.label)).map(s => s.key)));
    setPain(caso.dolor);

    const { caso: _c, ts: _t, ...rest } = d;
    const rules = d.reglas ?? applyRules(caso);
    const result: TriageOutput = {
      ...rest,
      motor: `${d.motor ?? 'Gemini'} · desde el dispositivo`,
      reglas: { nivel: rules.nivel, puntaje: rules.puntaje },
    };
    const ev: LastEval = { caso, result, fecha: d.ts, origen: 'ESP32' };
    setLastEval(ev);
    setAiEngine(d.motor ?? 'Gemini');
    playAlert(result.nivel);

    let foto: string | null = null;
    try { foto = await compressImage(await apiCameraLatest(config.url, config.dev)); setPhoto(foto); } catch { /* sin foto */ }

    // Device evaluations are saved to DB by the backend automatically.
    if (autoSave && curPatient) {
      setLastEval({ ...ev, saved: true });
      showToast(`Evaluación del dispositivo (${result.nivel}) guardada para ${curPatient.nombre} ${curPatient.apellido}`);
    } else {
      showToast(`Nueva evaluación del dispositivo: ${result.nivel}${curPatient ? '' : ' · selecciona el paciente'}`);
    }
  };

  useEffect(() => {
    if (!config.url || !devOnline) return;
    let stopped = false;
    const poll = async () => {
      try {
        const d = await apiTriageLatest(config.url, config.dev);
        if (stopped || !d?.ts || d.ts <= lastTriTsRef.current) return;
        lastTriTsRef.current = d.ts;
        // Solo las evaluaciones lanzadas desde el dispositivo; las del dashboard ya se muestran aquí.
        if (d.caso?.origen !== 'ESP32' || !LEVELS.includes(d.nivel)) return;
        await deviceEvalRef.current?.(d);
      } catch { /* backend no disponible */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { stopped = true; clearInterval(id); };
  }, [config.url, config.dev, devOnline]);

  function resetForm() {
    setVitals({}); setMovimiento('reposo'); setSelectedSymptoms(new Set()); setPain(0);
    setOnset('Menos de 1 hora'); setNotes('');
    setPhoto(null); setAudioResult(null); setLastEval(null);
    fallWarnedRef.current = false;
    stream?.getTracks().forEach(t => t.stop()); setStream(null);
  }

  const toggleSymptom = (key: string) => {
    setSelectedSymptoms(s => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  return (
    <section>
      <div className="cols">
        {/* LEFT COLUMN */}
        <div>
          {/* Patient selector */}
          <div className="card">
            <h2>
              Paciente
              <span className="sp row">
                <button className="btn sm" type="button" onClick={() => navigate('pacientes')}>
                  Gestionar pacientes
                </button>
              </span>
            </h2>
            <select
              value={currentPatientId}
              onChange={e => setCurrentPatient(e.target.value)}
              aria-label="Paciente"
            >
              <option value="">Selecciona un paciente…</option>
              {[...patients].sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`))
                .map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                ))}
            </select>
            <p className="small quiet" style={{ margin: '8px 0 0' }}>
              {curPatient
                ? `${curPatient.genero || '—'} · Nac. ${curPatient.fechaNacimiento || '—'}${curPatient.notas ? ` · ${curPatient.notas}` : ''}`
                : 'Selecciona un paciente para vincular la evaluación.'}
            </p>
          </div>

          {/* Vital monitor */}
          <VitalMonitor telemetry={telemetry} devOnline={devOnline} scenario={scenario} onScenarioChange={setScenario} />

          {/* Vitals form */}
          <div className="card" style={{ marginTop: 20 }}>
            <h2>
              Signos vitales de la sesión
              <span className="sp">
                <button className="btn sm pri" type="button" onClick={startCapture} disabled={capturing}>
                  {capturing ? `Midiendo… ${captureSeconds} s` : 'Tomar lectura (10 s)'}
                </button>
              </span>
            </h2>
            <div className="fgrid">
              <label className="f">FC (lpm)<input type="number" min={20} max={250} value={vitals.fc ?? ''} onChange={e => setVitals(v => ({ ...v, fc: e.target.value ? +e.target.value : null }))} /></label>
              <label className="f">SpO₂ (%)<input type="number" min={50} max={100} value={vitals.spo2 ?? ''} onChange={e => setVitals(v => ({ ...v, spo2: e.target.value ? +e.target.value : null }))} /></label>
              <label className="f">Temperatura (°C)<input type="number" step={0.1} min={30} max={43} value={vitals.temp ?? ''} onChange={e => setVitals(v => ({ ...v, temp: e.target.value ? +e.target.value : null }))} /></label>
              <label className="f">FR (rpm)<input type="number" min={4} max={60} value={vitals.fr ?? ''} onChange={e => setVitals(v => ({ ...v, fr: e.target.value ? +e.target.value : null }))} /></label>
              <label className="f">PA sistólica<input type="number" min={50} max={260} value={vitals.pas ?? ''} onChange={e => setVitals(v => ({ ...v, pas: e.target.value ? +e.target.value : null }))} /></label>
              <label className="f">
                Movimiento
                <select value={movimiento} onChange={e => setMovimiento(e.target.value as MovimientoKey)}>
                  <option value="reposo">Reposo</option>
                  <option value="temblor">Temblor</option>
                  <option value="caida">Caída detectada</option>
                </select>
              </label>
            </div>
            <p className="small quiet" style={{ margin: '10px 0 0' }}>{captureMsg}</p>
          </div>

          {/* Symptoms */}
          <div className="card">
            <h2>Síntomas reportados</h2>
            <div className="chips">
              {SYMPTOMS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  className={`chip${s.flag ? ' flag' : ''}`}
                  aria-pressed={selectedSymptoms.has(s.key)}
                  onClick={() => toggleSymptom(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="fgrid" style={{ marginTop: 14 }}>
              <label className="f">
                Dolor (0–10): <span>{pain}</span>
                <input type="range" min={0} max={10} value={pain} onChange={e => setPain(+e.target.value)} />
              </label>
              <label className="f">
                Inicio de síntomas
                <select value={onset} onChange={e => setOnset(e.target.value)}>
                  <option>Menos de 1 hora</option>
                  <option>1 a 24 horas</option>
                  <option>1 a 7 días</option>
                  <option>Más de 7 días</option>
                </select>
              </label>
            </div>
            <label className="f" style={{ marginTop: 12 }}>
              Notas / relato del paciente
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Escribe o dicta lo que refiere el paciente"
              />
            </label>
            {hasSpeech && (
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm" type="button" onClick={toggleDictation}>
                  {dictOn ? '■ Detener dictado' : '🎙 Dictar notas'}
                </button>
                <span className="small quiet">{dictMsg}</span>
              </div>
            )}
          </div>

          {/* Camera + audio */}
          <div className="card">
            <h2>Cámara y voz</h2>
            <div className="media">
              {/* Camera */}
              <div>
                <div id="camBox">
                  {stream ? (
                    <video ref={videoRef} autoPlay playsInline muted />
                  ) : photo ? (
                    <img className="ph" src={photo} alt="Foto del paciente" />
                  ) : (
                    <div className="ph-empty">Sin imagen</div>
                  )}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn sm" type="button" onClick={activateCamera}>
                    {stream ? 'Apagar cámara' : 'Activar cámara'}
                  </button>
                  {stream && <button className="btn sm" type="button" onClick={snapPhoto}>Capturar foto</button>}
                  <button className="btn sm" type="button" onClick={() => filePhotoRef.current?.click()}>
                    Tomar / subir foto
                  </button>
                  {devOnline && (
                    <button className="btn sm" type="button" onClick={getEspCamPhoto}>Foto ESP32-CAM</button>
                  )}
                </div>
                <input ref={filePhotoRef} type="file" accept="image/*" capture="environment" className="hide" onChange={handlePhotoFile} />
              </div>
              {/* Audio */}
              <div>
                <div className="row">
                  <button className="btn sm" type="button" onClick={startRecording}>
                    {rec ? '■ Detener' : '● Grabar voz'}
                  </button>
                  <button className="btn sm" type="button" onClick={() => fileAudRef.current?.click()}>
                    Grabar / subir audio
                  </button>
                  <span className="small quiet">{recTime}</span>
                </div>
                <div className="meter" style={{ marginTop: 12 }}>
                  <i style={{ width: `${audioLevel}%` }} />
                </div>
                {audioResult ? (
                  <div>
                    <audio controls src={audioResult.url} style={{ width: '100%', marginTop: 8 }} />
                    <p className="small quiet">Nota de voz lista{audioResult.dur ? ` · ${audioResult.dur} s` : ''}.</p>
                  </div>
                ) : (
                  <p className="small quiet">Graba la descripción de los síntomas (máx. 60 s). El audio queda en el historial.</p>
                )}
                <input ref={fileAudRef} type="file" accept="audio/*" capture className="hide" onChange={handleAudioFile} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 76 }}>
            <h2>Clasificación de triaje</h2>
            {lastEval ? (
              <TriageResultCard result={lastEval.result} />
            ) : (
              <div className="empty-tag">Completa signos y síntomas y pulsa <b>Evaluar</b>.</div>
            )}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn pri" type="button" onClick={evaluate} disabled={evaluating}>
                {evaluating ? 'Analizando…' : 'Evaluar con IA'}
              </button>
              <button className="btn" type="button" onClick={saveToHistory} disabled={!lastEval || lastEval.saved || saving}>
                {saving ? 'Guardando…' : lastEval?.saved ? 'Guardada ✓' : 'Guardar en historial'}
              </button>
            </div>
            <label className="row small quiet" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={autoSave} onChange={e => updateConfig({ autoSave: e.target.checked })} />
              Guardar en el historial las evaluaciones del dispositivo
            </label>

            <h2 style={{ marginTop: 22 }}>Alertas sonoras</h2>
            <div className="row">
              {(['ROJO', 'AMARILLO', 'VERDE'] as const).map(lv => (
                <button
                  key={lv}
                  type="button"
                  className={`btn sm ${lv === 'ROJO' ? 'r' : lv === 'AMARILLO' ? 'y' : 'g'}`}
                  onClick={() => playAlert(lv)}
                >
                  Alerta {lv.toLowerCase()}
                </button>
              ))}
            </div>

            <p className="disc">
              Prototipo educativo para demostración. No es un dispositivo médico ni reemplaza la valoración de personal de salud.
              Ante una emergencia real, llama al 123 (Colombia).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TriageResultCard({ result }: { result: TriageOutput }) {
  return (
    <>
      <div className={`tag ${result.nivel}`}>
        <span className="hole" />
        <span className="small" style={{ fontWeight: 600, opacity: 0.9 }}>Prioridad</span>
        <span className="lv">{result.nivel}</span>
        <span className="small">Puntaje {result.puntaje ?? '—'} · {result.motor}</span>
      </div>
      {result.mensaje_paciente && (
        <p style={{ margin: '12px 0 0' }}><b>Mensaje al paciente:</b> {result.mensaje_paciente}</p>
      )}
      <p style={{ margin: '12px 0 0' }}><b>Motivos</b></p>
      <ul className="clean">
        {(result.motivos ?? []).map((m, i) => <li key={i}>{m}</li>)}
      </ul>
      <p style={{ margin: '12px 0 0' }}><b>Recomendaciones</b></p>
      <ul className="clean">
        {(result.recomendaciones ?? []).map((m, i) => <li key={i}>{m}</li>)}
      </ul>
      {result.posibles_causas?.length ? (
        <>
          <p style={{ margin: '12px 0 0' }}><b>Posibles causas a descartar</b></p>
          <ul className="clean">
            {result.posibles_causas.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </>
      ) : null}
      {result.ajuste && <p className="small" style={{ margin: '12px 0 0' }}>⚠ {result.ajuste}</p>}
      {result.nota && <p className="small quiet">{result.nota}</p>}
      {result.reglas && result.motor !== 'Reglas locales' && (
        <p className="small quiet" style={{ marginTop: 10 }}>
          Segunda opinión (reglas locales): {result.reglas.nivel}, puntaje {result.reglas.puntaje}.
        </p>
      )}
    </>
  );
}
