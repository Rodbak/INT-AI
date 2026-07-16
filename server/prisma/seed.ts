import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_ID = process.env.DEMO_USER_ID || "00000000-0000-0000-0000-000000000000";
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || "demo@example.com";

const SPECIALISTS = [
  {
    name: "Researcher",
    role: "Deep research and synthesis",
    description:
      "Specialist focused on gathering, cross-referencing, and synthesizing information from connected docs and the web.",
    model: "claude-opus-4-8",
    capabilities: ["web_search", "doc_search", "summarization"],
    active: true,
  },
  {
    name: "Architect",
    role: "Systems and code architecture",
    description:
      "Specialist that designs system structure, evaluates trade-offs, and produces implementation plans.",
    model: "claude-opus-4-8",
    capabilities: ["code_analysis", "planning", "diagramming"],
    active: true,
  },
  {
    name: "Writer",
    role: "Content and copywriting",
    description:
      "Specialist that drafts, edits, and refines written content for clarity and tone.",
    model: "claude-opus-4-8",
    capabilities: ["drafting", "editing", "tone_adaptation"],
    active: true,
  },
  {
    name: "Analyst",
    role: "Data and metrics analysis",
    description:
      "Specialist that analyzes datasets, builds metrics, and surfaces actionable insights.",
    model: "claude-opus-4-8",
    capabilities: ["data_analysis", "visualization", "forecasting"],
    active: true,
  },
];

const MODELS = [
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    description: "Most powerful model for complex reasoning and creative tasks",
    contextWindow: 1000000,
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 25.0,
    capabilities: ["text", "vision", "tool_use", "reasoning"],
    active: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Versatile flagship model with strong reasoning and vision",
    contextWindow: 128000,
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 15.0,
    capabilities: ["text", "vision", "tool_use", "reasoning"],
    active: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Fast, efficient model with strong multimodal capabilities",
    contextWindow: 1000000,
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    capabilities: ["text", "vision", "tool_use", "reasoning"],
    active: true,
  },
];

const BILLING_PLANS = [
  {
    name: "Free",
    description: "For individuals exploring AI-powered workflows",
    price: 0,
    interval: "month",
    features: ["5 conversations/month", "Basic models", "1 workspace", "Email support"],
    active: true,
  },
  {
    name: "Pro",
    description: "For power users who need unlimited access",
    price: 29,
    interval: "month",
    features: ["Unlimited conversations", "All models", "5 workspaces", "Priority support", "Custom specialists"],
    active: true,
  },
  {
    name: "Enterprise",
    description: "For teams with advanced security and control needs",
    price: 99,
    interval: "month",
    features: ["Unlimited everything", "SSO/SAML", "Dedicated support", "Custom integrations", "Audit logs"],
    active: true,
  },
];

async function main() {
  for (const specialist of SPECIALISTS) {
    await prisma.specialist.upsert({
      where: { name: specialist.name },
      update: specialist,
      create: specialist,
    });
  }

  for (const model of MODELS) {
    await prisma.model.upsert({
      where: { id: model.id },
      update: model,
      create: model,
    });
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Workspace",
      slug: "default",
      plan: "FREE",
    },
  });

  // middleware/auth.ts currently has real auth checks disabled and attaches this
  // fixed demo user (id from DEMO_USER_ID) to every request. profiles has a real
  // foreign key to Supabase's auth.users, so this upsert only succeeds once a
  // matching auth.users row exists — see DEPLOYMENT.md for how to create one via
  // the Supabase dashboard. Without it, sending the first chat message fails
  // with a foreign key violation because the conversation has nowhere to attach.
  const demoUser = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: "Demo User",
      role: "admin",
    },
  });

  await prisma.workspaceUser.upsert({
    where: { userId_workspaceId: { userId: demoUser.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: demoUser.id, workspaceId: workspace.id, role: "OWNER" },
  });

  // Once real Supabase Auth is wired back up (see middleware/auth.ts and
  // app/src/lib/auth.ts, both currently stubbed), real users get a profiles row
  // automatically via the handle_new_user trigger and can be granted workspace
  // access with:
  //   INSERT INTO "WorkspaceUser" (id, userId, workspaceId, role, createdAt, updatedAt)
  //   VALUES (gen_random_uuid(), '<user-uuid-from-auth.users>', '${workspace.id}', 'OWNER', NOW(), NOW())
  //   ON CONFLICT (userId_workspaceId) DO NOTHING;

  for (const plan of BILLING_PLANS) {
    await prisma.billingPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log("Seed complete:", {
    specialists: SPECIALISTS.length,
    models: MODELS.length,
    workspace: workspace.slug,
    billingPlans: BILLING_PLANS.length,
    demoUser: demoUser.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
