export interface LiveMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'done' | 'error';
}

export interface Workspace {
  id: string;
  name: string;
}

export interface SpecialistRef {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  specialist: SpecialistRef;
}

export interface AITeam {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  workspace: Workspace;
}

export type AutomationTrigger = 'webhook' | 'schedule' | 'manual';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  active: boolean;
  workspace: Workspace;
}
