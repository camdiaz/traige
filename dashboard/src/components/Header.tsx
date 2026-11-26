import { useApp } from '../store/context';

export function Header() {
  const { config, devOnline, aiEngine, currentStaff, logout } = useApp();
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
      <h1 style={{ margin: 0 }}>Estación de Triaje AIoT</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className="pills">
          <span className="pill">ESP32: <b>{devOnline ? 'En línea' : 'Demo'}</b></span>
          <span className="pill">IA: <b>{aiEngine}</b></span>
          {config.dev && <span className="pill">ID: <b>{config.dev}</b></span>}
        </div>
        {currentStaff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {currentStaff.nombre} {currentStaff.apellido}
              <span style={{ marginLeft: '0.3rem', opacity: 0.6 }}>({currentStaff.rol})</span>
            </span>
            <button
              onClick={logout}
              title="Cerrar sesión"
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 6, padding: '0.2rem 0.6rem',
                fontSize: '0.75rem', cursor: 'pointer', color: 'var(--muted)',
              }}
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
