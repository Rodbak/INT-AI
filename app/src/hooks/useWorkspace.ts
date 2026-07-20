import { useEffect, useState } from 'react';
import { fetchWorkspaces } from '../lib/api';

interface Workspace {
  id: string;
  name: string;
  plan?: string;
}

// Resolves the current workspace. Auth is single-user for now, so we take the
// first workspace the user belongs to — enough for the mutation endpoints that
// require a workspaceId. Result is cached at module scope so every page that
// needs it doesn't refetch.
let cached: Workspace | null = null;

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    let active = true;
    fetchWorkspaces()
      .then((list) => {
        if (!active) return;
        const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
        if (first) {
          cached = { id: first.id, name: first.name, plan: first.plan };
          setWorkspace(cached);
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { workspace, workspaceId: workspace?.id, loading };
}
