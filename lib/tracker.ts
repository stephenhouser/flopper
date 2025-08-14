import { getTrackedSessionBySessionId, insertTrackedSession, updateTrackedSession, upsertAttachment } from '@/lib/db';
import { exportSessionToPokerStars } from '@/lib/export/pokerstars';
import type { Session } from '@/models/poker';
import type { GameType } from '@/models/tracker';

function defaultNameFor(game: GameType, startTime?: number) {
  const d = startTime ? new Date(startTime) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = `${game} Trainer ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return name;
}

export async function ensureTrackedSessionForAppSession(session: Session, game: GameType = 'Texas Holdem') {
  const existing = await getTrackedSessionBySessionId(session.id);
  if (existing) return existing.id as string;
  const row = {
    id: `app_${session.id}`,
    date: session.startTime || Date.now(),
    name: defaultNameFor(game, session.startTime),
    game,
    startingStake: 0,
    exitAmount: 0,
    notes: 'Auto-logged app session',
    sessionId: session.id,
    handsPlayed: undefined,
    isRealMoney: false,
  };
  await insertTrackedSession(row);
  return row.id as string;
}

export async function upsertPokerStarsAttachmentForSession(session: Session, game: GameType = 'Texas Holdem') {
  // Only Hold'em supports PokerStars text in this app
  if (game !== 'Texas Holdem') return;
  const trackedId = await ensureTrackedSessionForAppSession(session, game);
  const content = exportSessionToPokerStars(session);
  const att = {
    id: `att_${trackedId}_pokerstars`,
    trackedSessionId: trackedId,
    type: 'pokerstars',
    mime: 'text/plain',
    content,
    createdAt: Date.now(),
  };
  await upsertAttachment(att);
}

// Update handsPlayed (and potentially other derived stats) for a tracked row linked to an app session.
export async function updateHandsPlayedForSession(session: Session, game: GameType = 'Texas Holdem', handsOverride?: number) {
  const trackedId = await ensureTrackedSessionForAppSession(session, game);
  const handsPlayed = typeof handsOverride === 'number' ? handsOverride : (session.hands?.length ?? 0);
  await updateTrackedSession(trackedId, { handsPlayed } as any);
}

// Close out a tracked session for an app session (final sync of hands and attachment)
export async function closeTrackedSessionForAppSession(session: Session, game: GameType = 'Texas Holdem') {
  try {
    await updateHandsPlayedForSession(session, game);
  } catch {}
  try {
    await upsertPokerStarsAttachmentForSession(session, game);
  } catch {}
}
