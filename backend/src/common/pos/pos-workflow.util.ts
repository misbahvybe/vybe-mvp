/**
 * POS / kitchen workflow flags (env). Keep **off** in production until hardware + print path are verified.
 *
 * - `VYBE_POS_AUTO_ACCEPT_ORDERS`: new orders go straight to `STORE_ACCEPTED` (no store Accept/Reject tap).
 */
export function isPosAutoAcceptOrdersEnabled(): boolean {
  const v = (process.env.VYBE_POS_AUTO_ACCEPT_ORDERS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
