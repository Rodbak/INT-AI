export interface NavItem {
  id: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'current-task', label: 'Current task' },
      { id: 'history', label: 'History' },
    ],
  },
  {
    label: 'Build',
    items: [
      { id: 'specialists', label: 'Specialists' },
      { id: 'ai-teams', label: 'AI Teams' },
      { id: 'automations', label: 'Automations' },
    ],
  },
  {
    label: 'Organize',
    items: [
      { id: 'company-knowledge', label: 'Company Knowledge' },
      { id: 'prompt-library', label: 'Prompt Library' },
      { id: 'connections', label: 'Connections' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { id: 'admin-dashboard', label: 'Admin Dashboard' },
      { id: 'billing-api-keys', label: 'Billing & API Keys' },
    ],
  },
];

export const defaultActiveNavId = 'current-task';

export interface RouteStep {
  role: string;
  task: string;
  model: string;
  status: 'complete' | 'in-progress';
  trace: string;
}

export const routeSteps: RouteStep[] = [
  {
    role: 'Business Consultant',
    task: 'Business strategy & positioning',
    model: 'claude-opus',
    status: 'complete',
    trace: 'evaluated 3 market angles, selected direct-to-consumer positioning',
  },
  {
    role: 'Content Writer',
    task: 'Brand name & copywriting',
    model: 'gpt-4.1',
    status: 'complete',
    trace: 'generated 12 name candidates, drafted tone-of-voice guide',
  },
  {
    role: 'Graphic Designer',
    task: 'Logo & visual identity',
    model: 'imagen-3',
    status: 'complete',
    trace: 'produced 4 logo concepts, refined palette to warm neutrals',
  },
  {
    role: 'Frontend Developer',
    task: 'Landing page build',
    model: 'claude-sonnet',
    status: 'complete',
    trace: 'assembled hero, product grid, and checkout sections',
  },
  {
    role: 'Marketing Strategist',
    task: 'Launch campaign & promo images',
    model: 'gemini-2.5',
    status: 'in-progress',
    trace: 'rendering promo imagery, 3 of 4 assets complete',
  },
];

export const deliverables: string[] = [
  'Brand identity',
  'Landing page',
  'Launch copy',
  'Promo images',
];

export const workspaceOrg = {
  initials: 'MR',
  name: 'Meridian Robotics',
  plan: 'Enterprise plan',
};

export const currentTask = {
  title: 'Launch a new business',
  team: 'Marketing Team',
};

export const userMessage =
  'Launch a new business selling handmade ceramic tableware. Give me strategy, branding, and a landing page.';

export const resultSummary = {
  brand: 'Kiln & Co.',
  before: 'Strategy, brand identity, and a landing page for',
  after: 'are ready — plus 3 promotional images and campaign copy for launch week.',
};

export const routingSummary = {
  specialistCount: 5,
  seconds: 14.2,
};
