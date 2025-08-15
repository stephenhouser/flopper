import type { CardT } from "@/lib/cards";

// Player seating is now modeled by numeric table position relative to the button (Dealer)
// position: 0 = Dealer (BTN), 1 = SB, 2 = BB, 3 = UTG, ...
export class Player {
  id: number;
  name: string;
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
  // New: numeric position from the dealer (0 = Dealer/BTN)
  position: number;
  // New: convenience flag (derived from position === 0)
  isDealer: boolean;
  // Cached label for UI (e.g. Dealer, SB, BB, UTG, UTG+1, ...)
  positionLabel?: string;
  // Whether the player has folded this hand
  folded?: boolean;

  constructor(params: {
    id: number;
    name: string;
    cards: [CardT, CardT];
    position: number; // 0 = Dealer/BTN
    nPlayers: number;
    bet?: number;
    isHero?: boolean;
    folded?: boolean;
  }) {
    const { id, name, cards, position, nPlayers, bet = 0, isHero = false, folded } = params;
    this.id = id;
    this.name = name;
    this.cards = cards;
    this.position = position;
    this.isDealer = position === 0;
    this.positionLabel = Player.labelForPos(position, nPlayers);
    this.bet = bet;
    this.isHero = isHero;
    this.folded = folded;
  }

  // Convenience getters
  get isSB(): boolean { return this.position === 1; }
  get isBB(): boolean { return this.position === 2; }

  // Static helpers (integrated from lib/positions.ts)
  static labelForPos(posFromDealer: number, n: number): string {
    if (posFromDealer === 0) return "Dealer"; // BTN
    if (posFromDealer === 1) return "SB";
    if (posFromDealer === 2) return "BB";
    const rest = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO"];
    return rest[posFromDealer - 3] || `Seat ${posFromDealer}`;
  }

  static positionBadgeStyle(label?: string) {
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
export type TrainerSettings = Settings & {
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

export const DEFAULT_TRAINER_SETTINGS: TrainerSettings = {
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

// Storage keys
export const SETTINGS_STORAGE_KEY = "poker.trainerSettings.v1" as const;
export const SESSION_STORAGE_KEY = "poker.currentSession" as const;
