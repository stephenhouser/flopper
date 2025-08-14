import { useFlash } from "@/hooks/useFlash";
import { useGameEngine } from "@/hooks/useGameEngine";
import { useHandHistory } from "@/hooks/useHandHistory";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useSession } from "@/hooks/useSession";
import { chenScore, recommendAction } from "@/lib/chen";
import {
  computeHeroResult as gpComputeHeroResult
} from "@/lib/gameplay";
import Storage from "@/lib/storage";
import { closeTrackedSessionForAppSession } from "@/lib/tracker";
import { betForAction, canHeroCheck, formatBetLabel, heroFromPlayers } from "@/lib/utils/bets";
import type { Action, Player, Settings as PokerSettings, Street, TrainerSettings } from "@/models/poker";
import { DEFAULT_TRAINER_SETTINGS, MAX_PLAYERS, MIN_BIG_BLIND, MIN_PLAYERS, SETTINGS_STORAGE_KEY } from "@/models/poker";
import type { GameType } from "@/models/tracker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

export type UseHoldemTrainerOptions = {
  initialNumPlayers?: number;
  initialBigBlind?: number;
  gameType?: GameType;
};

export function useHoldemTrainer(opts: UseHoldemTrainerOptions = {}) {
  const { initialNumPlayers = 6, initialBigBlind = 2, gameType = 'Texas Holdem' } = opts;

  // Settings (persisted as a single object)
  const [settings, setSettings, settingsReady] = usePersistedState<TrainerSettings>(
    SETTINGS_STORAGE_KEY,
    { ...DEFAULT_TRAINER_SETTINGS }
  );

  const numPlayers = settingsReady ? settings.numPlayers ?? initialNumPlayers : initialNumPlayers;
  const bigBlind = settingsReady ? settings.bigBlind ?? initialBigBlind : initialBigBlind;
  const autoNew = settings.autoNew;
  const facingRaise = settings.facingRaise;
  const showFeedback = settings.showFeedback;
  const feedbackSecs = settings.feedbackSecs;
  const showScore = settings.showScore;
  const showFlop = settings.showFlop;
  const showTurn = settings.showTurn;
  const showRiver = settings.showRiver;
  const showCommunityCards = settings.showCommunityCards;

  const setNumPlayers = useCallback((n: number) => setSettings((s) => ({ ...s, numPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)) })), [setSettings]);
  const setBigBlind = useCallback((n: number) => setSettings((s) => ({ ...s, bigBlind: Math.max(MIN_BIG_BLIND, n) })), [setSettings]);
  const setAutoNew = useCallback((v: boolean) => setSettings((s) => ({ ...s, autoNew: v })), [setSettings]);
  const setFacingRaise = useCallback((v: boolean) => setSettings((s) => ({ ...s, facingRaise: v })), [setSettings]);
  const setShowFeedback = useCallback((v: boolean) => setSettings((s) => ({ ...s, showFeedback: v })), [setSettings]);
  const setFeedbackSecs = useCallback((v: number) => setSettings((s) => ({ ...s, feedbackSecs: Math.max(0, Math.min(10, v)) })), [setSettings]);
  const setShowScore = useCallback((v: boolean) => setSettings((s) => ({ ...s, showScore: v })), [setSettings]);
  const setShowFlop = useCallback((v: boolean) => setSettings((s) => ({ ...s, showFlop: v })), [setSettings]);
  const setShowTurn = useCallback((v: boolean) => setSettings((s) => ({ ...s, showTurn: v })), [setSettings]);
  const setShowRiver = useCallback((v: boolean) => setSettings((s) => ({ ...s, showRiver: v })), [setSettings]);
  const setShowCommunityCards = useCallback((v: boolean) => setSettings((s) => ({ ...s, showCommunityCards: v })), [setSettings]);

  // Game engine state
  const {
    players: engPlayers,
    setPlayers: setEngPlayers,
    deck,
    street: currentStreet,
    pot,
    // ...existing code...
    board,
    totalPot,
    dealTable: engineDealTable,
    advanceStreet,
    completeHand,
    getTotalPot,
  } = useGameEngine();

  // UI-level state
  const [showAllCards, setShowAllCards] = useState(false);
  const [foldedHand, setFoldedHand] = useState(false);
  const [heroWonHand, setHeroWonHand] = useState<boolean | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());
  const [buttonsDisabled, setButtonsDisabled] = useState(false);

  // Flash/animation hook
  const { heroFlash, heroFlashOpacity, triggerFlash, clearFlash, setHeroFlash } = useFlash();

  // Stats
  const [heroAction, setHeroAction] = useState<"" | Action>("");
  const [lastAction, setLastAction] = useState<"" | Action>("");
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);

  // Session via hook
  const { currentSession, setCurrentSession, startNewSession: beginSession, ready: sessionReady } = useSession(gameType);
  // Hand history via hook
  const { currentHandHistory, setCurrentHandHistory, createHandHistory, addActionToHistory, finalizeHand } = useHandHistory({
    session: currentSession,
    setSession: setCurrentSession,
    bigBlind,
  });

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const isCompact = Platform.OS !== "web";

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disableButtonsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const players = engPlayers;
  const setPlayers = setEngPlayers;

  const hero = useMemo(() => players.find(p => p.isHero), [players]);
  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(() => recommendAction(heroScore, numPlayers, facingRaise), [heroScore, numPlayers, facingRaise]);

  // Helper to transform board into communityCards payloads
  const communityFromBoard = useCallback(() => ({
    ...(board.flop && { flop: board.flop }),
    ...(board.turn && { turn: board.turn }),
    ...(board.river && { river: board.river }),
  }), [board.flop, board.turn, board.river]);

  // Deal a new table/hand and create a new hand history if a session exists
  const dealTable = useCallback((n: number) => {
    setHeroFlash("none");
    clearFlash();

    const heroSeat = 0;
    const dealt = engineDealTable(n, bigBlind, { heroSeat });

    setShowAllCards(false);
    setFoldedHand(false);
    setHeroWonHand(null);
    setRevealedPlayers(new Set());

    setHeroAction("");
    setLastActionCorrect(null);
    if (!showFeedback) setResult("");

    if (currentSession) {
      createHandHistory(dealt.players);
    }
  }, [bigBlind, currentSession, engineDealTable, clearFlash, showFeedback, setHeroFlash, createHandHistory]);

  const newHand = useCallback(() => dealTable(numPlayers), [dealTable, numPlayers]);

  const startNewSession = useCallback(() => {
    // Determine whether the current hand has any actions
    const hasActions = !!(currentHandHistory && currentHandHistory.actions && currentHandHistory.actions.length > 0);

    // If there are actions, finalize this hand into the previous session before switching
    if (hasActions && currentSession) {
      try {
        finalizeHand({
          pot: getTotalPot(),
          result: "folded",
          communityCards: communityFromBoard(),
        });
      } catch {}
    }

    // Close out the current tracked session before starting a new one
    if (currentSession) {
      closeTrackedSessionForAppSession(currentSession, gameType).catch(() => {});
    }

    const session = beginSession();

    // Reset stats and UI flags
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    setResult(showFeedback ? "New session started. Stats reset." : "");

    // If we finalized the prior hand, deal a fresh hand for the new session.
    // If there were no actions, keep the current hand so it belongs to the new session.
    if (hasActions) {
      // Use the wrapper to properly reset UI and create a new HandHistory bound to the new session
      dealTable(numPlayers);
    }

    return session;
  }, [beginSession, showFeedback, currentSession, gameType, currentHandHistory, finalizeHand, getTotalPot, communityFromBoard, dealTable, numPlayers]);

  // Persisted settings (migrate old per-key to new object once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const oldKeys = [
          "poker.showFeedback","poker.autoNew","poker.facingRaise","poker.feedbackSecs",
          "poker.showScore","poker.showFlop","poker.showTurn","poker.showRiver","poker.showCommunityCards",
          "poker.numPlayers","poker.bigBlind"
        ];
        const values = await Promise.all(oldKeys.map((k) => Storage.getItem(k)));
        const anyPresent = values.some((v) => v != null);
        if (!anyPresent) return;
        const next: Partial<TrainerSettings> = {};
        if (values[0] != null) next.showFeedback = values[0] === "1";
        if (values[1] != null) next.autoNew = values[1] === "1";
        if (values[2] != null) next.facingRaise = values[2] === "1";
        if (values[3] != null) { const v = parseFloat(values[3] || "1"); if (!Number.isNaN(v)) next.feedbackSecs = Math.max(0, Math.min(10, v)); }
        if (values[4] != null) next.showScore = values[4] === "1";
        if (values[5] != null) next.showFlop = values[5] === "1" || values[5] === "true"; // old used 0 for false
        if (values[6] != null) next.showTurn = values[6] === "1";
        if (values[7] != null) next.showRiver = values[7] === "1";
        if (values[8] != null) next.showCommunityCards = values[8] === "1";
        if (values[9] != null) { const n = parseInt(values[9] || "6", 10); if (!Number.isNaN(n)) (next as any).numPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)); }
        if (values[10] != null) { const n = parseInt(values[10] || "2", 10); if (!Number.isNaN(n)) (next as any).bigBlind = Math.max(MIN_BIG_BLIND, n); }
        if (Object.keys(next).length > 0) {
          setSettings((s) => ({ ...s, ...next }));
        }
      } catch {}
      finally {
        if (!cancelled) {
          // no-op; settingsReady controls UI
        }
      }
    })();
    return () => { cancelled = true; };
  }, [setSettings]);

  // Auto-init session if none when both settings and session are ready
  useEffect(() => {
    if (!settingsReady || !sessionReady) return;
    if (!currentSession) startNewSession();
  }, [settingsReady, sessionReady, currentSession, startNewSession]);

  const betLabel = useCallback((p: Player) => formatBetLabel(p), []);

  // Auto-deal first hand once ready and session exists
  useEffect(() => {
    if (!settingsReady || !sessionReady) return;
    if (!currentSession) return;
    if (players.length > 0) return;
    if (deck.length > 0) return;
    if (board.flop || board.turn || board.river) return;
    dealTable(numPlayers);
  }, [settingsReady, sessionReady, currentSession, players.length, deck.length, board.flop, board.turn, board.river, dealTable, numPlayers]);

  const act = useCallback((action: Action) => {
    // Clear any previously scheduled auto-new to avoid overlap
    const dealRef = dealTimerRef.current;
    if (dealRef) {
      clearTimeout(dealRef);
      dealTimerRef.current = null;
    }

    // Disable action buttons for the duration of the feedback window
    const disableMs = Math.max(0, Math.round(feedbackSecs * 1000));
    if (disableMs > 0) {
      if (disableButtonsTimerRef.current) clearTimeout(disableButtonsTimerRef.current);
      setButtonsDisabled(true);
      disableButtonsTimerRef.current = setTimeout(() => setButtonsDisabled(false), disableMs);
    }

    setHeroAction(action);
    setLastAction(action);

    let correct = false;
    let bucket = "";
    if (currentStreet === "preflop") {
      bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
      correct = bucket === recommended;
    } else {
      correct = true;
      bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
    }
    setLastActionCorrect(correct);

    const heroP = heroFromPlayers(players);
    const betAmount = betForAction(action, players, bigBlind, heroP);

    if (currentStreet !== "complete") addActionToHistory(action, betAmount, currentStreet as Exclude<Street, "complete">, hero?.name);

    const updatedPlayers = players.map(p => (p.isHero ? { ...p, bet: betAmount } : p));
    setPlayers(updatedPlayers);

    const updatedTotalPot = getTotalPot();

    if (action === "fold") {
      const finalPot = getTotalPot();
      const settleDelayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      setTimeout(() => {
        completeHand();
      }, settleDelayMs);
      setFoldedHand(true);

      if (currentSession) {
        finalizeHand({
          pot: finalPot,
          result: "folded",
          communityCards: communityFromBoard(),
        });
      }
      // After fold, auto-deal after the feedback delay (single-step flow)
      if (autoNew) {
        if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
        dealTimerRef.current = setTimeout(() => newHand(), settleDelayMs);
      }
    } else if (currentStreet === "river") {
      // First show feedback during the delay, then complete and reveal WIN/LOST
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      advanceStreetTimerRef.current = setTimeout(() => {
        const s: PokerSettings = { showFlop, showTurn, showRiver };
        advanceStreet(s); // transition to complete and settle bets

        // Reveal opponents and compute hero result for display
        const allPlayerIds = new Set(updatedPlayers.map(p => p.id).filter(id => id !== hero?.id));
        setRevealedPlayers(allPlayerIds);
        let heroWon: boolean | undefined = undefined;
        if (hero && board.flop && board.turn && board.river) {
          const communityCards = [...board.flop, board.turn, board.river];
          heroWon = gpComputeHeroResult(hero, updatedPlayers, communityCards);
          setHeroWonHand(heroWon ?? null);
        }

        // Record history at completion with accurate pot
        if (currentSession) {
          finalizeHand({
            pot: getTotalPot(),
            result: "completed",
            heroWon,
            communityCards: communityFromBoard(),
          });
        }

        // After showing WIN/LOST, schedule next hand for another feedback window duration
        if (autoNew) {
          if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
          dealTimerRef.current = setTimeout(() => newHand(), delayMs);
        }
      }, delayMs);
    } else {
      // Non-final streets: wait the feedback delay before dealing the next street
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      advanceStreetTimerRef.current = setTimeout(() => {
        const s: PokerSettings = { showFlop, showTurn, showRiver };
        const next = advanceStreet(s);

        if (next === "complete") {
          // Non-river completion (e.g., skipping streets via settings)
          if (currentSession) {
            finalizeHand({
              pot: getTotalPot(),
              result: "completed",
              communityCards: communityFromBoard(),
            });
          }
          // Auto-deal immediately after the single feedback delay (no extra delay step)
          if (autoNew) {
            if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
            dealTimerRef.current = null;
            newHand();
          }
        }
      }, delayMs);
    }

    // Flash feedback
    triggerFlash(!!correct, Math.max(0, Math.round(feedbackSecs * 1000)));

    if (currentStreet === "preflop") {
      setTotalHands(t => t + 1);
      setCorrectHands(c => c + (correct ? 1 : 0));
    }

    const why = currentStreet === "preflop" ? `Score: ${heroScore} (Chen). ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.` : `${currentStreet} betting. Continue playing or fold.`;
    const resultText = currentStreet === "preflop"
      ? (correct ? `✅ ` : `❌ `) + `Recommended: ${recommended.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`
      : `${currentStreet.toUpperCase()} Action: ${action.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`;
    setResult(resultText);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showFeedback && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
  }, [advanceStreet, autoNew, bigBlind, completeHand, currentStreet, dealTimerRef, deck.length, facingRaise, feedbackSecs, board.flop, board.river, board.turn, hero, heroScore, newHand, numPlayers, players, recommended, showCommunityCards, showFlop, showRiver, showTurn, triggerFlash, communityFromBoard, getTotalPot, finalizeHand, addActionToHistory]);

  const canCheck = useMemo(() => canHeroCheck(players, hero), [players, hero]);

  const togglePlayerReveal = useCallback((playerId: number) => {
    setRevealedPlayers(prev => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => {
    [hideTimerRef, dealTimerRef, advanceStreetTimerRef, disableButtonsTimerRef].forEach(ref => {
      if (ref.current) clearTimeout(ref.current);
    });
  }, []);

  return {
    // settings
    numPlayers, setNumPlayers,
    bigBlind, setBigBlind,
    autoNew, setAutoNew,
    facingRaise, setFacingRaise,
    showFeedback, setShowFeedback,
    feedbackSecs, setFeedbackSecs,
    showScore, setShowScore,
    showFlop, setShowFlop,
    showTurn, setShowTurn,
    showRiver, setShowRiver,
    showCommunityCards, setShowCommunityCards,
    settings, setSettings,

    // game state
    players, currentStreet, pot,
    // ...existing code...
    board,
    showAllCards, setShowAllCards,
    foldedHand, heroWonHand,
    revealedPlayers, togglePlayerReveal,

    // stats
    heroAction, lastAction, lastActionCorrect, result,
    totalHands, correctHands,

    // session
    currentSession, setCurrentSession,
    currentHandHistory, setCurrentHandHistory,
    startNewSession,

    // ui
    isCompact,
    showSettings, setShowSettings,
    heroFlash, heroFlashOpacity,
    buttonsDisabled,

    // derived
    hero, heroScore, recommended,
    canCheck, totalPot,
    betLabel,

    // actions
    dealTable, newHand, act,
  } as const;
}

export default useHoldemTrainer;
