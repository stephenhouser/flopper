import type { CardT, Rank } from "./cards";

const chenRankValue: Record<Rank, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1,
};

export function chenScore(c1: CardT, c2: CardT): number {
  const order = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"] as const;
  const scoreMap = chenRankValue;
  const ranks = [c1.rank, c2.rank].sort((a, b) => scoreMap[b] - scoreMap[a]);
  const [rHigh, rLow] = ranks as [Rank, Rank];
  const suited = c1.suit === c2.suit;
  const gap = Math.abs(order.indexOf(rHigh) - order.indexOf(rLow)) - 1;

  let score = scoreMap[rHigh];
  if (rHigh === rLow) score = Math.max(5, scoreMap[rHigh] * 2);
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  if (suited) score += 2;
  return Math.round(score * 2) / 2;
}

export function recommendAction(
  score: number,
  numPlayers: number,
  facingRaise: boolean
): "raise" | "call/check" | "fold" {
  const tableTightener = Math.max(0, (numPlayers - 6) * 0.7);
  if (facingRaise) {
    if (score >= 11 + tableTightener) return "raise";
    if (score >= 8 + tableTightener) return "call/check";
    return "fold";
  } else {
    if (score >= 9 + tableTightener) return "raise";
    if (score >= 6 + tableTightener) return "call/check";
    return "fold";
  }
}
