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
 * Cross-platform hotkey handler for table actions.
 * - Web: listens to window keydown
 * - Native: uses react-native-key-command if available (no hard dependency)
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

  // Native hotkeys via optional dependency
  useEffect(() => {
    if (Platform.OS === "web") return;
    let KeyCommand: any = null;
    try { KeyCommand = require("react-native-key-command"); } catch { return; }
    const unsubscribers: (() => void)[] = [];
    const add = (input: any, cb: () => void) => { try { const off = KeyCommand.addListener({ input }, cb); unsubscribers.push(off); } catch {} };
    const wrap = (fn: () => void) => () => { if (!disabled) fn(); };
    add("c", wrap(() => onAct("check")));
    add("a", wrap(() => onAct("call")));
    add("f", wrap(() => onAct("fold")));
    add("r", wrap(() => onAct("raise")));
    add("\n", wrap(() => { if (heroAction) onAct(heroAction); }));
    add("enter", wrap(() => { if (heroAction) onAct(heroAction); }));
    if (KeyCommand.constants?.keyInputEnter) add(KeyCommand.constants.keyInputEnter, wrap(() => { if (heroAction) onAct(heroAction); }));
    add(" ", wrap(() => onNewHand()));
    add("space", wrap(() => onNewHand()));
    if (KeyCommand.constants?.keyInputSpace) add(KeyCommand.constants.keyInputSpace, wrap(() => onNewHand()));
    return () => { unsubscribers.forEach((off) => typeof off === "function" && off()); };
  }, [disabled, heroAction, onAct, onNewHand]);
}
