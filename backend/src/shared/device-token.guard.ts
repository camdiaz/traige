import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.DEVICE_TOKEN;
    if (!token) return true;
    const req = context.switchToHttp().getRequest();
    if (req.headers['x-device-token'] !== token) {
      throw new UnauthorizedException('token inválido');
    }
    return true;
  }
}
