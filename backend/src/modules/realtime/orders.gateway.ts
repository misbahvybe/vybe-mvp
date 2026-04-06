import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../common/prisma/prisma.service';

export type OrderCreatedPayload = {
  id: string;
  storeId: string;
  customerId: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: string;
  subtotalAmount: string;
  deliveryFee: string;
  serviceFee: string;
  gstAmount: string;
  cardProcessingAmount: string;
  slaDeadlineAt: string | null;
  customer: { name: string; phone: string };
};

export type OrderUpdatedPayload = {
  orderId: string;
  orderStatus: string;
  storeId: string;
  customerId: string;
  riderId: string | null;
};

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    void this.authenticateAndJoin(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Disconnected ${client.id}`);
  }

  private async authenticateAndJoin(client: Socket): Promise<void> {
    const raw =
      (client.handshake.auth?.token as string | undefined) ||
      (typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (!raw?.trim()) {
      client.disconnect(true);
      return;
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = this.jwt.verify<{ sub: string }>(raw, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });
      if (!user) {
        client.disconnect(true);
        return;
      }
      if (user.role === 'ADMIN') {
        await client.join('admin:orders');
        this.logger.debug(`Socket ${client.id} joined admin:orders`);
        return;
      }
      if (user.role === 'STORE_OWNER') {
        const store = await this.prisma.store.findFirst({
          where: { ownerId: user.id },
          select: { id: true },
        });
        if (store) {
          await client.join(`store:${store.id}`);
          this.logger.debug(`Socket ${client.id} joined store:${store.id}`);
        }
        return;
      }
      if (user.role === 'RIDER') {
        await client.join(`rider:${user.id}`);
        this.logger.debug(`Socket ${client.id} joined rider:${user.id}`);
        return;
      }
      if (user.role === 'CUSTOMER') {
        await client.join(`customer:${user.id}`);
        this.logger.debug(`Socket ${client.id} joined customer:${user.id}`);
        return;
      }
      client.disconnect(true);
    } catch (e) {
      this.logger.warn(`Socket auth failed: ${e instanceof Error ? e.message : e}`);
      client.disconnect(true);
    }
  }

  /** New order: notify store kitchen + admin ops + customer (e.g. second device). */
  emitOrderCreated(payload: OrderCreatedPayload): void {
    this.server.to(`store:${payload.storeId}`).emit('order:created', payload);
    this.server.to('admin:orders').emit('order:created', payload);
    this.server.to(`customer:${payload.customerId}`).emit('order:created', payload);
  }

  /** Status or assignment changed — keep dashboards and order detail in sync without refresh. */
  emitOrderUpdated(payload: OrderUpdatedPayload, previousRiderId?: string | null): void {
    const body = {
      orderId: payload.orderId,
      orderStatus: payload.orderStatus,
      storeId: payload.storeId,
      customerId: payload.customerId,
      riderId: payload.riderId,
    };
    this.server.to(`store:${payload.storeId}`).emit('order:updated', body);
    this.server.to('admin:orders').emit('order:updated', body);
    this.server.to(`customer:${payload.customerId}`).emit('order:updated', body);
    if (payload.riderId) {
      this.server.to(`rider:${payload.riderId}`).emit('order:updated', body);
    }
    if (previousRiderId && previousRiderId !== payload.riderId) {
      this.server.to(`rider:${previousRiderId}`).emit('order:updated', body);
    }
  }

  /** Admin assigned (or reassigned) this order to the rider — refresh /orders. */
  emitRiderAssigned(riderId: string, orderId: string): void {
    this.server.to(`rider:${riderId}`).emit('order:assigned', { orderId });
  }

  /** Rider claimed an open pickup order — admin list should refresh. */
  emitRiderSelfClaimed(orderId: string, riderId: string): void {
    this.server.to('admin:orders').emit('order:rider_self_claimed', { orderId, riderId });
  }
}
