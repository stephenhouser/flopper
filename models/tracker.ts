export type GameType = 'Texas Holdem' | 'Omaha' | 'Blackjack' | 'Other';

export type TrackedSession = {
  id: string;
  date: number; // epoch millis
  name: string;
  game: GameType;
  startingStake: number; // buy-in or starting bank roll
  exitAmount: number; // cash out / ending bank roll
  notes?: string;
  // Optional link to an in-app session id for auto-logged sessions
  sessionId?: string | null;
};

export type SessionAttachment = {
  id: string;
  trackedSessionId: string;
  type: 'pokerstars' | 'csv' | 'text' | 'json';
  mime: string; // e.g. text/plain
  content: string; // serialized content
  createdAt: number; // epoch millis
};

export const TRACKER_STORAGE_KEY = 'tracker.sessions.v1' as const;
