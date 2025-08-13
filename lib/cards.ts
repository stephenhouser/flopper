export type Suit = "♠" | "♥" | "♦" | "♣";
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export type Rank = typeof RANKS[number];

export type CardT = { rank: Rank; suit: Suit };

export function makeDeck(): CardT[] {
  const d: CardT[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
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

export function cardToStr(c?: CardT) {
  return c ? `${c.rank}${c.suit}` : "";
}

export function cardToPokerStarsStr(c?: CardT) {
  if (!c) return "";
  const suitMap: Record<Suit, string> = { "♠": "s", "♥": "h", "♦": "d", "♣": "c" };
  return `${c.rank}${suitMap[c.suit]}`;
}
