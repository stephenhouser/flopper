import type { CardT } from "@/lib/cards";
import { didHeroWin } from "@/lib/hand-eval";
import type { Settings, Street } from "@/models/poker";
import { MIN_SMALL_BLIND, Player, SMALL_BLIND_FACTOR } from "@/models/poker";

// New: compute position label using Player helper
function positionLabel(pos: number, n: number): string {
  return Player.labelForPos(pos, n);
}

// New: compute blind flags based on table size and position
function blindFlagsFor(n: number, posFromDealer: number): { isSmallBlind: boolean; isBigBlind: boolean } {
  if (n <= 1) return { isSmallBlind: false, isBigBlind: false };
  if (n === 2) {
    // Heads-up special: Dealer is also Big Blind, other is Small Blind
    const isDealer = posFromDealer === 0;
    return { isSmallBlind: !isDealer, isBigBlind: isDealer };
  }
  return { isSmallBlind: posFromDealer === 1, isBigBlind: posFromDealer === 2 };
}

export function assignPositions(n: number, btnIndex: number) {
  return Array.from({ length: n }).map((_, idx) => {
    const pos = (idx - btnIndex + n) % n;
    const { isSmallBlind, isBigBlind } = blindFlagsFor(n, pos);
    return { idx, pos, positionLabel: positionLabel(pos, n), isSmallBlind, isBigBlind, isDealer: pos === 0 };
  });
}

export function rotateToSmallBlindFirst(players: Player[]): Player[] {
  const sbIndex = players.findIndex((p) => p.isSmallBlind);
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
  const positions = assignPositions(n, btnIndex);
  const nextDeck = [...deck];
  const players: Player[] = Array.from({ length: n }).map((_, i) => {
    const c1 = nextDeck.pop();
    const c2 = nextDeck.pop();
    if (!c1 || !c2) throw new Error("Deck exhausted while dealing players");
    const { pos, positionLabel, isSmallBlind, isBigBlind } = positions[i];
    const p = new Player({
      id: i,
      name: i === heroSeat ? "Hero" : `Player ${i + 1}`,
      cards: [c1, c2],
      position: pos,
      nPlayers: n,
    });
    // Attach blind flags
    (p as any).isSmallBlind = isSmallBlind;
    (p as any).isBigBlind = isBigBlind;
    p.isDealer = pos === 0;
    p.positionLabel = positionLabel;
    p.bet = 0;
    p.isHero = i === heroSeat;
    return p;
  });

  // Post blinds
  const sb = smallBlindFromBigBlind(bigBlind);
  const withBlinds = players.map((p) => {
    if ((p as any).isSmallBlind) return { ...p, bet: sb } as Player;
    if ((p as any).isBigBlind) return { ...p, bet: bigBlind } as Player;
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
  return players.map((p) => ({ ...p, bet: 0 } as Player));
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
