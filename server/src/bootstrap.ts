import { prisma } from './db.js';
import { env } from './env.js';

// Guarantees the demo user's profile + a workspace + membership exist, so the
// app works on a freshly-reset or brand-new database and chat's Conversation
// foreign key never fails. Runs once per instance (cached promise).
let ready: Promise<void> | null = null;

async function doEnsure(): Promise<void> {
  // 1. Demo profile row (Conversation.userId → profiles.id FK).
  await prisma.user.upsert({
    where: { id: env.DEMO_USER_ID },
    update: {},
    create: { id: env.DEMO_USER_ID, email: env.DEMO_USER_EMAIL, name: 'Owner', role: 'admin' },
  });

  // 2. At least one workspace, with the demo user as a member.
  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: 'My Shop', slug: `shop-${Math.random().toString(36).slice(2, 8)}`, plan: 'FREE' },
      select: { id: true },
    });
  }
  const membership = await prisma.workspaceUser.findFirst({
    where: { userId: env.DEMO_USER_ID, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!membership) {
    await prisma.workspaceUser.create({
      data: { userId: env.DEMO_USER_ID, workspaceId: workspace.id, role: 'OWNER' },
    });
  }
}

export function ensureDemoContext(): Promise<void> {
  if (!ready) ready = doEnsure().catch((e) => {
    // Reset so a later request can retry (e.g. transient DB hiccup on cold start).
    ready = null;
    throw e;
  });
  return ready;
}
