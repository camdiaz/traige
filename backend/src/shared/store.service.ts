import { Injectable } from '@nestjs/common';

export interface TelemetryData {
  device?: string;
  fc?: number;
  spo2?: number;
  movimiento?: string;
  acel?: number;
  ts: number;
  [key: string]: any;
}

export interface PhotoData {
  buf: Buffer;
  ts: number;
}

export interface Command {
  cmd: string;
  nivel?: string;
  track?: number;
  ts: number;
}

export interface TriageResult {
  nivel: string;
  puntaje?: number;
  motivos: string[];
  recomendaciones: string[];
  posibles_causas?: string[];
  mensaje_paciente: string;
  motor?: string;
  reglas?: any;
  ajuste?: string;
  caso?: any;
  ts: number;
}

@Injectable()
export class StoreService {
  readonly telemetry: Record<string, TelemetryData> = {};
  readonly photo: Record<string, PhotoData> = {};
  readonly commands: Record<string, Command[]> = {};
  readonly triage: Record<string, TriageResult> = {};

  enqueue(device: string, cmd: Omit<Command, 'ts'>) {
    if (!this.commands[device]) this.commands[device] = [];
    this.commands[device].push({ ...cmd, ts: Date.now() });
    if (this.commands[device].length > 20) this.commands[device].shift();
  }

  dequeue(device: string): Command[] {
    const cmds = this.commands[device] ?? [];
    this.commands[device] = [];
    return cmds;
  }
}
