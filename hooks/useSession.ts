import Storage from "@/lib/storage";
import type { Session } from "@/models/poker";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "poker.currentSession";

export default function useSession() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await Storage.getItem(STORAGE_KEY);
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
    Storage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
  }, [currentSession, ready]);

  const startNewSession = useCallback(() => {
    const session: Session = { id: `session_${Date.now()}`, startTime: Date.now(), hands: [] };
    setCurrentSession(session);
    return session;
  }, []);

  return { currentSession, setCurrentSession, startNewSession, ready } as const;
}
