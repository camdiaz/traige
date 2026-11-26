import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from './gemini.service';
import { StoreService } from '../shared/store.service';
import { applyRules } from '../shared/rules';
import { TriageReport } from './triage-report.entity';

const RANK: Record<string, number> = { VERDE: 0, AMARILLO: 1, ROJO: 2 };

@Injectable()
export class TriageService {
  constructor(
    @InjectRepository(TriageReport) private reportRepo: Repository<TriageReport>,
    private readonly gemini: GeminiService,
    private readonly store: StoreService,
  ) {}

  async evaluate(body: any, staffId?: string): Promise<any> {
    const caso = body.caso ?? {};
    const dev: string = body.device ?? 'esp32-triaje-01';

    let foto: string | undefined;
    let mime = 'image/jpeg';

    if (typeof body.foto === 'string' && body.foto.startsWith('data:')) {
      const m = body.foto.match(/^data:([^;]+);base64,(.*)$/);
      if (m) { mime = m[1]; foto = m[2]; }
    } else if (body.usarFotoDelDispositivo) {
      const p = this.store.photo[dev];
      if (p && Date.now() - p.ts < 120_000) {
        foto = p.buf.toString('base64');
      }
    }

    const base = applyRules(caso);
    let result: any;

    try {
      result = await this.gemini.evaluate(caso, foto, mime);
      result.motor = `Gemini (${this.gemini.modelName})`;
    } catch (err: any) {
      console.error('[gemini]', err.message);
      result = {
        ...base,
        mensaje_paciente: 'Un profesional lo atenderá pronto',
        motor: 'Reglas locales (Gemini no disponible)',
      };
    }

    if (RANK[base.nivel] > RANK[result.nivel]) {
      result.ajuste = `Reglas locales indican ${base.nivel}; se conserva el nivel más alto.`;
      result.nivel = base.nivel;
    }

    result.reglas = base;
    this.store.triage[dev] = { ...result, caso, ts: Date.now() };
    if (caso.origen !== 'ESP32') this.store.enqueue(dev, { cmd: 'result', nivel: result.nivel });

    // Persist report to DB
    try {
      const report = this.reportRepo.create({
        origen: caso.origen ?? 'dashboard',
        nivel: result.nivel,
        puntaje: result.puntaje ?? base.puntaje,
        motor: result.motor,
        vitales: {
          fc: caso.fc, spo2: caso.spo2, temperatura: caso.temperatura,
          fr: caso.fr, movimiento: caso.movimiento,
        },
        sintomas: Array.isArray(caso.sintomas) ? caso.sintomas : [],
        dolor: caso.dolor,
        inicio: caso.inicio,
        notasCaso: caso.notas,
        motivos: result.motivos ?? [],
        recomendaciones: result.recomendaciones ?? [],
        mensajePaciente: result.mensaje_paciente,
        ajuste: result.ajuste,
        fotob64: foto ?? null,
        deviceId: dev,
        patient: body.patientId ? ({ id: body.patientId } as any) : undefined,
        staff: staffId ? ({ id: staffId } as any) : undefined,
      });
      const saved = await this.reportRepo.save(report);
      result.reportId = saved.id;
    } catch (err: any) {
      console.error('[triage] no se pudo guardar en DB:', err.message);
    }

    return result;
  }

  findReports(patientId?: string, limit = 50) {
    const q = this.reportRepo.createQueryBuilder('r')
      .leftJoin('r.patient', 'p')
      .leftJoin('r.staff', 's')
      .select([
        'r.id', 'r.origen', 'r.nivel', 'r.puntaje', 'r.motor',
        'r.vitales', 'r.sintomas', 'r.dolor', 'r.inicio', 'r.notasCaso',
        'r.motivos', 'r.recomendaciones', 'r.mensajePaciente', 'r.ajuste',
        'r.deviceId', 'r.createdAt',
        'p.id', 'p.nombre', 'p.apellido',
        's.id', 's.nombre', 's.apellido',
      ])
      .orderBy('r.createdAt', 'DESC')
      .take(limit);

    if (patientId) q.where('p.id = :patientId', { patientId });
    return q.getMany();
  }
}
