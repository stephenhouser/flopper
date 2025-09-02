import type { CardT } from "@/lib/cards";

// Player seating is now modeled by numeric table position relative to the button (Dealer)
// position: 0 = Dealer (BTN), 1 = SB, 2 = BB, 3 = UTG, ...
export class Player {
  id: number;
  name: string;
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
  // Numeric position from the dealer (0 = Dealer/BTN)
  position: number;
  // Total players at table (used for HU blind rules)
  nPlayers: number;
  // Blind flags (computed from nPlayers + position)
  isSmallBlind: boolean;
  isBigBlind: boolean;
  // Whether the player has folded this hand
  folded?: boolean;
  // Player's chip stack (persists across hands)
  stack: number;
  // Last action taken by this player
  lastAction?: Action;
  // Whether this player is the dealer
  isDealer: boolean;
  // Position labels for this player (Dealer, SB, BB, UTG, etc.)
  labels: string[];

  constructor(params: {
    id: number;
    name: string;
    cards: [CardT, CardT];
    position: number; // 0 = Dealer/BTN
    nPlayers: number;
    dealerPosition: number; // Current dealer position
    bet?: number;
    isHero?: boolean;
    folded?: boolean;
    stack?: number;
    lastAction?: Action;
  }) {
    const { id, name, cards, position, nPlayers, dealerPosition, bet = 0, isHero = false, folded, stack = DEFAULT_STACK, lastAction } = params;
    this.id = id;
    this.name = name;
    this.cards = cards;
    this.position = position;
    this.nPlayers = nPlayers;
    this.stack = stack;
    
    // Compute dealer status
    this.isDealer = position === dealerPosition;
    
    // Compute position labels
    this.labels = labelsForPosition(position, dealerPosition, nPlayers);
    
    // Compute blind flags (HU: dealer is BB, other is SB; 3+ players: SB=1, BB=2)
    if (nPlayers === 2) {
      this.isSmallBlind = position === 1;
      this.isBigBlind = position === 0;
    } else {
      this.isSmallBlind = position === 1;
      this.isBigBlind = position === 2;
    }
    this.bet = bet;
    this.isHero = isHero;
    this.folded = folded;
    this.lastAction = lastAction;
  }

  // Convenience getters
  get isSB(): boolean { return this.isSmallBlind; }
  get isBB(): boolean { return this.isBigBlind; }
}

// Position utility functions (moved from Player class)
export function labelsForPosition(position: number, dealerPosition: number, nPlayers: number): string[] {
  const labels: string[] = [];
  
  // Calculate position relative to dealer
  const posFromDealer = (position - dealerPosition + nPlayers) % nPlayers;
  
  // Add dealer label
  if (posFromDealer === 0) {
    labels.push("Dealer");
  }
  
  // Add blind labels based on table size and position
  if (nPlayers === 2) {
    // Heads-up: dealer is also big blind, other is small blind
    if (posFromDealer === 0) labels.push("BB");
    if (posFromDealer === 1) labels.push("SB");
    return labels;
  } else if (posFromDealer > 0) {
    // 3+ players: standard blind positions
    // Add position labels for non-dealer, non-blind seats
    const positionNames = ["SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"];
    const positionIndex = posFromDealer - 1;
    const positionName = positionNames[positionIndex] || `Seat ${posFromDealer + 1}`;
    
    labels.push(positionName);
  }
  
  return labels;
}

export function positionBadgeStyle(label?: string) {
  switch (label) {
    case "Dealer": return { backgroundColor: "#EDE2FF" };
    case "SB":     return { backgroundColor: "#D7E8FF" };
    case "BB":     return { backgroundColor: "#FFE8C7" };
    case "UTG":    return { backgroundColor: "#E6F6EB" };
    case "UTG+1":  return { backgroundColor: "#E3F4FF" };
    case "MP":     return { backgroundColor: "#FFF5CC" };
    case "LJ":     return { backgroundColor: "#FDE2F2" };
    case "HJ":     return { backgroundColor: "#E0E7FF" };
    case "CO":     return { backgroundColor: "#ECECEC" };
    default:        return { backgroundColor: "#F1F1F6" };
  }
}

