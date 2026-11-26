import { useState } from 'react';
import { apiHealth } from '../api';
import { useApp } from '../store/context';
import type { Config } from '../types';

export function SettingsView() {
  const { config, updateConfig, showToast, currentStaff } = useApp();
  const [url, setUrl] = useState(config.url);
  const [dev, setDev] = useState(config.dev);
  const [eng, setEng] = useState<Config['eng']>(config.eng);
  const [cfgMsg, setCfgMsg] = useState('');

  async function saveConfig() {
    updateConfig({ url: url.trim(), dev: dev.trim() || 'esp32-triaje-01', eng });
    if (!url.trim()) { setCfgMsg('Guardado. Sin backend: se usan reglas locales.'); return; }
    setCfgMsg('Probando…');
    try {
      const r = await apiHealth(url.trim());
      setCfgMsg(`Backend en línea ✓ · modelo ${r.model}`);
    } catch (err: any) {
      setCfgMsg('No se pudo conectar: ' + err.message);
    }
  }

  return (
    <section>
      <div className="cols">
        <div className="card">
          <h2>Conexión con el backend (NestJS + Gemini)</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label className="f">
              URL del backend
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:3000" />
            </label>
            <label className="f">
              ID del dispositivo
              <input type="text" value={dev} onChange={e => setDev(e.target.value)} />
            </label>
            <label className="f">
              Motor de evaluación
              <select value={eng} onChange={e => setEng(e.target.value as Config['eng'])}>
                <option value="auto">Automático (Gemini → reglas)</option>
                <option value="gemini">Solo Gemini (backend)</option>
                <option value="rules">Solo reglas locales</option>
              </select>
            </label>
            <div className="row">
              <button className="btn pri" type="button" onClick={saveConfig}>Guardar y probar</button>
              <span className="small quiet">{cfgMsg}</span>
            </div>
          </div>
          <p className="small quiet" style={{ marginTop: 14 }}>
            En desarrollo: React corre en <code>:5173</code> y el backend en <code>:3000</code>.
            En producción el backend sirve el build de React como estáticos.
          </p>
        </div>

        {currentStaff && (
          <div className="card">
            <h2>Mi cuenta</h2>
            <div className="kv">
              <span><b>{currentStaff.nombre} {currentStaff.apellido}</b></span>
              <span>{currentStaff.email}</span>
              <span>Rol: <b>{currentStaff.rol}</b></span>
              <span className="small quiet">ID: {currentStaff.id}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
