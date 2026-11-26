import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';

export interface CreatePatientDto {
  nombre: string;
  apellido: string;
  fechaNacimiento?: string;
  genero?: string;
  notas?: string;
  staffId?: string;
}

@Injectable()
export class PatientsService {
  constructor(@InjectRepository(Patient) private repo: Repository<Patient>) {}

  findAll() {
    return this.repo.find({ relations: ['creadoPor'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id }, relations: ['creadoPor'] });
    if (!p) throw new NotFoundException('Paciente no encontrado');
    return p;
  }

  create(dto: CreatePatientDto, staffId?: string) {
    const patient = this.repo.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      fechaNacimiento: dto.fechaNacimiento,
      genero: dto.genero,
      notas: dto.notas,
      creadoPor: staffId ? ({ id: staffId } as any) : undefined,
    });
    return this.repo.save(patient);
  }

  async update(id: string, dto: Partial<CreatePatientDto>) {
    await this.repo.update(id, {
      nombre: dto.nombre,
      apellido: dto.apellido,
      fechaNacimiento: dto.fechaNacimiento,
      genero: dto.genero,
      notas: dto.notas,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { ok: true };
  }
}
