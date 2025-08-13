import { chenScore, recommendAction } from "@/lib/chen";
// Removed unused import didHeroWin after refactor to gameplay helpers
// import { didHeroWin } from "@/lib/hand-eval";
// Removed unused import labelForPos after refactor to gameplay helpers
// import { labelForPos } from "@/lib/positions";
import useGameEngine from "@/hooks/useGameEngine";
import {
	computeHeroResult as gpComputeHeroResult,
	// ...existing code...
	minRaise as gpMinRaise,
} from "@/lib/gameplay";
import Storage from "@/lib/storage";
import type { Action, HandAction, HandHistory, Player, Settings as PokerSettings, Session, Street, TrainerSettings } from "@/models/poker";
import usePersistedState from "@/hooks/usePersistedState";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import useFlash from "@/hooks/useFlash";
import useSession from "@/hooks/useSession";

export type UseHoldemTrainerOptions = {
  initialNumPlayers?: number;
  initialBigBlind?: number;
};

export function useHoldemTrainer(opts: UseHoldemTrainerOptions = {}) {
  const { initialNumPlayers = 6, initialBigBlind = 2 } = opts;

  // Settings (persisted as a single object)
  const [settings, setSettings, settingsReady] = usePersistedState<TrainerSettings>(
    "poker.trainerSettings.v1",
    {
      showFlop: false,
      showTurn: true,
      showRiver: true,
      autoNew: true,
      facingRaise: true,
      showFeedback: true,
      feedbackSecs: 1.0,
      showScore: true,
      showCommunityCards: false,
      numPlayers: 6,
      bigBlind: 2,
    }
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

  const setNumPlayers = useCallback((n: number) => setSettings((s) => ({ ...s, numPlayers: Math.max(2, Math.min(9, n)) })), [setSettings]);
  const setBigBlind = useCallback((n: number) => setSettings((s) => ({ ...s, bigBlind: Math.max(1, n) })), [setSettings]);
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
    flop: flopCards,
    turn: turnCard,
    river: riverCard,
    totalPot,
    dealTable: engineDealTable,
    advanceStreet,
    completeHand,
  } = useGameEngine();

  // UI-level state
  const [showAllCards, setShowAllCards] = useState(false);
  const [foldedHand, setFoldedHand] = useState(false);
  const [heroWonHand, setHeroWonHand] = useState<boolean | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());

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
  const { currentSession, setCurrentSession, startNewSession: beginSession, ready: sessionReady } = useSession();
  const [currentHandHistory, setCurrentHandHistory] = useState<HandHistory | null>(null);

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const isCompact = Platform.OS !== "web";

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const players = engPlayers;
  const setPlayers = setEngPlayers;

  const hero = useMemo(() => players.find(p => p.isHero), [players]);
  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(() => recommendAction(heroScore, numPlayers, facingRaise), [heroScore, numPlayers, facingRaise]);

  const startNewSession = useCallback(() => {
    const session = beginSession();
    setCurrentHandHistory(null);
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    setResult(showFeedback ? "New session started. Stats reset." : "");
    return session;
  }, [beginSession, showFeedback]);

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
        if (values[9] != null) { const n = parseInt(values[9] || "6", 10); if (!Number.isNaN(n)) (next as any).numPlayers = Math.max(2, Math.min(9, n)); }
        if (values[10] != null) { const n = parseInt(values[10] || "2", 10); if (!Number.isNaN(n)) (next as any).bigBlind = Math.max(1, n); }
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

  const betLabel = useCallback((p: Player) => {
    const tag = p.role === "SB" ? "SB" : p.role === "BB" ? "BB" : "";
    const amt = `$${p.bet}`;
    return tag ? `${amt} (${tag})` : amt;
  }, []);

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
      const hh = createHandHistory(dealt.players);
      setCurrentHandHistory(hh);
    }
  }, [bigBlind, currentSession, engineDealTable, clearFlash, showFeedback, setHeroFlash]);

  const newHand = useCallback(() => dealTable(numPlayers), [dealTable, numPlayers]);

  // Auto-deal first hand once ready and session exists
  useEffect(() => {
    if (!settingsReady || !sessionReady) return;
    if (!currentSession) return;
    if (players.length > 0) return;
    if (deck.length > 0) return;
    if (flopCards || turnCard || riverCard) return;
    dealTable(numPlayers);
  }, [settingsReady, sessionReady, currentSession, players.length, deck.length, flopCards, turnCard, riverCard, dealTable, numPlayers]);

  function createHandHistory(ps: Player[]): HandHistory {
    const handId = `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      handId,
      timestamp: Date.now(),
      players: ps.map(p => ({ name: p.name, position: p.positionLabel || "", cards: p.cards, isHero: p.isHero })),
      blinds: { smallBlind: Math.max(1, Math.floor(bigBlind / 2)), bigBlind },
      communityCards: {},
      actions: [],
      pot: 0,
      result: "folded",
    };
  }

  function addActionToHistory(action: Action, amount: number, street: Exclude<Street, "complete">) {
    if (!currentHandHistory || !hero) return;
    const handAction: HandAction = { player: hero.name, action, amount, street, timestamp: Date.now() };
    setCurrentHandHistory(prev => prev ? { ...prev, actions: [...prev.actions, handAction] } : prev);
  }

  const act = useCallback((action: Action) => {
    // Clear any previously scheduled auto-new to avoid overlap
    const dealRef = dealTimerRef.current;
    if (dealRef) {
      clearTimeout(dealRef);
      dealTimerRef.current = null;
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

    const currentBet = Math.max(...players.map(p => p.bet));
    const heroBet = players.find(p => p.isHero)?.bet || 0;
    let betAmount = heroBet;

    if (action === "call") betAmount = currentBet;
    else if (action === "raise") betAmount = gpMinRaise(currentBet, bigBlind);
    else if (action === "check") betAmount = heroBet;

    if (currentStreet !== "complete") addActionToHistory(action, betAmount, currentStreet as Exclude<Street, "complete">);

    const updatedPlayers = players.map(p => (p.isHero ? { ...p, bet: betAmount } : p));
    setPlayers(updatedPlayers);

    const updatedTotalPot = pot + updatedPlayers.reduce((sum, player) => sum + player.bet, 0);

    if (action === "fold") {
      const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
      const finalPot = pot + allBets;
      const settleDelayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      setTimeout(() => {
        completeHand();
      }, settleDelayMs);
      setFoldedHand(true);

      if (currentHandHistory && currentSession) {
        const updatedHistory = {
          ...currentHandHistory,
          pot: finalPot,
          result: "folded" as const,
          communityCards: { ...(flopCards && { flop: flopCards }), ...(turnCard && { turn: turnCard }), ...(riverCard && { river: riverCard }) },
        };
        setCurrentSession(prev => prev ? { ...prev, hands: [...prev.hands, updatedHistory] } : prev);
        setCurrentHandHistory(null);
      }
      // After fold, auto-deal after the feedback delay as before
      if (autoNew) {
        if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
        dealTimerRef.current = setTimeout(() => newHand(), settleDelayMs);
      }
    } else {
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      advanceStreetTimerRef.current = setTimeout(() => {
        const s: PokerSettings = { showFlop, showTurn, showRiver };
        const next = advanceStreet(s);

        if (currentStreet === "river" && next === "complete") {
          const allPlayerIds = new Set(updatedPlayers.map(p => p.id).filter(id => id !== hero?.id));
          setRevealedPlayers(allPlayerIds);
          let heroWon: boolean | undefined = undefined;
          if (hero && flopCards && turnCard && riverCard) {
            const communityCards = [...flopCards, turnCard, riverCard];
            heroWon = gpComputeHeroResult(hero, updatedPlayers, communityCards);
            setHeroWonHand(heroWon ?? null);
          }
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: pot + updatedPlayers.reduce((s, p) => s + p.bet, 0),
              result: "completed" as const,
              heroWon,
              communityCards: { flop: flopCards!, turn: turnCard!, river: riverCard! },
            };
            setCurrentSession(prev => prev ? { ...prev, hands: [...prev.hands, updatedHistory] } : prev);
            setCurrentHandHistory(null);
          }
          // Linger with WIN/LOST visible for the full feedback delay before auto-deal
          if (autoNew) {
            const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
            if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
            dealTimerRef.current = setTimeout(() => newHand(), delayMs);
          }
        } else if (next === "complete") {
          // Non-river completion
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: pot + updatedPlayers.reduce((s, p) => s + p.bet, 0),
              result: "completed" as const,
              communityCards: { ...(flopCards && { flop: flopCards }), ...(turnCard && { turn: turnCard }), ...(riverCard && { river: riverCard }) },
            };
            setCurrentSession(prev => prev ? { ...prev, hands: [...prev.hands, updatedHistory] } : prev);
            setCurrentHandHistory(null);
          }
          if (autoNew) {
            const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
            if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
            dealTimerRef.current = setTimeout(() => newHand(), delayMs);
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
  }, [advanceStreet, autoNew, bigBlind, completeHand, currentHandHistory, currentStreet, dealTimerRef, deck.length, facingRaise, feedbackSecs, flopCards, hero, heroScore, newHand, numPlayers, players, pot, recommended, riverCard, showCommunityCards, showFeedback, showFlop, showRiver, showTurn, turnCard, triggerFlash, setCurrentSession, currentSession]);

  const canCheck = useMemo(() => {
    const currentBet = Math.max(...players.map(p => p.bet));
    const heroBet = hero?.bet || 0;
    return heroBet >= currentBet;
  }, [players, hero]);

  const togglePlayerReveal = useCallback((playerId: number) => {
    setRevealedPlayers(prev => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => {
    [hideTimerRef, dealTimerRef, advanceStreetTimerRef].forEach(ref => {
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
    players, currentStreet, pot, flopCards, turnCard, riverCard,
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

    // derived
    hero, heroScore, recommended,
    canCheck, totalPot,
    betLabel,

    // actions
    dealTable, newHand, act,
  } as const;
}

export default useHoldemTrainer;
