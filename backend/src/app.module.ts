import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { SharedModule } from './shared/shared.module';
import { HealthModule } from './health/health.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { CameraModule } from './camera/camera.module';
import { DeviceModule } from './device/device.module';
import { TriageModule } from './triage/triage.module';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { PatientsModule } from './patients/patients.module';
import { Staff } from './staff/staff.entity';
import { Patient } from './patients/patient.entity';
import { TriageReport } from './triage/triage-report.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false,
      entities: [Staff, Patient, TriageReport],
      synchronize: true,   // auto-crea tablas en desarrollo; en prod usar migraciones
      logging: false,
    }),
    ServeStaticModule.forRoot({
      rootPath: process.env.STATIC_PATH ?? join(__dirname, '..', '..', 'dashboard', 'dist'),
      exclude: ['/api/(.*)'],
      serveStaticOptions: { index: 'index.html' },
    }),
    SharedModule,
    HealthModule,
    TelemetryModule,
    CameraModule,
    DeviceModule,
    TriageModule,
    AuthModule,
    StaffModule,
    PatientsModule,
  ],
})
export class AppModule {}
