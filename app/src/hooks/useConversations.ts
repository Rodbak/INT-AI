import { useState, useEffect, useCallback } from 'react';
import { fetchConversations, createConversation as apiCreate, deleteConversation as apiDelete } from '../lib/api';
import type { Conversation } from '../types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err?.error || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (title: string) => {
      const conv = await apiCreate(title);
      setConversations((prev) => [conv, ...prev]);
      return conv;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { conversations, loading, error, create, remove, reload: load };
}
