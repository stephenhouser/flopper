import { updateHandsPlayedForSession } from "@/lib/tracker";
import type { Action, HandAction, HandHistory, Player, Session, Street } from "@/models/poker";
import { smallBlindFromBigBlind } from "@/models/poker";
import { useCallback, useState } from "react";

export type FinalizeParams = {
  pot: number;
  result: HandHistory["result"]; // "folded" | "completed"
  communityCards: HandHistory["communityCards"];
  heroWon?: boolean;
};

export function useHandHistory(params: {
  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  bigBlind: number;
}) {
  const { session, setSession, bigBlind } = params;
  const [currentHandHistory, setCurrentHandHistory] = useState<HandHistory | null>(null);

  const createHandHistory = useCallback((players: Player[]): HandHistory => {
    const handId = `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hh: HandHistory = {
      handId,
      timestamp: Date.now(),
      players: players.map((p) => ({ name: p.name, position: p.positionLabel || "", cards: p.cards, isHero: p.isHero })),
      blinds: { smallBlind: smallBlindFromBigBlind(bigBlind), bigBlind },
      communityCards: {},
      actions: [],
      pot: 0,
      result: "folded",
    };
    setCurrentHandHistory(hh);
    return hh;
  }, [bigBlind]);

  const addActionToHistory = useCallback((action: Action, amount: number, street: Exclude<Street, "complete">, actorName?: string) => {
    setCurrentHandHistory((prev) => {
      if (!prev) return prev;
      const handAction: HandAction = {
        player: actorName || "Hero",
        action,
        amount,
        street,
        timestamp: Date.now(),
      };
      return { ...prev, actions: [...prev.actions, handAction] };
    });
  }, []);

  const finalizeHand = useCallback((f: FinalizeParams) => {
    if (!session) return;
    setCurrentHandHistory((prev) => {
      if (!prev) return prev;
      const updated: HandHistory = {
        ...prev,
        pot: f.pot,
        result: f.result,
        communityCards: {
          ...f.communityCards,
        },
        ...(typeof f.heroWon === "boolean" ? { heroWon: f.heroWon } : {}),
      };
      setSession((s) => {
        if (!s) return s;
        const next = { ...s, hands: [...s.hands, updated] };
        // Sync tracker row with new hands count
        updateHandsPlayedForSession(next).catch(() => {});
        return next;
      });
      return null;
    });
  }, [setSession, session]);

  return {
    currentHandHistory,
    setCurrentHandHistory,
    createHandHistory,
    addActionToHistory,
    finalizeHand,
  } as const;
}
