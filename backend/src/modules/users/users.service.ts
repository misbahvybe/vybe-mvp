import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { User } from '@prisma/client';
import { CreateAddressDto } from './dto/create-address.dto';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        addresses: true,
        riderProfile: true,
        ownedStores: { select: { id: true, name: true, isApproved: true } },
      },
    });
    return user;
  }

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: {
        userId,
        label: dto.label,
        fullAddress: dto.fullAddress,
        city: dto.city ?? 'Lahore',
        latitude: new Decimal(dto.latitude),
        longitude: new Decimal(dto.longitude),
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateAddress(userId: string, id: string, dto: Partial<CreateAddressDto>) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new ForbiddenException('Address not found');
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.fullAddress !== undefined) data.fullAddress = dto.fullAddress;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.latitude !== undefined) data.latitude = new Decimal(dto.latitude);
    if (dto.longitude !== undefined) data.longitude = new Decimal(dto.longitude);
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    return this.prisma.address.update({
      where: { id },
      data,
    });
  }

  async deleteAddress(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new ForbiddenException('Address not found');
    return this.prisma.address.delete({ where: { id } });
  }

  async getPaymentMethods(userId: string) {
    return this.prisma.savedPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addPaymentMethod(userId: string, dto: AddPaymentMethodDto) {
    let providerId: string;
    let last4: string;
    let brand: string;

    if (dto.paymentMethodId?.startsWith('pm_') && this.stripe.isConfigured()) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await this.stripe.getOrCreateCustomer(userId, user.email, user.name);
        await this.prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      }
      const card = await this.stripe.attachPaymentMethod(stripeCustomerId, dto.paymentMethodId);
      providerId = dto.paymentMethodId;
      last4 = card.last4;
      brand = card.brand;
    } else if (dto.last4 && dto.cardType) {
      providerId = `internal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      last4 = dto.last4;
      brand = dto.cardType;
    } else {
      throw new BadRequestException('Provide paymentMethodId (Stripe) or last4+cardType');
    }

    if (dto.isDefault) {
      await this.prisma.savedPaymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.savedPaymentMethod.create({
      data: {
        userId,
        providerId,
        last4,
        brand,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async setDefaultPaymentMethod(userId: string, id: string) {
    const pm = await this.prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
    if (!pm) throw new ForbiddenException('Payment method not found');
    await this.prisma.savedPaymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    return this.prisma.savedPaymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async deletePaymentMethod(userId: string, id: string) {
    const pm = await this.prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
    if (!pm) throw new ForbiddenException('Payment method not found');
    if (pm.providerId.startsWith('pm_') && this.stripe.isConfigured()) {
      await this.stripe.detachPaymentMethod(pm.providerId);
    }
    return this.prisma.savedPaymentMethod.delete({ where: { id } });
  }

  async getPaymentMethodForOrder(userId: string, id: string) {
    return this.prisma.savedPaymentMethod.findFirst({
      where: { id, userId },
    });
  }
}
