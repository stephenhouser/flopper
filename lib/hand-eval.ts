import type { CardT, Rank } from "./cards";

function getRankValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14
  };
  return values[rank];
}

export function evaluateHand(holeCards: [CardT, CardT], communityCards: CardT[]): number {
  const allCards = [...holeCards, ...communityCards];
  const ranks: Record<string, number> = {};
  const suits: Record<string, number> = {};

  allCards.forEach((card) => {
    ranks[card.rank] = (ranks[card.rank] || 0) + 1;
    suits[card.suit] = (suits[card.suit] || 0) + 1;
  });

  const rankCounts: number[] = Object.keys(ranks)
    .map((k) => ranks[k])
    .sort((a: number, b: number) => b - a);
  const suitCounts: number[] = Object.keys(suits).map((k) => suits[k]);
  const isFlush = suitCounts.some((count: number) => count >= 5);

  const uniqueRanks: number[] = Object.keys(ranks)
    .map((rank) => getRankValue(rank as Rank))
    .sort((a: number, b: number) => a - b);
  let isStraight = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
      isStraight = true;
      break;
    }
  }
  // A-2-3-4-5 straight (wheel)
  const hasWheel =
    uniqueRanks.indexOf(14) !== -1 &&
    uniqueRanks.indexOf(2) !== -1 &&
    uniqueRanks.indexOf(3) !== -1 &&
    uniqueRanks.indexOf(4) !== -1 &&
    uniqueRanks.indexOf(5) !== -1;
  if (hasWheel) isStraight = true;

  if (isStraight && isFlush) return 8; // Straight flush
  if (rankCounts[0] === 4) return 7; // Four of a kind
  if (rankCounts[0] === 3 && rankCounts[1] === 2) return 6; // Full house
  if (isFlush) return 5; // Flush
  if (isStraight) return 4; // Straight
  if (rankCounts[0] === 3) return 3; // Three of a kind
  if (rankCounts[0] === 2 && rankCounts[1] === 2) return 2; // Two pair
  if (rankCounts[0] === 2) return 1; // One pair
  return 0; // High card
}

export function didHeroWin(
  hero: { cards: [CardT, CardT] },
  otherPlayers: { cards: [CardT, CardT] }[],
  communityCards: CardT[]
): boolean {
  const heroHandValue = evaluateHand(hero.cards, communityCards);
  for (const player of otherPlayers) {
    const playerHandValue = evaluateHand(player.cards, communityCards);
    if (heroHandValue > playerHandValue) {
      return true;
    }
  }
  return false;
}
