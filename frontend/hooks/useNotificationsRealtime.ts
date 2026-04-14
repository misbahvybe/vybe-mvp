'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin, SOCKET_IO_CLIENT_OPTIONS } from '@/services/socketUrl';

export type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export function useNotificationsRealtime(
  enabled: boolean,
  token: string | null | undefined,
  onNotif: (n: NotificationEvent) => void,
) {
  const cbRef = useRef(onNotif);
  cbRef.current = onNotif;

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
      socket.on('notif:new', (payload: NotificationEvent) => cbRef.current(payload));
    } catch {
      // ignore
    }
    return () => {
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [enabled, token]);
}

