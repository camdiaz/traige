export type ViewId = 'triaje' | 'pacientes' | 'historial' | 'ajustes';
export type TriageLevel = 'ROJO' | 'AMARILLO' | 'VERDE';
export type EngineMode = 'auto' | 'gemini' | 'rules';
export type MovimientoKey = 'reposo' | 'temblor' | 'caida';

// ── DB models (from API) ─────────────────────────────────────

export interface StaffMember {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: 'enfermero' | 'medico' | 'admin';
  activo: boolean;
  createdAt: string;
}

export interface PatientDB {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento?: string;
  genero?: string;
  notas?: string;
  creadoPor?: Pick<StaffMember, 'id' | 'nombre' | 'apellido'>;
  createdAt: string;
}

export interface TriageReportDB {
  id: string;
  origen: string;
  nivel: TriageLevel;
  puntaje?: number;
  motor?: string;
  vitales?: Record<string, any>;
  sintomas?: string[];
  dolor?: number;
  inicio?: string;
  notasCaso?: string;
  motivos?: string[];
  recomendaciones?: string[];
  mensajePaciente?: string;
  ajuste?: string;
  deviceId?: string;
  patient?: Pick<PatientDB, 'id' | 'nombre' | 'apellido'>;
  staff?: Pick<StaffMember, 'id' | 'nombre' | 'apellido'>;
  createdAt: string;
}

// ── Local / realtime models ───────────────────────────────────

export interface Vitals {
  fc?: number | null;
  spo2?: number | null;
  temp?: number | null;
  fr?: number | null;
  pas?: number | null;
}

export interface TriageOutput {
  nivel: TriageLevel;
  puntaje?: number;
  motivos: string[];
  recomendaciones: string[];
  posibles_causas?: string[];
  mensaje_paciente?: string;
  motor?: string;
  ajuste?: string;
  nota?: string;
  reglas?: { nivel: TriageLevel; puntaje: number };
  reportId?: string;
}

export interface Config {
  url: string;
  dev: string;
  eng: EngineMode;
  autoSave?: boolean;
}

export interface Telemetry {
  hr: number | null;
  sp: number | null;
  mv: MovimientoKey;
  ac: number | null;
  src: 'dev' | 'demo';
  last: number;
}

export const SYMPTOMS: { key: string; label: string; flag?: true }[] = [
  { key: 'dolor_toracico', label: 'Dolor torácico', flag: true },
  { key: 'disnea', label: 'Dificultad para respirar', flag: true },
  { key: 'conciencia', label: 'Confusión / desmayo', flag: true },
  { key: 'sangrado', label: 'Sangrado abundante', flag: true },
  { key: 'debilidad', label: 'Debilidad de un lado del cuerpo', flag: true },
  { key: 'fiebre', label: 'Fiebre' },
  { key: 'cefalea', label: 'Dolor de cabeza intenso' },
  { key: 'mareo', label: 'Mareo' },
  { key: 'abdominal', label: 'Dolor abdominal' },
  { key: 'vomito', label: 'Náuseas / vómito' },
  { key: 'tos', label: 'Tos' },
  { key: 'trauma', label: 'Golpe / caída' },
  { key: 'palpitaciones', label: 'Palpitaciones' },
];
