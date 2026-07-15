import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    name: "Claude Opus 4",
    provider: "anthropic",
    description: "Most powerful model for complex reasoning and creative tasks",
    contextWindow: 200000,
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
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
  });
  console.log(
    "Note: no demo user was seeded — sign in once via Google, then run " +
      "`UPDATE profiles SET role = 'admin' WHERE email = '<your-email>';` " +
      "to grant admin access, and join the default workspace via a WorkspaceUser row if needed.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
