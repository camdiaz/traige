import { Injectable } from '@nestjs/common';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    nivel: { type: 'STRING', enum: ['ROJO', 'AMARILLO', 'VERDE'] },
    puntaje: { type: 'INTEGER' },
    motivos: { type: 'ARRAY', items: { type: 'STRING' } },
    recomendaciones: { type: 'ARRAY', items: { type: 'STRING' } },
    posibles_causas: { type: 'ARRAY', items: { type: 'STRING' } },
    mensaje_paciente: { type: 'STRING' },
  },
  required: ['nivel', 'motivos', 'recomendaciones', 'mensaje_paciente'],
};

const SYSTEM = `Eres un asistente de triaje de urgencias para un prototipo educativo en Colombia (no es diagnóstico).
Clasifica la prioridad: ROJO = atención inmediata; AMARILLO = urgente (<30 min); VERDE = no urgente.
Usa signos vitales, movimiento (caída), síntomas, dolor, antecedentes y la foto si se adjunta (solo signos visibles evidentes).
Ante la duda, elige el nivel más alto. Recomendaciones: máximo 4, concretas, para el personal.
"mensaje_paciente": una frase breve (máx. 60 caracteres), tranquilizadora, en español.`;

@Injectable()
export class GeminiService {
  private readonly key = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  get isAvailable() { return !!this.key; }
  get modelName() { return this.model; }

  async evaluate(caso: any, fotoB64?: string, fotoMime = 'image/jpeg'): Promise<any> {
    if (!this.key) throw new Error('GEMINI_API_KEY no configurada');

    const parts: any[] = [{ text: 'Caso (JSON):\n' + JSON.stringify(caso) }];
    if (fotoB64) parts.push({ inline_data: { mime_type: fotoMime, data: fotoB64 } });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    return JSON.parse(text);
  }
}
