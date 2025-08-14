import type { Action } from "@/models/poker";

export function formatAction(a: "" | Action) {
  return a ? a[0].toUpperCase() + a.slice(1) : "—";
}

export default { formatAction };
