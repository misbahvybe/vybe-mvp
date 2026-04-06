import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Otp } from '@prisma/client';

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 3;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
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

    await this.deliverOtp(normalized, code);
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

  private whatsappConfig(): { token: string; phoneNumberId: string; templateName: string } | null {
    const t = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '') || '';
    const token = t(this.config.get<string>('WHATSAPP_ACCESS_TOKEN'));
    const phoneNumberId = t(this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
    const templateName = t(this.config.get<string>('WHATSAPP_OTP_TEMPLATE_NAME'));
    if (!token || !phoneNumberId || !templateName) return null;
    return { token, phoneNumberId, templateName };
  }

  /**
   * Sends OTP only via Meta WhatsApp Cloud API (approved template).
   * Production: fails if WhatsApp is not configured. Development: logs OTP to console.
   */
  private async deliverOtp(phone: string, code: string): Promise<void> {
    const wa = this.whatsappConfig();
    if (wa) {
      await this.sendWhatsAppTemplate(phone, code, wa.token, wa.phoneNumberId, wa.templateName);
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      this.logger.error('[OTP] WhatsApp credentials missing in production');
      throw new ServiceUnavailableException(
        'OTP could not be sent: configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_OTP_TEMPLATE_NAME.',
      );
    }

    this.logger.warn(
      `[OTP] WhatsApp not configured – code for ${phone}: ${code} (set WHATSAPP_* env vars; see backend/.env.example)`,
    );
  }

  /**
   * Meta WhatsApp Cloud API – requires an approved template in Business Manager.
   * Template must include at least one body variable: the OTP (e.g. "Your VYBE Superapp code is {{1}}").
   * Optional second variable: minutes valid (set WHATSAPP_OTP_TEMPLATE_MINUTES_PARAM=true).
   * Auth templates with URL/copy button: set WHATSAPP_OTP_AUTH_BUTTON_INDEX=0 (string index Meta expects).
   */
  private async sendWhatsAppTemplate(
    phoneDigits: string,
    code: string,
    accessToken: string,
    phoneNumberId: string,
    templateName: string,
  ): Promise<void> {
    const apiVersion = (this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0') ?? 'v21.0').trim() || 'v21.0';
    const lang = (this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE', 'en_US') ?? 'en_US').trim() || 'en_US';
    const minutesParam = this.config.get<string>('WHATSAPP_OTP_TEMPLATE_MINUTES_PARAM') === 'true';
    const buttonIndexRaw = this.config.get<string>('WHATSAPP_OTP_AUTH_BUTTON_INDEX');
    const buttonIndex =
      buttonIndexRaw !== undefined && buttonIndexRaw !== null
        ? String(buttonIndexRaw).trim()
        : '';

    const bodyParameters: { type: 'text'; text: string }[] = [
      { type: 'text', text: code },
    ];
    if (minutesParam) {
      bodyParameters.push({ type: 'text', text: String(this.expiryMinutes) });
    }

    const components: Record<string, unknown>[] = [
      {
        type: 'body',
        parameters: bodyParameters,
      },
    ];

    if (buttonIndex !== '') {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: buttonIndex,
        parameters: [{ type: 'text', text: code }],
      });
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneDigits,
      type: 'template',
      template: {
        name: templateName,
        language: { code: lang },
        components,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let json: { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(raw) as typeof json;
    } catch {
      this.logger.error(`WhatsApp API non-JSON response ${res.status}: ${raw}`);
      throw new ServiceUnavailableException('Could not send verification code via WhatsApp. Try again later.');
    }

    if (!res.ok || json.error) {
      this.logger.error(`WhatsApp API ${res.status}: ${raw}`);
      throw new ServiceUnavailableException('Could not send verification code via WhatsApp. Try again later.');
    }
  }
}
