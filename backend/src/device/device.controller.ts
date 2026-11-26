import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DeviceTokenGuard } from '../shared/device-token.guard';
import { StoreService } from '../shared/store.service';

@Controller('device')
export class DeviceController {
  constructor(private readonly store: StoreService) {}

  @Post('command')
  sendCommand(@Body() body: any, @Query('device') qDev?: string) {
    const dev = body?.device ?? qDev ?? 'esp32-triaje-01';
    this.store.enqueue(dev, { cmd: body.cmd, track: body.track, nivel: body.nivel });
    return { ok: true };
  }

  @Get('commands')
  @UseGuards(DeviceTokenGuard)
  getCommands(@Query('device') dev = 'esp32-triaje-01') {
    return { comandos: this.store.dequeue(dev) };
  }
}
