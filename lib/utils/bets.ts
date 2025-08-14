import { minRaise } from "@/lib/gameplay";
import type { Action, Player } from "@/models/poker";

export function tableCurrentBet(players: Player[]): number {
  if (!players || players.length === 0) return 0;
  return players.reduce((m, p) => (p.bet > m ? p.bet : m), 0);
}

export function heroFromPlayers(players: Player[]): Player | undefined {
  return players.find((p) => p.isHero);
}

export function canHeroCheck(players: Player[], hero?: Player): boolean {
  if (!hero) return false;
  const currentBet = tableCurrentBet(players);
  return (hero.bet || 0) >= currentBet;
}

export function betForAction(action: Action, players: Player[], bigBlind: number, hero?: Player): number {
  const currentBet = tableCurrentBet(players);
  const heroBet = hero?.bet || 0;
  if (action === "check") return heroBet;
  if (action === "call") return currentBet;
  if (action === "raise") return minRaise(currentBet, bigBlind);
  // fold: no change to hero bet; engine will settle and complete the hand
  return heroBet;
}

// Small reusable helper to render a bet label with SB/BB tag
export function formatBetLabel(p: Player): string {
  const tag = p.role === "SB" ? "SB" : p.role === "BB" ? "BB" : "";
  const amt = `$${p.bet}`;
  return tag ? `${amt} (${tag})` : amt;
}

export default {
  tableCurrentBet,
  heroFromPlayers,
  canHeroCheck,
  betForAction,
  formatBetLabel,
};
