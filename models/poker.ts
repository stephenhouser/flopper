import type { CardT } from "@/lib/cards";

export type Player = {
  id: number;
  name: string;
  role: "Dealer" | "SB" | "BB" | "";
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
  positionLabel?: string;
};

export type Action = "check" | "call" | "fold" | "raise";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

export type HandAction = {
  player: string;
  action: Action;
  amount: number;
  street: Exclude<Street, "complete">;
  timestamp: number;
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
  blinds: {
    smallBlind: number;
    bigBlind: number;
  };
  communityCards: {
    flop?: [CardT, CardT, CardT];
    turn?: CardT;
    river?: CardT;
  };
  actions: HandAction[];
  pot: number;
  result: "folded" | "completed";
  heroWon?: boolean;
};

export type Session = {
  id: string;
  startTime: number;
  hands: HandHistory[];
};
