import { prisma } from '../db.js';
import { env } from '../env.js';

export function billingEnabled(): boolean {
  const v = (env.BILLING_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export async function getBalance(workspaceId: string): Promise<number> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { aiCredits: true } });
  return ws?.aiCredits ?? 0;
}

/** Apply a signed credit change atomically and log a transaction. */
export async function applyCredits(
  workspaceId: string,
  amount: number,
  type: 'topup' | 'usage' | 'bonus' | 'adjustment',
  opts: { reference?: string; note?: string } = {},
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.update({
      where: { id: workspaceId },
      data: { aiCredits: { increment: amount } },
      select: { aiCredits: true },
    });
    await tx.creditTransaction.create({
      data: { workspaceId, type, amount, balanceAfter: ws.aiCredits, reference: opts.reference || null, note: opts.note || null },
    });
    return ws.aiCredits;
  });
}

/**
 * Charge for one AI request. Returns true if allowed (and debited). When billing
 * is off, always allowed and free. When on and out of credits, returns false so
 * the caller can respond with a friendly "top up" message.
 */
export async function meterAI(workspaceId: string | null, note = 'AI request'): Promise<boolean> {
  if (!billingEnabled()) return true;
  if (!workspaceId) return true;
  const cost = env.AI_CREDIT_COST;
  if (cost <= 0) return true;
  const balance = await getBalance(workspaceId);
  if (balance < cost) return false;
  await applyCredits(workspaceId, -cost, 'usage', { note }).catch(() => {});
  return true;
}

export async function history(workspaceId: string, take = 30) {
  return prisma.creditTransaction.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take });
}
