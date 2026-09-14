import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AdminAuthService } from './admin-auth.service';

class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  totp?: string;
}

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  login(@Body() body: AdminLoginDto) {
    return this.adminAuth.login(body.email, body.password, body.totp);
  }
}
