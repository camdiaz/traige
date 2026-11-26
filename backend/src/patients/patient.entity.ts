import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Staff } from '../staff/staff.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column({ name: 'fecha_nacimiento', nullable: true })
  fechaNacimiento: string;

  @Column({ nullable: true })
  genero: string;

  @Column({ nullable: true, type: 'text' })
  notas: string;

  @ManyToOne(() => Staff, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  creadoPor: Staff;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
