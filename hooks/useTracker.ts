import { deleteTrackedSession, insertTrackedSession, listTrackedSessions, updateTrackedSession } from '@/lib/db';
import { on, TrackerEvents } from '@/lib/events';
import type { TrackedSession } from '@/models/tracker';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useTracker() {
  const [sessions, setSessions] = useState<TrackedSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await listTrackedSessions();
      const normalized = (rows as any[]).map((r) => ({
        ...r,
        // normalize SQLite 0/1 to boolean
        isRealMoney: r.isRealMoney === 1 || r.isRealMoney === true ? true : (r.isRealMoney === 0 ? false : (r.isRealMoney ?? false)),
        handsPlayed: typeof r.handsPlayed === 'string' ? parseInt(r.handsPlayed, 10) : r.handsPlayed,
        attachmentIds: Array.isArray(r.attachmentIds) ? r.attachmentIds : (r.attachmentIds ? r.attachmentIds : []),
      })) as TrackedSession[];
      setSessions(normalized);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh when DB changes (new sessions, updates, attachments)
  useEffect(() => {
    const off1 = on(TrackerEvents.SessionsChanged, () => { refresh(); });
    const off2 = on(TrackerEvents.AttachmentsChanged, () => { /* could refresh to update HH status */ });
    return () => { off1(); off2(); };
  }, [refresh]);

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
      handsPlayed: s.handsPlayed,
      isRealMoney: s.isRealMoney ?? false,
      attachmentIds: s.attachmentIds ?? [],
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
    const realSessions = sessions.filter(s => s.isRealMoney === true);
    const playSessions = sessions.filter(s => s.isRealMoney !== true);
    const real = {
      count: realSessions.length,
      net: realSessions.reduce((acc, s) => acc + (s.exitAmount - s.startingStake), 0),
    } as const;
    const play = {
      count: playSessions.length,
      net: playSessions.reduce((acc, s) => acc + (s.exitAmount - s.startingStake), 0),
    } as const;
    return { count, net, real, play } as const;
  }, [sessions]);

  return { sessions, add, remove, update, clear, totals, loaded, refresh } as const;
}
