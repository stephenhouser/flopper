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
import { allActiveBetsEqual, betForAction, canHeroCheck, chooseActionForPlayer, formatBetLabel, heroFromPlayers, tableCurrentBet } from "@/lib/utils/bets";
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
    // NEW: settleBets API so we can settle immediately after a matched round
    settleBets,
  } = useGameEngine();

  // UI-level state
  const [showAllCards, setShowAllCards] = useState(false);
  const [foldedHand, setFoldedHand] = useState(false);
  const [heroWonHand, setHeroWonHand] = useState<boolean | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());
  const [buttonsDisabled, setButtonsDisabled] = useState(false);

  // Per-player action pulse counter (increments when a player acts)
  const [actionPulse, setActionPulse] = useState<Record<number, number>>({});

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

  // Wrapper to add action and trigger per-player pulse
  const addActionWithPulse = useCallback((a: Action, amount: number, street: Exclude<Street, "complete">, actorName?: string) => {
    if (actorName) {
      setActionPulse(prev => {
        // Resolve actor by name from latest players array
        const actor = engPlayers.find(pl => pl.name === actorName);
        if (!actor) return prev;
        const next = { ...prev } as Record<number, number>;
        next[actor.id] = (next[actor.id] || 0) + 1;
        return next;
      });
    }
    addActionToHistory(a, amount, street, actorName);
  }, [addActionToHistory, engPlayers]);

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const isCompact = Platform.OS !== "web";

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disableButtonsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // New: AI scheduling timers and state
  const aiTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const aiRunningRef = useRef(false);
  const awaitingHeroRef = useRef(false); // pause AI when waiting for hero action
  const AI_STEP_DELAY_MS = 250; // sequential delay between AI actions
  const scheduleAITimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    aiTimersRef.current.push(t);
    return t;
  }, []);

  // Ref indirection to avoid using runPreflop before it's declared
  const runPreflopRef = useRef<((mode: "until-hero" | "after-hero") => void) | null>(null);
  // Ref indirection for postflop streets (flop/turn/river)
  const runPostflopRef = useRef<((mode: "until-hero" | "after-hero", street: Exclude<Street, "preflop" | "complete">) => void) | null>(null);

  const players = engPlayers;
  const setPlayers = setEngPlayers;
  // Track latest players for scheduling
  const playersLatestRef = useRef(players);
  useEffect(() => { playersLatestRef.current = players; }, [players]);
  // Track latest street to gate AI
  const streetLatestRef = useRef<Street>(currentStreet);
  useEffect(() => { streetLatestRef.current = currentStreet; }, [currentStreet]);

  // Helper: find last aggressor (raiser) index from current hand history on this street
  const lastRaiserIndex = useCallback((arr: Player[]): number | undefined => {
    const acts = currentHandHistory?.actions || [];
    for (let i = acts.length - 1; i >= 0; i--) {
      const a = acts[i];
      if (a.street === currentStreet && a.action === "raise") {
        const idx = arr.findIndex(p => p.name === a.player);
        return idx >= 0 ? idx : undefined;
      }
    }
    return undefined;
  }, [currentHandHistory?.actions, currentStreet]);

  const hero = useMemo(() => players.find(p => p.isHero), [players]);
  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(() => recommendAction(heroScore, numPlayers, facingRaise), [heroScore, numPlayers, facingRaise]);

  // Helper to transform board into communityCards payloads
  const communityFromBoard = useCallback(() => ({
    ...(board.flop && { flop: board.flop }),
    ...(board.turn && { turn: board.turn }),
    ...(board.river && { river: board.river }),
  }), [board.flop, board.turn, board.river]);

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

  const betLabel = useCallback((p: Player) => formatBetLabel(p), []);

  const actionLabel = useCallback((p: Player) => {
    // Always show Fold if the player is out
    if (p.folded) return "Fold";
    const actions = currentHandHistory?.actions || [];
    // Only consider actions taken on the current street to "clear" between rounds
    const byStreet = actions.filter(a => a.street === currentStreet);
    for (let i = byStreet.length - 1; i >= 0; i--) {
      const a = byStreet[i];
      if (a.player === p.name) {
        switch (a.action) {
          case "raise": return "Raise";
          case "call": return "Call";
          case "check": return "Check";
          case "fold": return "Fold";
        }
      }
    }
    return "";
  }, [currentHandHistory?.actions, currentStreet]);

  // Pulse key getter for UI
  const pulseKey = useCallback((p: Player) => actionPulse[p.id] || 0, [actionPulse]);

  // ---------- Simple Preflop AI (simplified) ----------

  const allButOneFolded = useCallback((arr: Player[]) => arr.filter(p => !p.folded).length <= 1, []);

  // Shared helper: restrict raises (single raise cap, no raise when settled)
  const decideActionRestricted = useCallback((arr: Player[], pl: Player): Action => {
    const currentBet = tableCurrentBet(arr);
    const raiseAlready = currentBet > bigBlind;
    const everyoneDone = allActiveBetsEqual(arr) || allButOneFolded(arr);
    let a = chooseActionForPlayer(arr, pl, numPlayers, bigBlind);

    // If behind, cannot check to stay in — must call or raise (or fold if chosen)
    const needsToCall = (pl.bet || 0) < currentBet;
    if (needsToCall && a === "check") {
      a = "call";
    }

    // Cap raises: only allow one raise and never raise when round is settled
    if (a === "raise" && (raiseAlready || everyoneDone)) {
      a = (pl.bet || 0) >= currentBet ? "check" : "call";
    }
    return a;
  }, [bigBlind, numPlayers, allButOneFolded]);

  // Shared helper: finish if only one remains, else advance to flop
  const settleOrAdvance = useCallback((state: Player[]) => {
    if (allButOneFolded(state)) {
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      scheduleAITimeout(() => {
        completeHand();
        const heroAlive = state.find(p => p.isHero && !p.folded);
        const heroWon = !!heroAlive;
        setHeroWonHand(heroWon ? true : null);
        if (currentSession) {
          finalizeHand({ pot: getTotalPot(), result: "completed", heroWon, communityCards: communityFromBoard() });
        }
        if (autoNew) {
          if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
          dealTimerRef.current = setTimeout(() => newHand(), delayMs);
        }
      }, Math.max(0, Math.round(feedbackSecs * 1000)));
      return true;
    }
    if (streetLatestRef.current === "preflop") {
      const s: PokerSettings = { showFlop, showTurn, showRiver };
      advanceStreet(s);
    }
    return true;
  }, [advanceStreet, allButOneFolded, autoNew, communityFromBoard, completeHand, currentSession, feedbackSecs, finalizeHand, getTotalPot]);

  // Unified preflop runner
  const runPreflop = useCallback((mode: "until-hero" | "after-hero") => {
    if (aiRunningRef.current) return;
    aiRunningRef.current = true;

    let state = playersLatestRef.current.map(p => ({ ...p }));
    const order = preflopOrder(state);
    const heroIdx = state.findIndex(p => p.isHero);
    const startIdx = mode === "until-hero" ? 0 : Math.max(0, order.indexOf(heroIdx) + 1);
    const aggressorIdx = mode === "after-hero" ? (lastRaiserIndex(state) ?? heroIdx) : undefined;

    // Early settle for after-hero if already matched
    if (mode === "after-hero" && (allActiveBetsEqual(state) || allButOneFolded(state))) {
      aiRunningRef.current = false;
      setPlayers(state.map(p => ({ ...p })));
      if (allButOneFolded(state)) { settleOrAdvance(state); }
      else if (streetLatestRef.current === "preflop") {
        const s: PokerSettings = { showFlop, showTurn, showRiver };
        advanceStreet(s);
      }
      return;
    }

    const MAX_STEPS = Math.max(8, order.length * 3);
    let steps = 0;

    const step = (i: number) => {
      if (streetLatestRef.current !== "preflop") { aiRunningRef.current = false; return; }
      if (awaitingHeroRef.current) { aiRunningRef.current = false; return; }
      if (steps++ > MAX_STEPS) {
        aiRunningRef.current = false;
        setPlayers(state.map(p => ({ ...p })));
        if (mode === "after-hero" && (allActiveBetsEqual(state) || allButOneFolded(state))) {
          settleOrAdvance(state);
        }
        return;
      }

      const modI = i % order.length;
      const idx = order[modI];

      if (mode === "until-hero") {
        if (idx === heroIdx || i >= order.length) {
          // Yield to hero; but finish early if only one remains
          if (allButOneFolded(state)) {
            aiRunningRef.current = false;
            setPlayers(state.map(p => ({ ...p })));
            settleOrAdvance(state);
            return;
          }
          awaitingHeroRef.current = true;
          aiRunningRef.current = false;
          setPlayers(state.map(p => ({ ...p })));
          return;
        }
      } else if (mode === "after-hero" && aggressorIdx != null && idx === aggressorIdx) {
        // When action returns to aggressor, settle if matched or only one left
        if (allActiveBetsEqual(state) || allButOneFolded(state)) {
          aiRunningRef.current = false;
          setPlayers(state.map(p => ({ ...p })));
          settleOrAdvance(state);
          return;
        }
        // Not settled yet: continue past aggressor so others can respond
        scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS);
        return;
      }

      const p = state[idx];
      if (!p || p.folded) { scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS); return; }

      const action = decideActionRestricted(state, p);
      const amount = betForAction(action, state, bigBlind, p);
      if (action === "fold") p.folded = true;
      p.bet = amount;
      addActionWithPulse(action, amount, "preflop", p.name);

      if (allButOneFolded(state)) {
        aiRunningRef.current = false;
        setPlayers(state.map(pl => ({ ...pl })));
        settleOrAdvance(state);
        return;
      }

      setPlayers(state.map(pl => ({ ...pl })));
      scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS);
    };

    scheduleAITimeout(() => step(startIdx), AI_STEP_DELAY_MS);
  }, [addActionWithPulse, allActiveBetsEqual, allButOneFolded, bigBlind, decideActionRestricted, lastRaiserIndex, scheduleAITimeout, setPlayers]);

  // Keep ref updated
  useEffect(() => { runPreflopRef.current = runPreflop; }, [runPreflop]);

  // ---------- Postflop AI (flop/turn/river) ----------

  const settleAfterPostflop = useCallback((state: Player[], street: Exclude<Street, "preflop" | "complete">) => {
    // If everyone but one folded, complete hand after feedback delay
    if (allButOneFolded(state)) {
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      scheduleAITimeout(() => {
        completeHand();
        const heroAlive = state.find(p => p.isHero && !p.folded);
        const heroWon = !!heroAlive;
        setHeroWonHand(heroWon ? true : null);
        if (currentSession) {
          finalizeHand({ pot: getTotalPot(), result: "completed", heroWon, communityCards: communityFromBoard() });
        }
        if (autoNew) {
          if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
          dealTimerRef.current = setTimeout(() => newHand(), delayMs);
        }
      }, delayMs);
      return;
    }

    // Bets are matched: immediately settle into pot so UI reflects calls before advancing
    // Defer by a tick to ensure the latest setPlayers has committed to the engine state refs
    try { scheduleAITimeout(() => { try { settleBets(); } catch {} }, 0); } catch {}

    // Otherwise, advance street after feedback delay
    const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
    if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
    advanceStreetTimerRef.current = setTimeout(() => {
      const s: PokerSettings = { showFlop, showTurn, showRiver };
      const next = advanceStreet(s);

      if (next === "complete") {
        // Showdown at river or due to skipping streets
        // Reveal only opponents who did not fold
        const revealIds = new Set(
          state
            .filter(p => !p.isHero && !p.folded)
            .map(p => p.id)
        );
        setRevealedPlayers(revealIds);

        let heroWon: boolean | undefined = undefined;
        if (hero && board.flop && board.turn && board.river) {
          // Fix community array construction
          const communityCards = [...board.flop, board.turn, board.river];
          heroWon = gpComputeHeroResult(hero, state, communityCards);
          setHeroWonHand(heroWon ?? null);
        }

        if (currentSession) {
          finalizeHand({
            pot: getTotalPot(),
            result: "completed",
            heroWon,
            communityCards: communityFromBoard(),
          });
        }

        if (autoNew) {
          if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
          dealTimerRef.current = setTimeout(() => newHand(), delayMs);
        }
      } else {
        // Kick off next street until hero, if others act first
        scheduleAITimeout(() => {
          if (next === "flop" || next === "turn" || next === "river") {
            runPostflopRef.current?.("until-hero", next);
          }
        }, AI_STEP_DELAY_MS);
      }
    }, delayMs);
  }, [advanceStreet, allButOneFolded, autoNew, board.flop, board.river, board.turn, communityFromBoard, completeHand, currentSession, feedbackSecs, finalizeHand, getTotalPot, hero, scheduleAITimeout, settleBets]);

  const runPostflop = useCallback((mode: "until-hero" | "after-hero", street: Exclude<Street, "preflop" | "complete">) => {
    if (aiRunningRef.current) return;
    if (streetLatestRef.current !== street) return; // guard
    aiRunningRef.current = true;

    let state = playersLatestRef.current.map(p => ({ ...p }));
    const order = postflopOrder(state);
    const heroIdx = state.findIndex(p => p.isHero);
    const startIdx = mode === "until-hero" ? 0 : Math.max(0, order.indexOf(heroIdx) + 1);
    const aggressorIdx = mode === "after-hero" ? (lastRaiserIndex(state) ?? heroIdx) : undefined;

    // Early settle for after-hero if already matched
    if (mode === "after-hero" && (allActiveBetsEqual(state) || allButOneFolded(state))) {
      aiRunningRef.current = false;
      setPlayers(state.map(p => ({ ...p })));
      settleAfterPostflop(state, street);
      return;
    }

    const MAX_STEPS = Math.max(8, order.length * 3);
    let steps = 0;

    const step = (i: number) => {
      if (streetLatestRef.current !== street) { aiRunningRef.current = false; return; }
      if (awaitingHeroRef.current) { aiRunningRef.current = false; return; }
      if (steps++ > MAX_STEPS) {
        aiRunningRef.current = false;
        setPlayers(state.map(p => ({ ...p })));
        // Try to settle if possible
        if (mode === "after-hero" && (allActiveBetsEqual(state) || allButOneFolded(state))) {
          settleAfterPostflop(state, street);
        }
        return;
      }

      const modI = i % order.length;
      const idx = order[modI];

      if (mode === "until-hero") {
        if (idx === heroIdx || i >= order.length) {
          // Yield to hero; but finish early if only one remains
          if (allButOneFolded(state)) {
            aiRunningRef.current = false;
            setPlayers(state.map(p => ({ ...p })));
            settleAfterPostflop(state, street);
            return;
          }
          awaitingHeroRef.current = true;
          aiRunningRef.current = false;
          setPlayers(state.map(p => ({ ...p })));
          return;
        }
      } else if (mode === "after-hero" && aggressorIdx != null && idx === aggressorIdx) {
        // When action returns to aggressor, settle if matched or only one left
        if (allActiveBetsEqual(state) || allButOneFolded(state)) {
          aiRunningRef.current = false;
          setPlayers(state.map(p => ({ ...p })));
          settleAfterPostflop(state, street);
          return;
        }
        scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS);
        return;
      }

      const p = state[idx];
      if (!p || p.folded) { scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS); return; }

      let action = decideActionRestricted(state, p);
      const currentBetNow = tableCurrentBet(state);
      if (action === "check" && (p.bet || 0) < currentBetNow) {
        action = "call";
      }
      const amount = betForAction(action, state, bigBlind, p);
      if (action === "fold") p.folded = true;
      p.bet = amount;
      // FIX: Log postflop actions with the correct street
      addActionWithPulse(action, amount, street, p.name);

      if (allButOneFolded(state)) {
        aiRunningRef.current = false;
        setPlayers(state.map(pl => ({ ...pl })));
        settleAfterPostflop(state, street);
        return;
      }

      setPlayers(state.map(pl => ({ ...pl })));
      scheduleAITimeout(() => step(i + 1), AI_STEP_DELAY_MS);
    };

    scheduleAITimeout(() => step(startIdx), AI_STEP_DELAY_MS);
  }, [addActionWithPulse, allActiveBetsEqual, allButOneFolded, bigBlind, decideActionRestricted, lastRaiserIndex, scheduleAITimeout, setPlayers, settleAfterPostflop]);

  // Keep ref updated
  useEffect(() => { runPostflopRef.current = runPostflop; }, [runPostflop]);

  // When a new postflop street starts, let AI act until hero if others are first to act
  useEffect(() => {
    if (currentStreet === "flop" || currentStreet === "turn" || currentStreet === "river") {
      // If there are already actions on this street, don't auto-run
      const hasStreetAction = !!(currentHandHistory?.actions?.some(a => a.street === currentStreet));
      if (hasStreetAction) return;
      // Defer slightly to allow state commit from advanceStreet
      scheduleAITimeout(() => {
        runPostflopRef.current?.("until-hero", currentStreet);
      }, AI_STEP_DELAY_MS);
    }
  }, [currentStreet, currentHandHistory?.actions, scheduleAITimeout]);

  const dealTable = useCallback((n: number) => {
    setHeroFlash("none");
    clearFlash();

    // Clear any pending AI timers to avoid cross-hand state updates
    aiTimersRef.current.forEach(t => clearTimeout(t));
    aiTimersRef.current = [];
    aiRunningRef.current = false;
    awaitingHeroRef.current = false;

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

    // Kick off simple automated preflop betting for non-hero players until hero's turn
    // Slight delay to ensure state has committed
    scheduleAITimeout(() => {
      try {
        runPreflopRef.current?.("until-hero");
      } catch {}
    }, AI_STEP_DELAY_MS);
  }, [bigBlind, currentSession, engineDealTable, clearFlash, showFeedback, setHeroFlash, createHandHistory, scheduleAITimeout]);

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

  // Auto-init session if none when both settings and session are ready
  useEffect(() => {
    if (!settingsReady || !sessionReady) return;
    if (!currentSession) startNewSession();
  }, [settingsReady, sessionReady, currentSession, startNewSession]);

  // Auto-deal first hand once ready and session exists
  useEffect(() => {
    if (!settingsReady || !sessionReady) return;
    if (!currentSession) return;
    if (players.length > 0) return;
    if (deck.length > 0) return;
    if (board.flop || board.turn || board.river) return;
    dealTable(numPlayers);
  }, [settingsReady, sessionReady, currentSession, players.length, deck.length, board.flop, board.turn, board.river, dealTable, numPlayers]);

  const canCheck = useMemo(() => canHeroCheck(players, hero), [players, hero]);

  const togglePlayerReveal = useCallback((playerId: number) => {
    setRevealedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return next;
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      aiTimersRef.current.forEach((t) => clearTimeout(t));
      if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      if (disableButtonsTimerRef.current) clearTimeout(disableButtonsTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const act = useCallback((action: Action) => {
    // Clear any previously scheduled auto-new to avoid overlap
    const dealRef = dealTimerRef.current;
    if (dealRef) {
      clearTimeout(dealRef);
      dealTimerRef.current = null;
    }

    // Hero is acting now; resume AI after hero with gating disabled
    awaitingHeroRef.current = false;

    // Disable action buttons for the duration of the feedback window
    const disableMs = Math.max(0, Math.round(feedbackSecs * 1000));
    if (disableMs > 0) {
      if (disableButtonsTimerRef.current) clearTimeout(disableButtonsTimerRef.current);
      setButtonsDisabled(true);
      disableButtonsTimerRef.current = setTimeout(() => setButtonsDisabled(false), disableMs);
    }

    // Enforce: if hero is behind the current bet, a "check" becomes a "call"
    const heroP = heroFromPlayers(players);
    const currentBetNow = tableCurrentBet(players);
    let effectiveAction: Action = action;
    if (effectiveAction === "check" && heroP && (heroP.bet || 0) < currentBetNow) {
      effectiveAction = "call";
    }

    setHeroAction(effectiveAction);
    setLastAction(effectiveAction);

    let correct = false;
    let bucket = "";
    if (currentStreet === "preflop") {
      bucket = effectiveAction === "fold" ? "fold" : effectiveAction === "raise" ? "raise" : "call/check";
      correct = bucket === recommended;
    } else {
      correct = true;
      bucket = effectiveAction === "fold" ? "fold" : effectiveAction === "raise" ? "raise" : "call/check";
    }
    setLastActionCorrect(correct);

    const betAmount = betForAction(effectiveAction, players, bigBlind, heroP);

    if (currentStreet !== "complete") addActionWithPulse(effectiveAction, betAmount, currentStreet as Exclude<Street, "complete">, hero?.name);

    const updatedPlayers = players.map(p => (p.isHero ? { ...p, bet: betAmount } : p));
    setPlayers(updatedPlayers);

    // If we're in preflop, have AI finish the rest of the round after hero acts
    if (currentStreet === "preflop" && effectiveAction !== "fold") {
      try {
        scheduleAITimeout(() => { try { runPreflopRef.current?.("after-hero"); } catch {} }, AI_STEP_DELAY_MS);
      } catch {}
    } else if (currentStreet !== "preflop" && currentStreet !== "complete") {
      // Postflop: let AI respond to hero action (calls/raises) to settle the round properly
      const streetNow = currentStreet as Exclude<Street, "preflop" | "complete">;
      try {
        scheduleAITimeout(() => { try { runPostflopRef.current?.("after-hero", streetNow); } catch {} }, AI_STEP_DELAY_MS);
      } catch {}
    }

    const updatedTotalPot = getTotalPot();

    if (effectiveAction === "fold") {
      // Stop any AI immediately; hand is ending due to hero fold
      aiTimersRef.current.forEach(t => clearTimeout(t));
      aiTimersRef.current = [];
      aiRunningRef.current = false;
      awaitingHeroRef.current = false;

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

        // Reveal only opponents who did not fold for showdown
        const revealIds = new Set(
          updatedPlayers
            .filter(p => !p.isHero && !p.folded)
            .map(p => p.id)
        );
        setRevealedPlayers(revealIds);
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
    } // Removed auto-advance on non-final postflop streets; handled by postflop AI via settleAfterPostflop

    // Flash feedback
    triggerFlash(!!correct, Math.max(0, Math.round(feedbackSecs * 1000)));

    if (currentStreet === "preflop") {
      setTotalHands(t => t + 1);
      setCorrectHands(c => c + (correct ? 1 : 0));
    }

    const why = currentStreet === "preflop" ? `Score: ${heroScore} (Chen). ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.` : `${currentStreet} betting. Continue playing or fold.`;
    const resultText = currentStreet === "preflop"
      ? (correct ? `✅ ` : `❌ `) + `Recommended: ${recommended.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`
      : `${currentStreet.toUpperCase()} Action: ${effectiveAction.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`;
    setResult(resultText);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showFeedback && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
  }, [advanceStreet, autoNew, bigBlind, completeHand, currentStreet, dealTimerRef, deck.length, facingRaise, feedbackSecs, board.flop, board.river, board.turn, hero, heroScore, newHand, numPlayers, players, recommended, showCommunityCards, showFlop, showRiver, showTurn, triggerFlash, communityFromBoard, getTotalPot, finalizeHand, addActionWithPulse]);

  return {
    // settings
    showFeedback,
    showScore,
    showFlop,
    showCommunityCards,
    settings,
    setSettings,

    // game state
    players,
    currentStreet,
    board,
    foldedHand,
    heroWonHand,
    revealedPlayers,
    togglePlayerReveal,

    // stats
    heroAction,
    lastActionCorrect,
    result,
    totalHands,
    correctHands,

    // session
    currentSession,
    setCurrentSession,
    startNewSession,

    // ui
    isCompact,
    showSettings,
    setShowSettings,
    heroFlash,
    heroFlashOpacity,
    buttonsDisabled,

    // derived
    heroScore,
    canCheck,
    totalPot,
    betLabel,
    actionLabel,
    pulseKey,

    // actions
    dealTable,
    newHand,
    act,
  } as const;
}

export default useHoldemTrainer;

// ---------------- Internal helpers: simple preflop AI ---------------- //

function findIndexByRole(players: Player[], role: Player["role"]) {
  return players.findIndex((p) => p.role === role);
}

// UTG is the seat after the big blind in our rotated array [SB, BB, UTG, ...]
function utgIndex(players: Player[]): number {
  const bb = findIndexByRole(players, "BB");
  if (bb < 0) return 0;
  return (bb + 1) % players.length;
}

// Preflop acting order starts from UTG through to BB
function preflopOrder(players: Player[]): number[] {
  if (!players.length) return [];
  const start = utgIndex(players);
  const order: number[] = [];
  for (let i = 0; i < players.length; i++) order.push((start + i) % players.length);
  return order;
}

// Postflop acting order starts with first player after the button (SB if still in)
function btnIndex(players: Player[]): number {
  const btn = findIndexByRole(players, "Dealer");
  if (btn < 0) return 0;
  return btn;
}

function postflopOrder(players: Player[]): number[] {
  if (!players.length) return [];
  const start = (btnIndex(players) + 1) % players.length;
  const order: number[] = [];
  for (let i = 0; i < players.length; i++) order.push((start + i) % players.length);
  return order;
}
