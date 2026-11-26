import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from '../shared/device-token.guard';
import { StoreService } from '../shared/store.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly store: StoreService) {}

  @Post()
  @UseGuards(DeviceTokenGuard)
  save(@Body() body: any, @Query('device') qDev?: string) {
    const dev = body?.device ?? qDev ?? 'esp32-triaje-01';
    this.store.telemetry[dev] = { ...body, ts: Date.now() };
    return { ok: true };
  }

  @Get('latest')
  latest(@Query('device') dev = 'esp32-triaje-01') {
    return this.store.telemetry[dev] ?? {};
  }
}
