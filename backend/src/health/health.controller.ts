import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
      gemini: !!process.env.GEMINI_API_KEY,
      ts: Date.now(),
    };
  }
}
