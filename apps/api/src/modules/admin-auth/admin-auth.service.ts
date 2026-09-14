import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { Errors } from '../../common/errors';
import { verifyTotp } from '../../common/totp';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, totp?: string) {
    const admin = await this.prisma.adminAccount.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID', message: 'Invalid admin credentials' });
    }
    const ok = await compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID', message: 'Invalid admin credentials' });
    }
    if (admin.totpEnabled) {
      if (!totp) throw Errors.totpRequired();
      if (!admin.totpSecret || !verifyTotp(admin.totpSecret, totp)) {
        throw Errors.totpInvalid();
      }
    }

    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, tokenType: 'admin' },
      {
        secret: process.env.JWT_ADMIN_ACCESS_SECRET,
        expiresIn: '8h',
        issuer: 'meddonish-api',
        audience: 'meddonish-admin',
        algorithm: 'HS256',
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      totpRequired: admin.totpEnabled,
    };
  }
}
