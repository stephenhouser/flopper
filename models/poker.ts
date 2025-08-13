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
