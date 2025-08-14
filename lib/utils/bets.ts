import { chenScore, recommendAction } from "@/lib/chen";
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

// New: determine if a player can check (for non-hero)
export function canPlayerCheck(players: Player[], player: Player): boolean {
  const currentBet = tableCurrentBet(players);
  return (player.bet || 0) >= currentBet;
}

// New: determine if all active players have matched the current bet or folded
export function allActiveBetsEqual(players: Player[]): boolean {
  const active = players.filter((p) => !p.folded);
  if (active.length <= 1) return true;
  const target = tableCurrentBet(players);
  return active.every((p) => (p.bet || 0) === target);
}

// New: simple signal for whether someone has raised (current bet exceeds big blind)
export function hasRaiseOccurred(players: Player[], bigBlind: number): boolean {
  return tableCurrentBet(players) > bigBlind;
}

// New: choose an action for a non-hero using Chen score and table state
export function chooseActionForPlayer(players: Player[], p: Player, numPlayers: number, bigBlind: number): Action {
  if (p.folded) return "check"; // already out
  const score = chenScore(p.cards[0], p.cards[1]);
  const facingRaise = tableCurrentBet(players) > (p.bet || 0);
  const rec = recommendAction(score, numPlayers, facingRaise);
  if (rec === "fold") return facingRaise ? "fold" : "check";
  if (rec === "call/check") return canPlayerCheck(players, p) ? "check" : "call";
  // "raise" (AI callers may further restrict this using helpers)
  return "raise";
}

export default {
  tableCurrentBet,
  heroFromPlayers,
  canHeroCheck,
  betForAction,
  formatBetLabel,
  canPlayerCheck,
  allActiveBetsEqual,
  hasRaiseOccurred,
  chooseActionForPlayer,
};
