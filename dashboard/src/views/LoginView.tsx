import React, { useState } from 'react';
import { apiLogin, apiRegister } from '../api';
import { useApp } from '../store/context';

type Mode = 'login' | 'register';

export function LoginView() {
  const { login, showToast } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: '', rol: 'enfermero',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await apiLogin(form.email, form.password)
        : await apiRegister({ nombre: form.nombre, apellido: form.apellido, email: form.email, password: form.password, rol: form.rol });
      login(res.token, res.staff);
    } catch (err: any) {
      showToast(err.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--card)',
        borderRadius: 12, padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,.18)',
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 48 }}>🏥</div>
          <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>
            Triaje AIoT
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
            DevFest Cartagena 2026
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderRadius: 8, background: 'var(--bg)', padding: 3, marginBottom: '1.25rem' }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '0.4rem', border: 'none', cursor: 'pointer',
              borderRadius: 6, fontWeight: 600, fontSize: '0.85rem',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--muted)',
              transition: 'all .15s',
            }}>
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mode === 'register' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="Nombre" value={form.nombre} onChange={set('nombre')} required />
                <Field label="Apellido" value={form.apellido} onChange={set('apellido')} required />
              </div>
              <div>
                <label style={labelStyle}>Rol</label>
                <select value={form.rol} onChange={set('rol')} style={inputStyle} required>
                  <option value="enfermero">Enfermero/a</option>
                  <option value="medico">Médico/a</option>
                  <option value="admin">Administrador/a</option>
                </select>
              </div>
            </>
          )}
          <Field label="Correo electrónico" type="email" value={form.email} onChange={set('email')} required />
          <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} required />

          <button type="submit" disabled={loading} style={{
            marginTop: '0.5rem', padding: '0.65rem', border: 'none', borderRadius: 8,
            background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'var(--muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border)',
  borderRadius: 7, background: 'var(--bg)', color: 'var(--text)',
  fontSize: '0.9rem', boxSizing: 'border-box',
};

function Field({ label, type = 'text', value, onChange, required }: {
  label: string; type?: string; value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>; required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={onChange} required={required} style={inputStyle} />
    </div>
  );
}
