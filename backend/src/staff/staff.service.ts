import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './staff.entity';

@Injectable()
export class StaffService {
  constructor(@InjectRepository(Staff) private repo: Repository<Staff>) {}

  findAll() {
    return this.repo.find({ select: ['id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'createdAt'] });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, select: ['id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'createdAt'] });
  }

  async update(id: string, data: Partial<Pick<Staff, 'nombre' | 'apellido' | 'rol' | 'activo'>>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }
}
