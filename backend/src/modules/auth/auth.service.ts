import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { SignupDto } from './dto/signup.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new ConflictException('Passwords do not match');
    }
    const normalized = this.normalizePhone(dto.phone);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: normalized }],
      },
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: normalized,
        password: passwordHash,
        role: 'CUSTOMER',
      },
    });
    const { expiresAt } = await this.otp.createAndSend(dto.phone);
    return {
      message: 'OTP sent to your phone',
      userId: user.id,
      phone: user.phone,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async login(emailOrPhone: string, password: string) {
    const trimmed = emailOrPhone.trim();
    const isEmail = trimmed.includes('@');
    let user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: trimmed } })
      : await this.findUserByPhone(trimmed);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    return this.buildTokenResponse(user);
  }

  private async findUserByPhone(input: string) {
    const normalized = this.normalizePhone(input);
    let user = await this.prisma.user.findUnique({ where: { phone: normalized } });
    if (!user && normalized.startsWith('92') && normalized.length === 12) {
      user = await this.prisma.user.findUnique({ where: { phone: normalized.slice(2) } });
    }
    return user;
  }

  async requestLoginOtp(phone: string) {
    const normalized = this.normalizePhone(phone);
    const user = await this.prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) {
      throw new UnauthorizedException('No account found for this phone');
    }
    const { expiresAt } = await this.otp.createAndSend(phone);
    return {
      message: 'OTP sent',
      phone: normalized,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyOtpAndLogin(phone: string, code: string) {
    const otpRecord = await this.otp.verify(phone, code);
    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const normalized = this.normalizePhone(phone);
    const user = await this.prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.buildTokenResponse(user);
  }

  async verifyOtpAfterSignup(phone: string, code: string) {
    const otpRecord = await this.otp.verify(phone, code);
    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const normalized = this.normalizePhone(phone);
    await this.prisma.user.updateMany({
      where: { phone: normalized },
      data: { isVerified: true },
    });
    const user = await this.prisma.user.findUnique({ where: { phone: normalized } });
    if (!user) throw new UnauthorizedException('User not found');
    return this.buildTokenResponse(user);
  }

  private buildTokenResponse(user: { id: string; name: string; email: string | null; phone: string; role: string }) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^0/, '92');
  }

  async validateUserById(id: string) {
    return this.users.findById(id);
  }

  async validateInviteToken(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        invitationToken: token,
        invitationExpiresAt: { gt: new Date() },
        passwordSet: false,
      },
    });
    return user ? { valid: true, name: user.name, email: user.email } : { valid: false };
  }

  async setPasswordFromInvite(token: string, password: string, confirmPassword: string) {
    if (password !== confirmPassword) {
      throw new ConflictException('Passwords do not match');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        invitationToken: token,
        invitationExpiresAt: { gt: new Date() },
        passwordSet: false,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invitation link is invalid or expired');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        passwordSet: true,
        invitationToken: null,
        invitationExpiresAt: null,
      },
    });
    return this.buildTokenResponse(user);
  }

  async partnerLogin(emailOrPhone: string, password: string) {
    const trimmed = emailOrPhone.trim();
    const isEmail = trimmed.includes('@');
    let user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: trimmed } })
      : await this.findUserByPhone(trimmed);
    if (!user) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    if (user.role === 'CUSTOMER') {
      throw new UnauthorizedException('Please login using customer login.');
    }
    if (!user.passwordSet || !user.password) {
      throw new UnauthorizedException('Please set your password using the invitation link first.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Contact admin.');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }
    return this.buildTokenResponse(user);
  }
}
