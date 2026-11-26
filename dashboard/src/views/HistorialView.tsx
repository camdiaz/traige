import { useEffect, useState } from 'react';
import { useApp } from '../store/context';
import { apiTriageReports } from '../api';
import type { PatientDB, TriageReportDB } from '../types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function LevelBadge({ nivel }: { nivel: string }) {
  const colors: Record<string, string> = {
    ROJO: '#c0392b', AMARILLO: '#d68910', VERDE: '#1a8a4a',
  };
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 6,
      background: colors[nivel] ?? '#888', color: '#fff', fontWeight: 700, fontSize: '0.78rem',
    }}>
      {nivel}
    </span>
  );
}

export function HistorialView() {
  const { patients, token, currentPatientId, setCurrentPatient, showToast } = useApp();
  const [selectedPid, setSelectedPid] = useState(currentPatientId);
  const [reports, setReports] = useState<TriageReportDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setSelectedPid(currentPatientId); }, [currentPatientId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiTriageReports(token, selectedPid || undefined, 100)
      .then(setReports)
      .catch(err => showToast(err.message ?? 'Error al cargar historial'))
      .finally(() => setLoading(false));
  }, [token, selectedPid]);

  const patient: PatientDB | undefined = patients.find(p => p.id === selectedPid);
  const sortedPatients = [...patients].sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));

  return (
    <section>
      <div className="card">
        <h2>
          Historial clínico
          <span className="sp">
            <select
              value={selectedPid}
              onChange={e => { setSelectedPid(e.target.value); setCurrentPatient(e.target.value); setExpanded(null); }}
              style={{ minWidth: 240 }}
            >
              <option value="">Todos los informes</option>
              {sortedPatients.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
              ))}
            </select>
          </span>
        </h2>

        {patient && (
          <div className="kv" style={{ marginBottom: '1rem' }}>
            <span><b>{patient.nombre} {patient.apellido}</b></span>
            {patient.fechaNacimiento && <span>Nac. {patient.fechaNacimiento}</span>}
            {patient.genero && <span>Género: {patient.genero}</span>}
            {patient.notas && <span>Notas: {patient.notas}</span>}
          </div>
        )}

        {loading && <p className="quiet small">Cargando informes…</p>}

        {!loading && reports.length === 0 && (
          <p className="quiet small">
            {selectedPid ? 'Este paciente no tiene informes registrados.' : 'No hay informes en la base de datos.'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map(r => (
            <div key={r.id} style={{
              border: '1px solid var(--border)', borderRadius: 10,
              overflow: 'hidden', background: 'var(--bg)',
            }}>
              {/* Header del informe */}
              <button
                type="button"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                  padding: '0.75rem 1rem', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <LevelBadge nivel={r.nivel} />
                <span style={{ fontWeight: 600, flex: 1 }}>
                  {r.patient ? `${r.patient.nombre} ${r.patient.apellido}` : 'Sin paciente asignado'}
                </span>
                <span className="quiet small">{fmtDate(r.createdAt)}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {r.origen} · {r.motor?.split('(')[0].trim()}
                </span>
                <span style={{ marginLeft: '0.25rem', color: 'var(--muted)' }}>
                  {expanded === r.id ? '▲' : '▼'}
                </span>
              </button>

              {/* Detalle expandido */}
              {expanded === r.id && (
                <div style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem 1rem', marginBottom: '1rem' }}>
                    {r.puntaje != null && <KV k="Puntaje" v={String(r.puntaje)} />}
                    {r.dolor != null && <KV k="Dolor" v={`${r.dolor}/10`} />}
                    {r.inicio && <KV k="Inicio" v={r.inicio} />}
                    {r.deviceId && <KV k="Dispositivo" v={r.deviceId} />}
                    {r.staff && <KV k="Personal" v={`${r.staff.nombre} ${r.staff.apellido}`} />}
                  </div>

                  {r.vitales && Object.keys(r.vitales).some(k => r.vitales![k] != null) && (
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={sectionTitle}>Signos vitales</p>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {r.vitales.fc != null && <VitalChip label="FC" value={`${r.vitales.fc} lpm`} />}
                        {r.vitales.spo2 != null && <VitalChip label="SpO₂" value={`${r.vitales.spo2}%`} />}
                        {r.vitales.temperatura != null && <VitalChip label="Temp" value={`${r.vitales.temperatura}°C`} />}
                        {r.vitales.fr != null && <VitalChip label="FR" value={`${r.vitales.fr} rpm`} />}
                        {r.vitales.movimiento && <VitalChip label="Movimiento" value={r.vitales.movimiento} />}
                      </div>
                    </div>
                  )}

                  {r.sintomas && r.sintomas.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={sectionTitle}>Síntomas</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {r.sintomas.map(s => <Tag key={s} label={s} />)}
                      </div>
                    </div>
                  )}

                  {r.motivos && r.motivos.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={sectionTitle}>Motivos de clasificación</p>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {r.motivos.map((m, i) => <li key={i} style={{ fontSize: '0.88rem' }}>{m}</li>)}
                      </ul>
                    </div>
                  )}

                  {r.recomendaciones && r.recomendaciones.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={sectionTitle}>Recomendaciones</p>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {r.recomendaciones.map((rec, i) => <li key={i} style={{ fontSize: '0.88rem' }}>{rec}</li>)}
                      </ul>
                    </div>
                  )}

                  {r.mensajePaciente && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <p style={sectionTitle}>Mensaje al paciente</p>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontStyle: 'italic' }}>"{r.mensajePaciente}"</p>
                    </div>
                  )}

                  {r.ajuste && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                      ⚠ {r.ajuste}
                    </p>
                  )}

                  {r.notasCaso && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                      <b>Notas del caso:</b> {r.notasCaso}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)',
};

function KV({ k, v }: { k: string; v: string }) {
  return <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--muted)' }}>{k}: </span><b>{v}</b></div>;
}

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '0.4rem 0.75rem', minWidth: 70,
    }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 20, padding: '0.1rem 0.6rem', fontSize: '0.78rem',
    }}>{label}</span>
  );
}
