import type { PrismaClient } from '@prisma/client';

/**
 * Legacy env flag (OR’d with DB `platform_checkout_settings.pos_auto_accept_orders`).
 * Prefer the admin **Pricing → checkout settings** toggle (stored in DB) for day-to-day control.
 */
export function isPosAutoAcceptOrdersEnvEnabled(): boolean {
  const v = (process.env.VYBE_POS_AUTO_ACCEPT_ORDERS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Effective auto-accept: **database OR env** (env keeps older deploys working). */
export async function resolvePosAutoAcceptOrdersEnabled(
  prisma: Pick<PrismaClient, 'platformCheckoutSettings'>,
): Promise<boolean> {
  const row = await prisma.platformCheckoutSettings.findUnique({
    where: { id: 'default' },
    select: { posAutoAcceptOrders: true },
  });
  if (row?.posAutoAcceptOrders === true) return true;
  return isPosAutoAcceptOrdersEnvEnabled();
}
