'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin, SOCKET_IO_CLIENT_OPTIONS } from '@/services/socketUrl';

export type OrderCreatedEvent = {
  id: string;
  orderNumber?: number;
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

export type OrderUpdatedEvent = {
  orderId: string;
  orderStatus: string;
  storeId: string;
  customerId: string;
  riderId: string | null;
};

const emptyCreatedPayload = (): OrderCreatedEvent => ({
  id: '',
  storeId: '',
  customerId: '',
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

type Role = 'ADMIN' | 'STORE_OWNER';

/**
 * Subscribes to order events when JWT is present.
 * Admin hears all orders; store owner only their store.
 * Includes Socket.IO reconnection; callers should treat callback as “refetch lists”.
 */
export function useOrdersRealtime(
  enabled: boolean,
  token: string | null | undefined,
  role: Role | null | undefined,
  storeId: string | null | undefined,
  onOrderEvent: (payload: OrderCreatedEvent) => void,
  options?: {
    /** Called when a matching order is created (useful for POS alert sounds). */
    onCreated?: (payload: OrderCreatedEvent) => void;
    /** Called when a matching order is updated (status/assignment). */
    onUpdated?: (payload: OrderUpdatedEvent) => void;
    /** Called when socket connects (useful for UI indicators). */
    onConnect?: () => void;
    /** Called when socket disconnects (useful for UI indicators). */
    onDisconnect?: () => void;
  },
) {
  const cbRef = useRef(onOrderEvent);
  cbRef.current = onOrderEvent;

  useEffect(() => {
    if (!enabled || !token?.trim() || (role !== 'ADMIN' && role !== 'STORE_OWNER')) {
      return;
    }

    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        ...SOCKET_IO_CLIENT_OPTIONS,
        auth: { token },
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      const refresh = () => cbRef.current(emptyCreatedPayload());
      socket.on('connect', () => options?.onConnect?.());
      socket.on('disconnect', () => options?.onDisconnect?.());

      socket.on('order:created', (payload: OrderCreatedEvent) => {
        if (role === 'ADMIN') {
          cbRef.current(payload);
          options?.onCreated?.(payload);
          return;
        }
        // STORE_OWNER sockets are already scoped to the store room by the backend.
        // Do not require storeId to be loaded on the client; otherwise we can miss events during initial boot.
        if (role === 'STORE_OWNER') {
          if (!storeId || payload.storeId === storeId) {
            cbRef.current(payload);
            options?.onCreated?.(payload);
          }
        }
      });

      socket.on('order:updated', (payload: OrderUpdatedEvent) => {
        if (role === 'ADMIN') {
          refresh();
          options?.onUpdated?.(payload);
          return;
        }
        if (role === 'STORE_OWNER') {
          if (!storeId || payload.storeId === storeId) {
            refresh();
            options?.onUpdated?.(payload);
          }
        }
      });

      if (role === 'ADMIN') {
        socket.on('order:rider_self_claimed', refresh);
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

/** Customer: new orders and status updates (same account, multiple tabs / PWA). */
export function useCustomerOrdersRealtime(
  enabled: boolean,
  token: string | null | undefined,
  onRefresh: () => void,
) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !token?.trim()) return;

    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        ...SOCKET_IO_CLIENT_OPTIONS,
        auth: { token },
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      const refresh = () => cbRef.current();
      socket.on('order:created', refresh);
      socket.on('order:updated', refresh);
    } catch {
      // ignore
    }

    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, token]);
}

/**
 * Rider: refetch when assigned to an order or when order status changes for this rider.
 */
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
        ...SOCKET_IO_CLIENT_OPTIONS,
        auth: { token },
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      const refresh = () => cbRef.current();
      socket.on('order:assigned', refresh);
      socket.on('order:updated', refresh);
      socket.on('pickup_pool:updated', refresh);
      socket.on('rider:cod_wallet', refresh);
    } catch {
      // ignore
    }

    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, token]);
}

/** Single order detail: live updates + optional polling when socket is down. */
export function useOrderDetailRealtime(
  enabled: boolean,
  orderId: string | null | undefined,
  token: string | null | undefined,
  onRefresh: () => void,
  pollIntervalMs = 25000,
) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !orderId || !token?.trim()) return;

    let socket: Socket | null = null;
    try {
      socket = io(getSocketOrigin(), {
        ...SOCKET_IO_CLIENT_OPTIONS,
        auth: { token },
        reconnectionAttempts: 12,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      socket.on('order:updated', (payload: OrderUpdatedEvent) => {
        if (payload.orderId === orderId) cbRef.current();
      });
      socket.on('order:created', (payload: OrderCreatedEvent) => {
        if (payload.id === orderId) cbRef.current();
      });
    } catch {
      // ignore
    }

    const poll = setInterval(() => cbRef.current(), pollIntervalMs);

    return () => {
      clearInterval(poll);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, orderId, token, pollIntervalMs]);
}
