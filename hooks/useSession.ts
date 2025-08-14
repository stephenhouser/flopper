import Storage from "@/lib/storage";
import { ensureTrackedSessionForAppSession, upsertPokerStarsAttachmentForSession } from "@/lib/tracker";
import type { Session } from "@/models/poker";
import { SESSION_STORAGE_KEY } from "@/models/poker";
import type { GameType } from "@/models/tracker";
import { useCallback, useEffect, useState } from "react";

export function useSession(game: GameType = 'Texas Holdem') {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Storage.getItem(SESSION_STORAGE_KEY).then((raw) => {
      try { setCurrentSession(raw ? JSON.parse(raw) : null); } catch { setCurrentSession(null); }
    }).finally(() => setReady(true));
  }, []);

  const startNewSession = useCallback(() => {
    const session: Session = { id: `session_${Date.now()}` , startTime: Date.now(), hands: [] };
    setCurrentSession(session);
    // Ensure there is a tracker row for this app session
    ensureTrackedSessionForAppSession(session, game).catch(() => {});
    // And create initial attachment if applicable
    upsertPokerStarsAttachmentForSession(session, game).catch(() => {});
    return session;
  }, [game]);

  return { currentSession, setCurrentSession, startNewSession, ready } as const;
}