export type Action = "check" | "call" | "fold" | "raise";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

export type Result = "folded" | "completed";

export type HandAction = {
  player: string;
  action: Action;
  amount: number;
  street: Exclude<Street, "complete">;
  timestamp: number;
};

export type Blinds = {
  smallBlind: number;
  bigBlind: number;
};

export const SMALL_BLIND_FACTOR = 0.5;
export const MIN_SMALL_BLIND = 1;
export const DEFAULT_STACK_BB_MULTIPLIER = 100; // 100 big blinds
// Function to calculate default stack based on big blind
export const defaultStackForBigBlind = (bigBlind: number) => bigBlind * DEFAULT_STACK_BB_MULTIPLIER;
export const smallBlindFromBigBlind = (bb: number) =>
  Math.max(MIN_SMALL_BLIND, Math.floor(bb * SMALL_BLIND_FACTOR));

export type CommunityCards = CardT[];

export type HandHistory = {
  handId: string;
  timestamp: number;
  players: Array<{
    name: string;
    position: string;
    cards: [CardT, CardT];
    isHero: boolean;
  }>;
  blinds: Blinds;
  communityCards: CommunityCards;
  actions: HandAction[];
  pot: number;
  result: Result;
  heroWon?: boolean;
};

export type Session = {
  id: string;
  startTime: number;
  hands: HandHistory[];
};

// Centralized settings used by gameplay and UI
export type Settings = {
  showFlop: boolean;
  showTurn: boolean;
  showRiver: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  showFlop: false,
  showTurn: true,
  showRiver: true,
};

// Trainer-level settings (superset of gameplay Settings)
export type TexasHoldemSettings = Settings & {
  autoNew: boolean;
  facingRaise: boolean;
  showFeedback: boolean;
  feedbackSecs: number; // seconds
  showScore: boolean;
  showCommunityCards: boolean;
  // persisted table config
  numPlayers: number;
  bigBlind: number;
};

export const DEFAULT_TRAINER_SETTINGS: TexasHoldemSettings = {
  ...DEFAULT_SETTINGS,
  autoNew: true,
  facingRaise: false,
  showFeedback: true,
  feedbackSecs: 1.0,
  showScore: true,
  showCommunityCards: false,
  numPlayers: 6,
  bigBlind: 2,
};

export const DEFAULT_BLINDS: Blinds = { smallBlind: 1, bigBlind: 2 };

export const STREET_ORDER: ReadonlyArray<Street> = [
  "preflop",
  "flop",
  "turn",
  "river",
  "complete",
] as const;

export const HAND_STATE_MACHINE: Readonly<Record<Street, Street>> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: "complete",
  complete: "complete",
};

// Optional board representation for engine state (array-based community cards)
export type Board = CardT[];

export type GameState = {
  players: Player[];
  deck: CardT[];
  street: Street;
  pot: number;
  board: Board;
};

// App-wide constraints and defaults for table configuration
export const MIN_PLAYERS = 2 as const;
export const MAX_PLAYERS = 9 as const;
export const DEFAULT_NUM_PLAYERS = DEFAULT_TRAINER_SETTINGS.numPlayers;

export const MIN_BIG_BLIND = 1 as const;
export const DEFAULT_BIG_BLIND = DEFAULT_TRAINER_SETTINGS.bigBlind;

// Default stack size: 100 big blinds
export const DEFAULT_STACK = defaultStackForBigBlind(DEFAULT_BIG_BLIND);

// Storage keys
export const SETTINGS_STORAGE_KEY = "poker.trainerSettings.v1" as const;
export const SESSION_STORAGE_KEY = "poker.currentSession" as const;
