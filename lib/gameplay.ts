import type { CardT } from "@/lib/cards";
import { didHeroWin } from "@/lib/hand-eval";
import { labelForPos } from "@/lib/positions";
import type { Player, Street, Settings } from "@/models/poker";
import { SMALL_BLIND_FACTOR, MIN_SMALL_BLIND } from "@/models/poker";

// New: explicit community type used by some helpers
export type Community = {
  flop: [CardT, CardT, CardT] | null;
  turn: CardT | null;
  river: CardT | null;
};

export function assignRolesAndPositions(n: number, btnIndex: number) {
  return Array.from({ length: n }).map((_, idx) => {
    const pos = (idx - btnIndex + n) % n;
    let role: Player["role"] = "";
    if (pos === 0) role = "Dealer";
    else if (pos === 1) role = "SB";
    else if (pos === 2) role = "BB";
    return { idx, pos, role, positionLabel: labelForPos(pos, n) };
  });
}

export function rotateToSmallBlindFirst(players: Player[]): Player[] {
  const sbIndex = players.findIndex((p) => p.role === "SB");
  return sbIndex >= 0 ? [...players.slice(sbIndex), ...players.slice(0, sbIndex)] : players;
}

export function smallBlindFromBigBlind(bb: number): number {
  return Math.max(MIN_SMALL_BLIND, Math.floor(bb * SMALL_BLIND_FACTOR));
}

export function dealPlayers(
  n: number,
  deck: CardT[],
  bigBlind: number,
  heroSeat = 0,
  btnIndex = 0
): { players: Player[]; deck: CardT[] } {
  const roles = assignRolesAndPositions(n, btnIndex);
  const nextDeck = [...deck];
  const players: Player[] = Array.from({ length: n }).map((_, i) => {
    const c1 = nextDeck.pop();
    const c2 = nextDeck.pop();
    if (!c1 || !c2) throw new Error("Deck exhausted while dealing players");
    const { role, positionLabel } = roles[i];
    const p: Player = {
      id: i,
      name: i === heroSeat ? "Hero" : `Player ${i + 1}`,
      role,
      bet: 0,
      cards: [c1, c2],
      isHero: i === heroSeat,
      positionLabel,
    };
    return p;
  });

  // Post blinds
  const sb = smallBlindFromBigBlind(bigBlind);
  const withBlinds = players.map((p) => {
    if (p.role === "SB") return { ...p, bet: sb };
    if (p.role === "BB") return { ...p, bet: bigBlind };
    return p;
  });

  // Rotate so SB is first (matches existing UI expectations)
  const rotated = rotateToSmallBlindFirst(withBlinds);

  return { players: rotated, deck: nextDeck };
}

export function collectBets(players: Player[]): number {
  return players.reduce((sum, p) => sum + (p.bet || 0), 0);
}

export function resetBets(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, bet: 0 }));
}

export function totalPot(pot: number, players: Player[]): number {
  return pot + collectBets(players);
}

export function minRaise(currentBet: number, bigBlind: number): number {
  return currentBet === 0 ? bigBlind : currentBet + Math.max(currentBet, bigBlind);
}

export function nextStreet(current: Street, settings: Settings): Street {
  const { showFlop, showTurn, showRiver } = settings;
  if (current === "preflop") return showFlop ? "flop" : "complete";
  if (current === "flop") return showTurn ? "turn" : "complete";
  if (current === "turn") return showRiver ? "river" : "complete";
  if (current === "river") return "complete";
  return "complete";
}

export function computeHeroResult(
  hero: Player | undefined,
  players: Player[],
  community: CardT[]
): boolean | undefined {
  if (!hero) return undefined;
  const others = players.filter((p) => !p.isHero);
  return didHeroWin(hero, others, community);
}

// New: settle all outstanding bets into the pot and reset player bets to 0
export function settleBetsIntoPot(pot: number, players: Player[]): { pot: number; players: Player[] } {
  const allBets = collectBets(players);
  const newPot = pot + allBets;
  const cleared = resetBets(players);
  return { pot: newPot, players: cleared };
}

// New: deal helpers for community streets (no burn for parity with current UI)
export function dealFlopFromDeck(deck: CardT[]): { flop: [CardT, CardT, CardT]; deck: CardT[] } {
  const next = [...deck];
  const c1 = next.pop();
  const c2 = next.pop();
  const c3 = next.pop();
  if (!c1 || !c2 || !c3) throw new Error("Deck exhausted while dealing flop");
  return { flop: [c1, c2, c3], deck: next };
}

export function dealTurnFromDeck(deck: CardT[]): { turn: CardT; deck: CardT[] } {
  const next = [...deck];
  const c = next.pop();
  if (!c) throw new Error("Deck exhausted while dealing turn");
  return { turn: c, deck: next };
}

export function dealRiverFromDeck(deck: CardT[]): { river: CardT; deck: CardT[] } {
  const next = [...deck];
  const c = next.pop();
  if (!c) throw new Error("Deck exhausted while dealing river");
  return { river: c, deck: next };
}
