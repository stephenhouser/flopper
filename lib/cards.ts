export type Suit = "♠" | "♥" | "♦" | "♣";
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export type Rank = typeof RANKS[number];

// Convert CardT to a class with helper instance methods
export class CardT {
  constructor(public rank: Rank, public suit: Suit) {}

  cardToStr(): string {
    return `${this.rank}${this.suit}`;
  }

  cardToPokerStarsStr(): string {
    const suitMap: Record<Suit, string> = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" };
    return `${this.rank}${suitMap[this.suit]}`;
  }
}

export function makeDeck(): CardT[] {
  const d: CardT[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push(new CardT(r, s));
  return d;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
