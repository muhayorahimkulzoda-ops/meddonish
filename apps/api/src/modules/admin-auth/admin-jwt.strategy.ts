import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface AdminJwt {
  sub: string;
  tokenType: 'admin';
}

export interface AdminPayload {
  adminId: string;
  email: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ADMIN_ACCESS_SECRET ?? 'dev-change-me-admin-access',
      issuer: 'meddonish-api',
      audience: 'meddonish-admin',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AdminJwt): Promise<AdminPayload> {
    if (payload.tokenType !== 'admin') {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID', message: 'Invalid admin token' });
    }
    const admin = await this.prisma.adminAccount.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID', message: 'Admin is not active' });
    }
    return { adminId: admin.id, email: admin.email };
  }
}
