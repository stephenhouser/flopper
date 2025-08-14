import Storage from "@/lib/storage";
import type { Session } from "@/models/poker";
import { SESSION_STORAGE_KEY } from "@/models/poker";
import { useCallback, useEffect, useState } from "react";

export function useSession() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await Storage.getItem(SESSION_STORAGE_KEY);
        if (json && !cancelled) setCurrentSession(JSON.parse(json) as Session);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (currentSession == null) return;
    Storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
  }, [currentSession, ready]);

  const startNewSession = useCallback(() => {
    const session: Session = { id: `session_${Date.now()}` , startTime: Date.now(), hands: [] };
    setCurrentSession(session);
    return session;
  }, []);

  return { currentSession, setCurrentSession, startNewSession, ready } as const;
}
