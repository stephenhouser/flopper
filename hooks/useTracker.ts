import { deleteTrackedSession, insertTrackedSession, listTrackedSessions, updateTrackedSession } from '@/lib/db';
import type { TrackedSession } from '@/models/tracker';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useTracker() {
  const [sessions, setSessions] = useState<TrackedSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await listTrackedSessions();
      setSessions(rows as unknown as TrackedSession[]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (s: Omit<TrackedSession, 'id' | 'date'> & { date?: number }) => {
    const id = s.sessionId ? `app_${s.sessionId}` : `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row: TrackedSession = {
      id,
      date: s.date ?? Date.now(),
      name: s.name,
      game: s.game,
      startingStake: s.startingStake,
      exitAmount: s.exitAmount,
      notes: s.notes,
      sessionId: s.sessionId ?? null,
    } as TrackedSession;
    await insertTrackedSession(row as any);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteTrackedSession(id);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<Omit<TrackedSession, 'id'>>) => {
    await updateTrackedSession(id, patch as any);
    await refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    // naive clear: delete all visible
    await Promise.all(sessions.map(s => deleteTrackedSession(s.id)));
    await refresh();
  }, [sessions, refresh]);

  const totals = useMemo(() => {
    const count = sessions.length;
    const net = sessions.reduce((acc, s) => acc + (s.exitAmount - s.startingStake), 0);
    return { count, net } as const;
  }, [sessions]);

  return { sessions, add, remove, update, clear, totals, loaded, refresh } as const;
}
