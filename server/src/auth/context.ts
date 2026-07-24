import { prisma } from '../db.js';
import { env } from '../env.js';
import { billingEnabled, applyCredits } from '../billing/wallet.js';

// Ensures a signed-in user has a profile row and their OWN shop (workspace +
// OWNER membership). Called on authenticated requests so a brand-new sign-up
// lands in a working, isolated shop. Cached per-user per instance.
const done = new Set<string>();

export async function ensureUserContext(userId: string, email: string, name?: string, shopName?: string): Promise<void> {
  if (done.has(userId)) return;

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email, name: name || email.split('@')[0] || 'Owner', role: 'user' },
  });

  // Does this user already belong to a workspace?
  const membership = await prisma.workspaceUser.findFirst({ where: { userId }, select: { id: true } });
  if (!membership) {
    const wsName = (shopName && shopName.trim()) || (name ? `${name}'s shop` : 'My Shop');
    const workspace = await prisma.workspace.create({
      data: { name: wsName, slug: `shop-${Math.random().toString(36).slice(2, 9)}`, plan: 'FREE' },
      select: { id: true },
    });
    await prisma.workspaceUser.create({ data: { userId, workspaceId: workspace.id, role: 'OWNER' } });
    // Welcome credits so a new shop can try INT's AI features right away.
    if (billingEnabled() && env.SIGNUP_BONUS_CREDITS > 0) {
      await applyCredits(workspace.id, env.SIGNUP_BONUS_CREDITS, 'bonus', { note: 'Welcome bonus' }).catch(() => {});
    }
  }

  done.add(userId);
}
