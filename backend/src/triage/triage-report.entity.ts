import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from '../patients/patient.entity';
import { Staff } from '../staff/staff.entity';

@Entity('triage_reports')
export class TriageReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Staff, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @Column({ default: 'dashboard' })
  origen: string;

  @Column()
  nivel: string;

  @Column({ nullable: true })
  puntaje: number;

  @Column({ nullable: true })
  motor: string;

  @Column({ type: 'jsonb', nullable: true })
  vitales: Record<string, any>;

  @Column({ type: 'text', array: true, nullable: true })
  sintomas: string[];

  @Column({ nullable: true })
  dolor: number;

  @Column({ nullable: true })
  inicio: string;

  @Column({ nullable: true, type: 'text' })
  notasCaso: string;

  @Column({ type: 'text', array: true, nullable: true })
  motivos: string[];

  @Column({ type: 'text', array: true, nullable: true })
  recomendaciones: string[];

  @Column({ nullable: true, type: 'text' })
  mensajePaciente: string;

  @Column({ nullable: true, type: 'text' })
  ajuste: string;

  @Column({ nullable: true, type: 'text' })
  fotob64: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
