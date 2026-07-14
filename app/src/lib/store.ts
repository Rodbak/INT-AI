import { create } from 'zustand';
import type { User, Conversation, Message, ModelOption } from '../types';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  workspace: {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
  } | null;
  setWorkspace: (workspace: { id: string; name: string; plan: 'free' | 'pro' | 'enterprise' } | null) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  ui: {
    sidebarOpen: boolean;
    modelSelectorOpen: boolean;
    isStreaming: boolean;
  };
  toggleSidebar: () => void;
  toggleModelSelector: () => void;
  setStreaming: (streaming: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    })),
  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
    })),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  ui: {
    sidebarOpen: false,
    modelSelectorOpen: false,
    isStreaming: false,
  },
  toggleSidebar: () =>
    set((state) => ({
      ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
    })),
  toggleModelSelector: () =>
    set((state) => ({
      ui: { ...state.ui, modelSelectorOpen: !state.ui.modelSelectorOpen },
    })),
  setStreaming: (isStreaming) =>
    set((state) => ({
      ui: { ...state.ui, isStreaming },
    })),
}));
