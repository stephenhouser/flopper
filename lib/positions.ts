export function labelForPos(posFromDealer: number, n: number): string {
  if (posFromDealer === 0) return "Dealer"; // BTN
  if (posFromDealer === 1) return "SB";
  if (posFromDealer === 2) return "BB";
  const rest = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO"];
  return rest[posFromDealer - 3] || `Seat ${posFromDealer}`;
}

export function positionBadgeStyle(label?: string) {
  switch (label) {
    case "Dealer": return { backgroundColor: "#EDE2FF" };
    case "SB":     return { backgroundColor: "#D7E8FF" };
    case "BB":     return { backgroundColor: "#FFE8C7" };
    case "UTG":    return { backgroundColor: "#E6F6EB" };
    case "UTG+1":  return { backgroundColor: "#E3F4FF" };
    case "MP":     return { backgroundColor: "#FFF5CC" };
    case "LJ":     return { backgroundColor: "#FDE2F2" };
    case "HJ":     return { backgroundColor: "#E0E7FF" };
    case "CO":     return { backgroundColor: "#ECECEC" };
    default:       return { backgroundColor: "#F1F1F6" };
  }
}
