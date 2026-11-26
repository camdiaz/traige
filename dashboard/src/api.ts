import type { PatientDB, StaffMember, TriageReportDB } from './types';

const LOCAL = window.location.origin;

function base(url?: string) {
  return (url ?? LOCAL).replace(/\/$/, '');
}

function authHeaders(token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── Health ───────────────────────────────────────────────────

export async function apiHealth(url: string) {
  const res = await fetch(`${base(url)}/api/health`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<{ token: string; staff: StaffMember }> {
  const res = await fetch(`${LOCAL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Error al iniciar sesión');
  return res.json();
}

export async function apiRegister(data: {
  nombre: string; apellido: string; email: string; password: string; rol?: string;
}): Promise<{ token: string; staff: StaffMember }> {
  const res = await fetch(`${LOCAL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Error al registrarse');
  return res.json();
}

// ── Staff ─────────────────────────────────────────────────────

export async function apiStaffList(token: string): Promise<StaffMember[]> {
  const res = await fetch(`${LOCAL}/api/staff`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Patients ─────────────────────────────────────────────────

export async function apiPatients(token: string): Promise<PatientDB[]> {
  const res = await fetch(`${LOCAL}/api/patients`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiCreatePatient(token: string, data: Omit<PatientDB, 'id' | 'createdAt' | 'creadoPor'>): Promise<PatientDB> {
  const res = await fetch(`${LOCAL}/api/patients`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Error al crear paciente');
  return res.json();
}

export async function apiUpdatePatient(token: string, id: string, data: Partial<PatientDB>): Promise<PatientDB> {
  const res = await fetch(`${LOCAL}/api/patients/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiDeletePatient(token: string, id: string): Promise<void> {
  const res = await fetch(`${LOCAL}/api/patients/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

// ── Triage ───────────────────────────────────────────────────

export async function apiTriage(url: string, dev: string, body: any, token?: string) {
  const res = await fetch(`${base(url)}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ device: dev, ...body }),
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);
  return res.json();
}

export async function apiTriageLatest(url: string, dev: string) {
  const res = await fetch(`${base(url)}/api/triage/latest?device=${encodeURIComponent(dev)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiTriageReports(token: string, patientId?: string, limit = 50): Promise<TriageReportDB[]> {
  const q = patientId ? `?patientId=${patientId}&limit=${limit}` : `?limit=${limit}`;
  const res = await fetch(`${LOCAL}/api/triage/reports${q}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Telemetry & Camera ───────────────────────────────────────

export async function apiTelemetry(url: string, dev: string) {
  const res = await fetch(`${base(url)}/api/telemetry/latest?device=${encodeURIComponent(dev)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiCameraLatest(url: string, dev: string): Promise<string> {
  const res = await fetch(`${base(url)}/api/camera/latest?device=${encodeURIComponent(dev)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('sin foto');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

export async function apiDeviceCommand(url: string, dev: string, cmd: any, token?: string) {
  await fetch(`${base(url)}/api/device/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ device: dev, ...cmd }),
  });
}
