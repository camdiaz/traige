const FLAGS = [
  'Dolor torácico',
  'Dificultad para respirar',
  'Confusión / desmayo',
  'Sangrado abundante',
  'Debilidad de un lado del cuerpo',
];

const REC: Record<string, string[]> = {
  ROJO: [
    'Avisar de inmediato al personal de salud',
    'Mantener al paciente acostado y vigilado',
    'Preparar oxígeno si la SpO2 es baja',
    'Repetir signos vitales cada 5 minutos',
  ],
  AMARILLO: [
    'Valoración médica en menos de 30 minutos',
    'Repetir signos vitales cada 15 minutos',
    'Indicar al paciente que avise si empeora',
  ],
  VERDE: [
    'Puede esperar turno en sala',
    'Hidratación y reposo',
    'Reevaluar si aparecen nuevos síntomas',
  ],
};

export function applyRules(caso: any): {
  nivel: string;
  puntaje: number;
  motivos: string[];
  recomendaciones: string[];
} {
  const v = caso.vitales ?? {};
  let score = 0;
  let hard = false;
  const motivos: string[] = [];

  const add = (points: number, text: string) => {
    if (points > 0) { score += points; motivos.push(text); }
    if (points >= 3) hard = true;
  };

  if (v.spo2 != null) {
    if (v.spo2 <= 91) add(3, `SpO2 ${v.spo2}%`);
    else if (v.spo2 <= 93) add(2, `SpO2 ${v.spo2}%`);
    else if (v.spo2 <= 95) add(1, `SpO2 ${v.spo2}%`);
  }
  if (v.fc != null) {
    if (v.fc <= 40 || v.fc >= 131) add(3, `FC ${v.fc} lpm`);
    else if (v.fc >= 111) add(2, `FC ${v.fc} lpm`);
    else if (v.fc <= 50 || v.fc >= 91) add(1, `FC ${v.fc} lpm`);
  }
  if (v.temp != null) {
    if (v.temp <= 35) add(3, `Temperatura ${v.temp} °C`);
    else if (v.temp >= 39.1) add(2, `Temperatura ${v.temp} °C`);
    else if (v.temp >= 38.1 || v.temp <= 36) add(1, `Temperatura ${v.temp} °C`);
  }
  if (v.fr != null) {
    if (v.fr <= 8 || v.fr >= 25) add(3, `FR ${v.fr} rpm`);
    else if (v.fr >= 21) add(2, `FR ${v.fr} rpm`);
    else if (v.fr <= 11) add(1, `FR ${v.fr} rpm`);
  }
  if (v.pas != null) {
    if (v.pas <= 90 || v.pas >= 220) add(3, `PA sistólica ${v.pas}`);
    else if (v.pas <= 100) add(2, `PA sistólica ${v.pas}`);
    else if (v.pas <= 110) add(1, `PA sistólica ${v.pas}`);
  }

  if (caso.movimiento === 'caida') add(2, 'Caída detectada');

  const flagSymptoms = (caso.sintomas ?? []).filter((s: string) => FLAGS.includes(s));
  if (flagSymptoms.length) add(2, 'Signo de alarma: ' + flagSymptoms.join(', '));

  const dolor = caso.dolor ?? 0;
  if (dolor >= 8) add(2, `Dolor ${dolor}/10`);
  else if (dolor >= 5) add(1, `Dolor ${dolor}/10`);

  const nivel =
    hard || score >= 7 || (flagSymptoms.length && score >= 4)
      ? 'ROJO'
      : score >= 3 || flagSymptoms.length
      ? 'AMARILLO'
      : 'VERDE';

  return {
    nivel,
    puntaje: score,
    motivos: motivos.length ? motivos : ['Signos dentro de rangos esperados'],
    recomendaciones: REC[nivel],
  };
}
