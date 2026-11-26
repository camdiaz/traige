import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';
import { GeminiService } from './gemini.service';
import { TriageReport } from './triage-report.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([TriageReport]), AuthModule],
  controllers: [TriageController],
  providers: [TriageService, GeminiService],
})
export class TriageModule {}
