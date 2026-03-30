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
      client.disconnect(true);
    } catch (e) {
      this.logger.warn(`Socket auth failed: ${e instanceof Error ? e.message : e}`);
      client.disconnect(true);
    }
  }

  /** New order: notify store kitchen + admin ops. */
  emitOrderCreated(payload: OrderCreatedPayload): void {
    this.server.to(`store:${payload.storeId}`).emit('order:created', payload);
    this.server.to('admin:orders').emit('order:created', payload);
  }
}
