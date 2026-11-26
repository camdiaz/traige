import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { storage } from './storage';
import type { Config, PatientDB, ViewId, StaffMember } from '../types';
import { apiPatients } from '../api';

interface AppContextType {
  // Auth
  token: string | null;
  currentStaff: StaffMember | null;
  login: (token: string, staff: StaffMember) => void;
  logout: () => void;
  // Patients (from DB)
  patients: PatientDB[];
  currentPatientId: string;
  loadingPatients: boolean;
  refreshPatients: () => Promise<void>;
  setCurrentPatient: (id: string) => void;
  // Config
  config: Config;
  updateConfig: (cfg: Partial<Config>) => void;
  // Device state
  devOnline: boolean;
  aiEngine: string;
  setDevOnline: (v: boolean) => void;
  setAiEngine: (v: string) => void;
  // Nav & UI
  navigate: (view: ViewId) => void;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType>(null!);

export function useApp() {
  return useContext(AppContext);
}

interface Props {
  children: React.ReactNode;
  navigate: (view: ViewId) => void;
  showToast: (msg: string) => void;
}

export function AppProvider({ children, navigate, showToast }: Props) {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem('triaje.token'); } catch { return null; }
  });
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(() => {
    try {
      const s = localStorage.getItem('triaje.staff');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [patients, setPatients] = useState<PatientDB[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [currentPatientId, setCurrentPatientIdState] = useState<string>(
    () => { try { return localStorage.getItem('triaje.curP') ?? ''; } catch { return ''; } }
  );

  const [config, setConfig] = useState<Config>(storage.getConfig);
  const [devOnline, setDevOnline] = useState(false);
  const [aiEngine, setAiEngine] = useState(() => {
    const cfg = storage.getConfig();
    return cfg.eng === 'rules' ? 'Reglas' : cfg.url ? 'Gemini' : 'Reglas';
  });

  const login = useCallback((tok: string, staff: StaffMember) => {
    try {
      localStorage.setItem('triaje.token', tok);
      localStorage.setItem('triaje.staff', JSON.stringify(staff));
    } catch {}
    setToken(tok);
    setCurrentStaff(staff);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('triaje.token');
      localStorage.removeItem('triaje.staff');
      localStorage.removeItem('triaje.curP');
    } catch {}
    setToken(null);
    setCurrentStaff(null);
    setPatients([]);
    setCurrentPatientIdState('');
  }, []);

  const refreshPatients = useCallback(async () => {
    if (!token) return;
    setLoadingPatients(true);
    try {
      const list = await apiPatients(token);
      setPatients(list);
    } catch { /* sin conexión */ }
    finally { setLoadingPatients(false); }
  }, [token]);

  useEffect(() => {
    if (token) refreshPatients();
  }, [token, refreshPatients]);

  const setCurrentPatient = useCallback((id: string) => {
    setCurrentPatientIdState(id);
    try { localStorage.setItem('triaje.curP', id); } catch {}
  }, []);

  const updateConfig = useCallback((cfg: Partial<Config>) => {
    setConfig(prev => {
      const updated = { ...prev, ...cfg } as Config;
      storage.saveConfig(updated);
      return updated;
    });
  }, []);

  return (
    <AppContext.Provider value={{
      token, currentStaff, login, logout,
      patients, currentPatientId, loadingPatients, refreshPatients, setCurrentPatient,
      config, updateConfig,
      devOnline, aiEngine, setDevOnline, setAiEngine,
      navigate, showToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}
