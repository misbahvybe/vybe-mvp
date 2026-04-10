/** Socket.IO attaches to the API origin (no `/api/v1` path). */
export function getSocketOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return 'http://localhost:4000';
  }
}

/** Polling first works reliably behind Railway/Vercel proxies; upgrades to websocket when possible. */
export const SOCKET_IO_CLIENT_OPTIONS = {
  /** Mutable tuple — `as const` breaks Socket.IO ManagerOptions typing in strict builds. */
  transports: ['polling', 'websocket'] as string[],
};
