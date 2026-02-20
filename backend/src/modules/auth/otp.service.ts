import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Otp } from '@prisma/client';

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 3;

@Injectable()
export class OtpService {
  private readonly expiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.expiryMinutes = this.config.get<number>('OTP_EXPIRY_MINUTES', 3);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^0/, '92');
  }

  async createAndSend(phone: string): Promise<{ expiresAt: Date }> {
    const normalized = this.normalizePhone(phone);

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    await this.prisma.otp.create({
      data: {
        phone: normalized,
        code: codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    await this.sendSms(normalized, code);
    return { expiresAt };
  }

  async verify(phone: string, code: string): Promise<Otp | null> {
    const normalized = this.normalizePhone(phone);
    const validOtp = await this.prisma.otp.findFirst({
      where: {
        phone: normalized,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!validOtp) return null;

    if (validOtp.attempts >= MAX_VERIFY_ATTEMPTS) {
      return null;
    }

    const match = await bcrypt.compare(code, validOtp.code);
    if (!match) {
      await this.prisma.otp.update({
        where: { id: validOtp.id },
        data: { attempts: validOtp.attempts + 1 },
      });
      return null;
    }

    await this.prisma.otp.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });
    return validOtp;
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const url = this.config.get<string>('SMS_PROVIDER_URL');
    const apiKey = this.config.get<string>('SMS_API_KEY');
    if (!url || !apiKey) {
      console.log(`[OTP] Dev mode – code for ${phone}: ${code}`);
      return;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: phone, message: `Your Vybe verification code is: ${code}. Valid for ${this.expiryMinutes} minutes.` }),
    });
  }
}
