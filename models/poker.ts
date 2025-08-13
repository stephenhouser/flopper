import type { CardT } from "@/lib/cards";

// Roles for seats relative to the button
export type Role = "Dealer" | "SB" | "BB" | "";

export type Player = {
  id: number;
  name: string;
  role: Role;
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
  positionLabel?: string;
};

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

export type CommunityCards = {
  flop?: [CardT, CardT, CardT];
  turn?: CardT;
  river?: CardT;
};

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
  facingRaise: true,
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

// Optional board representation for engine state
export type Board = {
  flop: [CardT, CardT, CardT] | null;
  turn: CardT | null;
  river: CardT | null;
};

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
