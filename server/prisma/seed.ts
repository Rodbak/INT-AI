import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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

async function main() {
  for (const specialist of SPECIALISTS) {
    await prisma.specialist.upsert({
      where: { name: specialist.name },
      update: specialist,
      create: specialist,
    });
  }

  const email = "admin@int-ai.local";
  const passwordHash = await bcrypt.hash("changeme123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "INT AI Admin",
      passwordHash,
      role: "USER",
      emailVerified: new Date(),
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Workspace",
      slug: "default",
      plan: "FREE",
    },
  });

  await prisma.workspaceUser.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "OWNER",
    },
  });

  console.log("Seed complete:", {
    specialists: SPECIALISTS.length,
    user: user.email,
    workspace: workspace.slug,
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
