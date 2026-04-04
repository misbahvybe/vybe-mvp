import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from '@api/client';

export type OrderCreatedEvent = {
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

type Role = 'ADMIN' | 'STORE_OWNER';

export function useOrdersRealtime(
  enabled: boolean,
  token: string | null | undefined,
  role: Role | null | undefined,
  storeId: string | null | undefined,
  onOrderCreated: (payload: OrderCreatedEvent) => void,
) {
  const cbRef = useRef(onOrderCreated);
  cbRef.current = onOrderCreated;

  useEffect(() => {
    if (!enabled || !token?.trim() || (role !== 'ADMIN' && role !== 'STORE_OWNER')) {
      return;
    }

    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnectionAttempts: 8,
        reconnectionDelay: 2000,
      });

      socket.on('order:created', (payload: OrderCreatedEvent) => {
        if (role === 'ADMIN') {
          cbRef.current(payload);
          return;
        }
        if (role === 'STORE_OWNER' && storeId && payload.storeId === storeId) {
          cbRef.current(payload);
        }
      });

      if (role === 'ADMIN') {
        socket.on('order:rider_self_claimed', () => {
          cbRef.current({
            id: '',
            storeId: '',
            orderStatus: '',
            createdAt: '',
            totalAmount: '',
            subtotalAmount: '',
            deliveryFee: '',
            serviceFee: '',
            gstAmount: '',
            cardProcessingAmount: '',
            slaDeadlineAt: null,
            customer: { name: '', phone: '' },
          });
        });
      }
    } catch {
      // ignore
    }

    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, token, role, storeId]);
}

/** Rider: admin assigned an order — refetch /orders without manual pull-to-refresh. */
export function useRiderAssignmentRealtime(
  enabled: boolean,
  token: string | null | undefined,
  onAssigned: () => void,
) {
  const cbRef = useRef(onAssigned);
  cbRef.current = onAssigned;

  useEffect(() => {
    if (!enabled || !token?.trim()) {
      return;
    }

    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnectionAttempts: 8,
        reconnectionDelay: 2000,
      });

      socket.on('order:assigned', () => {
        cbRef.current();
      });
    } catch {
      // ignore
    }

    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, token]);
}
