import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { DeviceTokenGuard } from '../shared/device-token.guard';
import { StoreService } from '../shared/store.service';

@Controller('camera')
export class CameraController {
  constructor(private readonly store: StoreService) {}

  @Post()
  @UseGuards(DeviceTokenGuard)
  save(@Req() req: Request, @Query('device') dev = 'esp32-triaje-01') {
    const buf: Buffer = req.body;
    if (!buf?.length) return { ok: false, error: 'sin imagen' };
    this.store.photo[dev] = { buf, ts: Date.now() };
    return { ok: true };
  }

  @Get('latest')
  latest(@Query('device') dev = 'esp32-triaje-01', @Res() res: Response) {
    const p = this.store.photo[dev];
    if (!p) {
      this.store.enqueue(dev, { cmd: 'photo' });
      return res.status(404).json({ error: 'sin foto; se pidió una al dispositivo' });
    }
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(p.buf);
  }
}
