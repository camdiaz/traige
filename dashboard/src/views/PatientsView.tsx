import { useState } from 'react';
import { useApp } from '../store/context';
import { apiCreatePatient, apiUpdatePatient, apiDeletePatient } from '../api';
import type { PatientDB, ViewId } from '../types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

type FormData = Omit<PatientDB, 'id' | 'createdAt' | 'creadoPor'>;
const EMPTY: FormData = { nombre: '', apellido: '', fechaNacimiento: '', genero: '', notas: '' };

export function PatientsView() {
  const { patients, token, refreshPatients, setCurrentPatient, navigate, showToast, loadingPatients } = useApp();
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPatient, setEditPatient] = useState<PatientDB | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  const filtered = patients.filter(p =>
    `${p.nombre} ${p.apellido}`.toLowerCase().includes(query.toLowerCase())
  );

  function openCreate() {
    setEditPatient(null);
    setForm(EMPTY);
    setShowModal(true);
  }

  function openEdit(p: PatientDB) {
    setEditPatient(p);
    setForm({ nombre: p.nombre, apellido: p.apellido, fechaNacimiento: p.fechaNacimiento ?? '', genero: p.genero ?? '', notas: p.notas ?? '' });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      if (editPatient) {
        await apiUpdatePatient(token, editPatient.id, form);
      } else {
        await apiCreatePatient(token, form);
      }
      await refreshPatients();
      setShowModal(false);
      showToast(editPatient ? 'Paciente actualizado' : 'Paciente creado');
    } catch (err: any) {
      showToast(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: PatientDB) {
    if (!token) return;
    if (!confirm(`¿Eliminar a ${p.nombre} ${p.apellido}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiDeletePatient(token, p.id);
      await refreshPatients();
      showToast('Paciente eliminado');
    } catch (err: any) {
      showToast(err.message ?? 'Error al eliminar');
    }
  }

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <section>
      {showModal && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 1rem' }}>{editPatient ? 'Editar paciente' : 'Nuevo paciente'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MField label="Nombre" value={form.nombre} onChange={set('nombre')} required />
                <MField label="Apellido" value={form.apellido} onChange={set('apellido')} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MField label="Fecha de nacimiento" type="date" value={form.fechaNacimiento ?? ''} onChange={set('fechaNacimiento')} />
                <div>
                  <label style={mLabel}>Género</label>
                  <select value={form.genero ?? ''} onChange={set('genero')} style={mInput}>
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={mLabel}>Notas / antecedentes</label>
                <textarea value={form.notas ?? ''} onChange={set('notas')} rows={3}
                  style={{ ...mInput, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn sm">Cancelar</button>
                <button type="submit" disabled={saving} className="btn sm pri">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <h2>
          Pacientes registrados
          <span className="sp row">
            <input
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre"
              style={{ width: 240 }}
            />
            <button className="btn sm pri" type="button" onClick={openCreate}>+ Nuevo</button>
          </span>
        </h2>

        {loadingPatients && <p className="quiet small">Cargando pacientes…</p>}

        <div className="scroll">
          <table className="stack">
            <thead>
              <tr>
                <th>Nombre</th><th>Fecha nac.</th><th>Género</th><th>Registrado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td data-l="Nombre"><b>{p.nombre} {p.apellido}</b></td>
                  <td data-l="Fecha nac.">{p.fechaNacimiento ? fmtDate(p.fechaNacimiento) : '—'}</td>
                  <td data-l="Género">{p.genero ?? '—'}</td>
                  <td data-l="Registrado" className="small quiet">{fmtDate(p.createdAt)}</td>
                  <td>
                    <div className="row">
                      <button className="btn sm" type="button"
                        onClick={() => { setCurrentPatient(p.id); navigate('historial' as ViewId); }}>
                        Historial
                      </button>
                      <button className="btn sm" type="button"
                        onClick={() => { setCurrentPatient(p.id); navigate('triaje' as ViewId); }}>
                        Triar
                      </button>
                      <button className="btn sm" type="button" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn sm" type="button" onClick={() => handleDelete(p)}
                        style={{ color: 'var(--rojo)' }}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loadingPatients && filtered.length === 0 && (
          <p className="quiet small">
            {query ? 'Sin resultados.' : 'Aún no hay pacientes. Crea el primero con "+ Nuevo".'}
          </p>
        )}
      </div>
    </section>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
};
const modalStyle: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 12, padding: '1.5rem',
  width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,.3)',
};
const mLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'var(--muted)', marginBottom: '0.2rem', textTransform: 'uppercase',
};
const mInput: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.65rem', border: '1px solid var(--border)',
  borderRadius: 7, background: 'var(--bg)', color: 'var(--text)',
  fontSize: '0.88rem', boxSizing: 'border-box',
};

function MField({ label, type = 'text', value, onChange, required }: {
  label: string; type?: string; value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>; required?: boolean;
}) {
  return (
    <div>
      <label style={mLabel}>{label}</label>
      <input type={type} value={value} onChange={onChange} required={required} style={mInput} />
    </div>
  );
}
