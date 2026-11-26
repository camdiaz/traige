import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Staff, Rol } from '../staff/staff.entity';

export interface RegisterDto {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol?: Rol;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.staffRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const staff = this.staffRepo.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      passwordHash,
      rol: dto.rol ?? 'enfermero',
    });
    const saved = await this.staffRepo.save(staff);
    return this.tokenFor(saved);
  }

  async login(email: string, password: string) {
    const staff = await this.staffRepo.findOne({ where: { email, activo: true } });
    if (!staff) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    return this.tokenFor(staff);
  }

  private tokenFor(staff: Staff) {
    const payload = { sub: staff.id, email: staff.email, rol: staff.rol };
    return {
      token: this.jwt.sign(payload),
      staff: {
        id: staff.id,
        nombre: staff.nombre,
        apellido: staff.apellido,
        email: staff.email,
        rol: staff.rol,
      },
    };
  }
}
