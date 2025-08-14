import type { Action } from "@/models/poker";
import { useEffect } from "react";
import { Platform } from "react-native";

export type UseHotkeysOptions = {
  disabled?: boolean;
  heroAction: "" | Action;
  onAct: (action: Action) => void;
  onNewHand: () => void;
};

/**
 * Hotkey handler for web only.
 * - Web: listens to window keydown
 * - Native: no-op
 */
export function useHotkeys(opts: UseHotkeysOptions) {
  const { disabled, heroAction, onAct, onNewHand } = opts;

  // Web hotkeys
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: any) => {
      const target = e.target as HTMLElement | null;
      const tag = target && (target.tagName || "").toLowerCase();
      const editable = target && (target as any).isContentEditable;
      if (tag === "input" || tag === "textarea" || editable) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (disabled) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "c") onAct("check");
      else if (k === "a") onAct("call");
      else if (k === "f") onAct("fold");
      else if (k === "r") onAct("raise");
      else if (k === "enter") { if (heroAction) onAct(heroAction); }
      else if (k === " " || k === "spacebar") { e.preventDefault(); onNewHand(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, heroAction, onAct, onNewHand]);
}
