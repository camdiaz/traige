import { useCallback, useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './store/context';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Toast } from './components/Toast';
import { LoginView } from './views/LoginView';
import { TriajeView } from './views/TriajeView';
import { PatientsView } from './views/PatientsView';
import { HistorialView } from './views/HistorialView';
import { SettingsView } from './views/SettingsView';
import type { ViewId } from './types';

function parseHash(hash: string): ViewId {
  const v = hash.slice(1) as ViewId;
  return ['triaje', 'pacientes', 'historial', 'ajustes'].includes(v) ? v : 'triaje';
}

function AppShell({ view, navigate }: { view: ViewId; navigate: (v: ViewId) => void }) {
  const { token } = useApp();

  if (!token) return <LoginView />;

  return (
    <>
      <Header />
      <Navigation view={view} navigate={navigate} />
      <main>
        {view === 'triaje'    && <TriajeView />}
        {view === 'pacientes' && <PatientsView />}
        {view === 'historial' && <HistorialView />}
        {view === 'ajustes'   && <SettingsView />}
      </main>
    </>
  );
}

export function App() {
  const [view, setView] = useState<ViewId>(() => parseHash(window.location.hash));
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const navigate = useCallback((v: ViewId) => {
    window.location.hash = v;
    setView(v);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastOn(false), 3200);
  }, []);

  useEffect(() => {
    const handler = () => setView(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <AppProvider navigate={navigate} showToast={showToast}>
      <AppShell view={view} navigate={navigate} />
      <Toast message={toastMsg} visible={toastOn} />
    </AppProvider>
  );
}
