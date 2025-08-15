import { Player } from "@/models/poker";

export function labelForPos(posFromDealer: number, n: number): string {
  return Player.labelForPos(posFromDealer, n);
}

export function positionBadgeStyle(label?: string) {
  return Player.positionBadgeStyle(label);
}
