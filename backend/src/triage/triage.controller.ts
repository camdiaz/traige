import { Body, Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { TriageService } from './triage.service';
import { StoreService } from '../shared/store.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('triage')
export class TriageController {
  constructor(
    private readonly triageService: TriageService,
    private readonly store: StoreService,
  ) {}

  // ESP32 posts without auth; dashboard posts with auth
  @Post()
  evaluate(@Body() body: any, @Req() req: any) {
    const staffId: string | undefined = req.user?.id;
    return this.triageService.evaluate(body, staffId);
  }

  @Get('latest')
  latest(@Query('device') dev = 'esp32-triaje-01') {
    return this.store.triage[dev] ?? {};
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports')
  reports(@Query('patientId') patientId?: string, @Query('limit') limit?: string) {
    return this.triageService.findReports(patientId, limit ? +limit : 50);
  }
}
