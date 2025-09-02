import { CardT } from "@/lib/cards";
import { didHeroWin } from "@/lib/hand-eval";
import type { Settings, Street } from "@/models/poker";
import { defaultStackForBigBlind, MIN_SMALL_BLIND, Player, SMALL_BLIND_FACTOR } from "@/models/poker";

// New: compute blind flags based on table size and position
function blindFlagsFor(n: number, posFromDealer: number): { isSmallBlind: boolean; isBigBlind: boolean } {
  if (n <= 1) return { isSmallBlind: false, isBigBlind: false };
  if (n === 2) {
    // Heads-up special: Dealer is Small Blind, other player is Big Blind
    const isDealer = posFromDealer === 0;
    return { isSmallBlind: isDealer, isBigBlind: !isDealer };
  }
  return { isSmallBlind: posFromDealer === 1, isBigBlind: posFromDealer === 2 };
}

export function assignPositions(n: number, btnIndex: number) {
  return Array.from({ length: n }).map((_, idx) => {
    const pos = (idx - btnIndex + n) % n;
    const { isSmallBlind, isBigBlind } = blindFlagsFor(n, pos);
    return { idx, pos, isSmallBlind, isBigBlind };
  });
}



export function smallBlindFromBigBlind(bb: number): number {
  return Math.max(MIN_SMALL_BLIND, Math.floor(bb * SMALL_BLIND_FACTOR));
}

export function dealPlayers(
  players: Player[],
  deck: CardT[],
  bigBlind: number,
  btnIndex = 0
): { players: Player[]; deck: CardT[] } {
  const n = players.length;
  const positions = assignPositions(n, btnIndex);
  const nextDeck = [...deck];
  
  // Deal new cards to existing players and update their positions
  const dealtPlayers: Player[] = players.map((existingPlayer, i) => {
    const c1 = nextDeck.pop();
    const c2 = nextDeck.pop();
    if (!c1 || !c2) throw new Error("Deck exhausted while dealing players");
    
    const { pos, isSmallBlind, isBigBlind } = positions[i];
    
    // Create new player instance with updated position and fresh cards
    const p = new Player({
      id: existingPlayer.id,
      name: existingPlayer.name,
      cards: [c1, c2],
      position: pos,
      nPlayers: n,
      stack: existingPlayer.stack, // Preserve stack from previous hand
      isHero: existingPlayer.isHero,
    });
    
    // Attach blind flags
    (p as any).isSmallBlind = isSmallBlind;
    (p as any).isBigBlind = isBigBlind;
    p.bet = 0;
    return p;
  });

  // Post blinds - use placeBet to deduct from stack
  const sb = smallBlindFromBigBlind(bigBlind);
  const withBlinds = dealtPlayers.map((p) => {
    if ((p as any).isSmallBlind) return placeBet(p, sb);
    if ((p as any).isBigBlind) return placeBet(p, bigBlind);
    return p;
  });

  return { players: withBlinds, deck: nextDeck };
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

// Helper to create initial player array with default stacks (100 big blinds)
export function createInitialPlayers(
  n: number,
  heroSeat = 0,
  bigBlind = 2
): Player[] {
  const stackSize = defaultStackForBigBlind(bigBlind);
  return Array.from({ length: n }).map((_, i) => {
    // Create dummy cards (will be replaced when dealing)
    const dummyCards: [CardT, CardT] = [
      new CardT("A", "♠"),
      new CardT("K", "♥")
    ];
    
    return new Player({
      id: i,
      name: i === heroSeat ? "Hero" : `Player ${i + 1}`,
      cards: dummyCards,
      position: i, // Initial position, will be updated when dealing
      nPlayers: n,
      stack: stackSize,
      isHero: i === heroSeat,
    });
  });
}

// Stack management utilities
export function deductBetFromStack(player: Player, betAmount: number): Player {
  const newStack = Math.max(0, player.stack - betAmount);
  const newPlayer = new Player({
    id: player.id,
    name: player.name,
    cards: player.cards,
    position: player.position,
    nPlayers: player.nPlayers,
    bet: player.bet + betAmount,
    isHero: player.isHero,
    folded: player.folded,
    stack: newStack,
  });
  // Preserve blind flags
  (newPlayer as any).isSmallBlind = player.isSmallBlind;
  (newPlayer as any).isBigBlind = player.isBigBlind;
  return newPlayer;
}

export function awardPotToWinner(player: Player, potAmount: number): Player {
  const newPlayer = new Player({
    id: player.id,
    name: player.name,
    cards: player.cards,
    position: player.position,
    nPlayers: player.nPlayers,
    bet: player.bet,
    isHero: player.isHero,
    folded: player.folded,
    stack: player.stack + potAmount,
  });
  // Preserve blind flags
  (newPlayer as any).isSmallBlind = player.isSmallBlind;
  (newPlayer as any).isBigBlind = player.isBigBlind;
  return newPlayer;
}

export function canPlayerAfford(player: Player, betAmount: number): boolean {
  return player.stack >= betAmount;
}

// Helper function to place a bet and deduct from stack
export function placeBet(player: Player, betAmount: number): Player {
  const currentBet = player.bet || 0;
  const additionalBet = Math.max(0, betAmount - currentBet);
  
  if (additionalBet === 0) {
    return player; // No additional bet needed
  }
  
  // Don't allow betting more than the stack (all-in protection)
  const actualBet = Math.min(additionalBet, player.stack);
  const totalBet = currentBet + actualBet;
  
  const newPlayer = new Player({
    id: player.id,
    name: player.name,
    cards: player.cards,
    position: player.position,
    nPlayers: player.nPlayers,
    bet: totalBet,
    isHero: player.isHero,
    folded: player.folded,
    stack: player.stack - actualBet,
  });
  
  // Preserve blind flags
  (newPlayer as any).isSmallBlind = (player as any).isSmallBlind;
  (newPlayer as any).isBigBlind = (player as any).isBigBlind;
  
  return newPlayer;
}
