import { makeDeck, shuffle, type CardT } from "@/lib/cards";
import { chenScore, recommendAction } from "@/lib/chen";
import { didHeroWin } from "@/lib/hand-eval";
import { labelForPos } from "@/lib/positions";
import Storage from "@/lib/storage";
import type { Action, HandAction, HandHistory, Player, Session, Street } from "@/models/poker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";

export type UseHoldemTrainerOptions = {
  initialNumPlayers?: number;
  initialBigBlind?: number;
};

export function useHoldemTrainer(opts: UseHoldemTrainerOptions = {}) {
  const { initialNumPlayers = 6, initialBigBlind = 2 } = opts;

  // Settings
  const [numPlayers, setNumPlayers] = useState(initialNumPlayers);
  const [bigBlind, setBigBlind] = useState(initialBigBlind);
  const [autoNew, setAutoNew] = useState(true);
  const [facingRaise, setFacingRaise] = useState(true);
  const [showFeedback, setShowFeedback] = useState(true);
  const [feedbackSecs, setFeedbackSecs] = useState(1.0);
  const [showScore, setShowScore] = useState(true);
  const [showFlop, setShowFlop] = useState(false);
  const [showTurn, setShowTurn] = useState(false);
  const [showRiver, setShowRiver] = useState(false);
  const [showCommunityCards, setShowCommunityCards] = useState(false);

  // Game state
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [currentStreet, setCurrentStreet] = useState<Street>("preflop");
  const [pot, setPot] = useState(0);
  const [flopCards, setFlopCards] = useState<[CardT, CardT, CardT] | null>(null);
  const [turnCard, setTurnCard] = useState<CardT | null>(null);
  const [riverCard, setRiverCard] = useState<CardT | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [foldedHand, setFoldedHand] = useState(false);
  const [heroWonHand, setHeroWonHand] = useState<boolean | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());

  // Stats
  const [heroAction, setHeroAction] = useState<"" | Action>("");
  const [lastAction, setLastAction] = useState<"" | Action>("");
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);

  // Session
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentHandHistory, setCurrentHandHistory] = useState<HandHistory | null>(null);

  // UI/animation
  const [showSettings, setShowSettings] = useState(false);
  const isCompact = Platform.OS !== "web";
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;
  const [heroFlash, setHeroFlash] = useState<"none" | "correct" | "incorrect">("none");

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hero = useMemo(() => players.find(p => p.isHero), [players]);
  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(() => recommendAction(heroScore, numPlayers, facingRaise), [heroScore, numPlayers, facingRaise]);

  // Persisted settings load
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const [sWhy, sAuto, sFacing, sSecs, sScore, sFlop, sTurn, sRiver, sCommunity] = await Promise.all([
        Storage.getItem("poker.showFeedback"),
        Storage.getItem("poker.autoNew"),
        Storage.getItem("poker.facingRaise"),
        Storage.getItem("poker.feedbackSecs"),
        Storage.getItem("poker.showScore"),
        Storage.getItem("poker.showFlop"),
        Storage.getItem("poker.showTurn"),
        Storage.getItem("poker.showRiver"),
        Storage.getItem("poker.showCommunityCards"),
      ]);
      if (sWhy != null) setShowFeedback(sWhy === "1");
      if (sAuto != null) setAutoNew(sAuto === "1");
      if (sFacing != null) setFacingRaise(sFacing === "1");
      if (sSecs != null) {
        const v = Math.max(0, Math.min(10, parseFloat(sSecs)));
        if (!Number.isNaN(v)) setFeedbackSecs(v);
      }
      if (sScore != null) setShowScore(sScore === "1");
      if (sFlop != null) setShowFlop(sFlop === "1");
      if (sTurn != null) setShowTurn(sTurn === "1");
      if (sRiver != null) setShowRiver(sRiver === "1");
      if (sCommunity != null) setShowCommunityCards(sCommunity === "1");
      setReady(true);
    })();
  }, []);

  // Persist settings
  useEffect(() => { Storage.setItem("poker.showFeedback", showFeedback ? "1" : "0"); }, [showFeedback]);
  useEffect(() => { Storage.setItem("poker.autoNew", autoNew ? "1" : "0"); }, [autoNew]);
  useEffect(() => { Storage.setItem("poker.facingRaise", facingRaise ? "1" : "0"); }, [facingRaise]);
  useEffect(() => { Storage.setItem("poker.feedbackSecs", String(feedbackSecs)); }, [feedbackSecs]);
  useEffect(() => { Storage.setItem("poker.showScore", showScore ? "1" : "0"); }, [showScore]);
  useEffect(() => { Storage.setItem("poker.showFlop", showFlop ? "1" : "0"); }, [showFlop]);
  useEffect(() => { Storage.setItem("poker.showTurn", showTurn ? "1" : "0"); }, [showTurn]);
  useEffect(() => { Storage.setItem("poker.showRiver", showRiver ? "1" : "0"); }, [showRiver]);
  useEffect(() => { Storage.setItem("poker.showCommunityCards", showCommunityCards ? "1" : "0"); }, [showCommunityCards]);

  // Session load/init
  useEffect(() => {
    if (ready && !currentSession) {
      (async () => {
        const json = await Storage.getItem("poker.currentSession");
        if (json) setCurrentSession(JSON.parse(json) as Session);
        else startNewSession();
      })();
    }
  }, [ready, currentSession]);

  useEffect(() => { if (currentSession) Storage.setItem("poker.currentSession", JSON.stringify(currentSession)); }, [currentSession]);

  const betLabel = useCallback((p: Player) => {
    const tag = p.role === "SB" ? "SB" : p.role === "BB" ? "BB" : "";
    const amt = `$${p.bet}`;
    return tag ? `${amt} (${tag})` : amt;
  }, []);

  const dealTable = useCallback((n: number) => {
    setHeroFlash("none");
    heroFlashOpacity.setValue(0);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    let freshDeck = shuffle(makeDeck());
    const heroSeat = 0;

    const g: any = (globalThis as any);
    if (typeof g.__BTN_SEAT__ !== "number") g.__BTN_SEAT__ = Math.floor(Math.random() * n);
    else g.__BTN_SEAT__ = (g.__BTN_SEAT__ + 1) % n;
    const btn: number = g.__BTN_SEAT__;

    const ps: Player[] = Array.from({ length: n }).map((_, i) => ({
      id: i,
      name: i === heroSeat ? "Hero" : `Player ${i + 1}`,
      role: "" as Player["role"],
      bet: 0,
      cards: [freshDeck.pop()!, freshDeck.pop()!] as [CardT, CardT],
      isHero: i === heroSeat,
      positionLabel: "",
    }));

    ps.forEach((p, idx) => {
      const pos = (idx - btn + n) % n;
      if (pos === 0) p.role = "Dealer";
      else if (pos === 1) p.role = "SB";
      else if (pos === 2) p.role = "BB";
      p.positionLabel = labelForPos(pos, n);
    });

    ps.forEach((p) => {
      if (p.role === "SB") p.bet = Math.max(1, Math.floor(bigBlind / 2));
      if (p.role === "BB") p.bet = bigBlind;
    });

    const sbIndex = ps.findIndex((p) => p.role === "SB");
    const rotated = sbIndex >= 0 ? [...ps.slice(sbIndex), ...ps.slice(0, sbIndex)] : ps;

    setFlopCards(null);
    setTurnCard(null);
    setRiverCard(null);
    setCurrentStreet("preflop");
    setDeck(freshDeck);
    setPot(0);
    setFoldedHand(false);
    setHeroWonHand(null);
    setRevealedPlayers(new Set());

    setPlayers(rotated);
    setHeroAction("");
    setLastActionCorrect(null);
    setShowAllCards(false);
    if (!showFeedback) setResult("");

    if (currentSession) {
      const hh = createHandHistory(rotated);
      setCurrentHandHistory(hh);
    }
  }, [bigBlind, currentSession, heroFlashOpacity, showFeedback]);

  const newHand = useCallback(() => dealTable(numPlayers), [dealTable, numPlayers]);

  // Auto-deal first hand once ready and session exists
  useEffect(() => {
    if (!ready) return;
    if (!currentSession) return;
    if (players.length > 0) return;
    if (deck.length > 0) return;
    if (flopCards || turnCard || riverCard) return;
    dealTable(numPlayers);
  }, [ready, currentSession, players.length, deck.length, flopCards, turnCard, riverCard, dealTable, numPlayers]);

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
    else if (action === "raise") betAmount = currentBet === 0 ? bigBlind : currentBet + Math.max(currentBet, bigBlind);
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
        setPot(prev => prev + allBets);
        setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
      }, settleDelayMs);
      setCurrentStreet("complete");
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
    } else {
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      advanceStreetTimerRef.current = setTimeout(() => {
        if (showFlop && currentStreet === "preflop" && !flopCards && deck.length >= 3) {
          const newDeck = [...deck];
          const flop: [CardT, CardT, CardT] = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
          setFlopCards(flop);
          setDeck(newDeck);
          setCurrentStreet("flop");
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prev => prev + allBets);
          setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
        } else if (showFlop && showTurn && currentStreet === "flop" && flopCards && !turnCard && deck.length >= 1) {
          const newDeck = [...deck];
          const turn = newDeck.pop()!;
          setTurnCard(turn);
          setDeck(newDeck);
          setCurrentStreet("turn");
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prev => prev + allBets);
          setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
        } else if (showFlop && showTurn && showRiver && currentStreet === "turn" && turnCard && !riverCard && deck.length >= 1) {
          const newDeck = [...deck];
          const river = newDeck.pop()!;
          setRiverCard(river);
          setDeck(newDeck);
          setCurrentStreet("river");
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prev => prev + allBets);
          setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
        } else if (showFlop && showTurn && showRiver && currentStreet === "river") {
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          const finalPot = pot + allBets;
          setPot(prev => prev + allBets);
          setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
          setCurrentStreet("complete");
          const allPlayerIds = new Set(updatedPlayers.map(p => p.id).filter(id => id !== hero?.id));
          setRevealedPlayers(allPlayerIds);
          let heroWon: boolean | undefined = undefined;
          if (hero && flopCards && turnCard && riverCard) {
            const communityCards = [...flopCards, turnCard, riverCard];
            const others = updatedPlayers.filter(p => !p.isHero);
            heroWon = didHeroWin(hero, others, communityCards);
            setHeroWonHand(heroWon);
          }
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: finalPot,
              result: "completed" as const,
              heroWon,
              communityCards: { flop: flopCards!, turn: turnCard!, river: riverCard! },
            };
            setCurrentSession(prev => prev ? { ...prev, hands: [...prev.hands, updatedHistory] } : prev);
            setCurrentHandHistory(null);
          }
        } else {
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          const finalPot = pot + allBets;
          setPot(prev => prev + allBets);
          setPlayers(prev => prev.map(p => ({ ...p, bet: 0 })));
          setCurrentStreet("complete");
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: finalPot,
              result: "completed" as const,
              communityCards: { ...(flopCards && { flop: flopCards }), ...(turnCard && { turn: turnCard }), ...(riverCard && { river: riverCard }) },
            };
            setCurrentSession(prev => prev ? { ...prev, hands: [...prev.hands, updatedHistory] } : prev);
            setCurrentHandHistory(null);
          }
          if (showCommunityCards && showFlop && deck.length > 0) {
            let newDeck = [...deck];
            if (!flopCards && newDeck.length >= 3) {
              const flop: [CardT, CardT, CardT] = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
              setFlopCards(flop);
            }
            if (flopCards && !turnCard && newDeck.length >= 1) {
              const turn = newDeck.pop()!;
              setTurnCard(turn);
            }
            if (flopCards && turnCard && !riverCard && newDeck.length >= 1) {
              const river = newDeck.pop()!;
              setRiverCard(river);
            }
            setDeck(newDeck);
          }
        }
      }, delayMs);
    }

    setHeroFlash(correct ? "correct" : "incorrect");
    heroFlashOpacity.setValue(1);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    const totalMs = Math.max(0, Math.round(feedbackSecs * 1000));
    if (totalMs > 0) {
      const fadeStart = Math.floor(totalMs * 0.75);
      const fadeDuration = Math.max(200, totalMs - fadeStart);
      fadeTimerRef.current = setTimeout(() => {
        Animated.timing(heroFlashOpacity, { toValue: 0, duration: fadeDuration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { fadeTimerRef.current = null; });
      }, fadeStart);
    } else {
      Animated.timing(heroFlashOpacity, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }

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
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showFeedback && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);

    const shouldAutoNew = autoNew && (
      (!showFlop && currentStreet === "preflop") ||
      (action === "fold") ||
      (showFlop && !showTurn && currentStreet === "flop") ||
      (showFlop && showTurn && !showRiver && currentStreet === "turn") ||
      (showFlop && showTurn && showRiver && currentStreet === "river")
    );
    if (shouldAutoNew) {
      dealTimerRef.current = setTimeout(() => newHand(), delay);
    }
  }, [autoNew, bigBlind, currentHandHistory, currentStreet, dealTimerRef, deck, facingRaise, feedbackSecs, flopCards, hero, heroScore, newHand, numPlayers, players, pot, recommended, riverCard, showCommunityCards, showFeedback, showFlop, showRiver, showTurn, turnCard]);

  const canCheck = useMemo(() => {
    const currentBet = Math.max(...players.map(p => p.bet));
    const heroBet = hero?.bet || 0;
    return heroBet >= currentBet;
  }, [players, hero]);

  const totalPot = useMemo(() => pot + players.reduce((sum, player) => sum + player.bet, 0), [players, pot]);

  const togglePlayerReveal = useCallback((playerId: number) => {
    setRevealedPlayers(prev => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  }, []);

  const startNewSession = useCallback(() => {
    const session: Session = { id: `session_${Date.now()}`, startTime: Date.now(), hands: [] };
    setCurrentSession(session);
    setCurrentHandHistory(null);
    Storage.setItem("poker.currentSession", JSON.stringify(session));
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    setResult(showFeedback ? "New session started. Stats reset." : "");
  }, [showFeedback]);

  const downloadSessionExport = useCallback(() => {
    if (!currentSession || currentSession.hands.length === 0) return;
    // Reuse existing export logic from screen for now (could be moved to lib/export later)
    // Caller should handle presenting the string
  }, [currentSession]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    [hideTimerRef, dealTimerRef, fadeTimerRef, advanceStreetTimerRef].forEach(ref => {
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
