import { ThemedText } from '@/components/ThemedText';

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

/**
 * Expo Router Tabs — app/(tabs)/index.tsx
 * - Title: Pre-Flop Trainer
 * - Header right: one-line stats + gear button to toggle Settings panel (persisted)
 * - Dealer advances each hand; hero seat fixed; SB at top, Dealer at bottom
 * - Row: [Cards LEFT] · [Position pill + Name, Chen text (hero only) MIDDLE] · [BIG $ bet pill RIGHT (SB/BB tag)]
 * - Actions: Check/Call/Fold/Raise (primary blue, equal width) + New hand button
 * - Hotkeys: c/a/f/r, Enter=repeat last action, Space=new hand (web + native via react-native-key-command if present)
 * - Settings panel (hidden by default): players, blinds, auto new, facing raise, feedback time, show why, show Chen score, reset stats
 * - Persisted prefs: showWhy, autoNew, facingRaise, feedbackSecs, showScore, showSettings
 * - Hero row flashes green/red; fade starts at 3/4 of feedback time
 */

type StorageLike = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

const Storage: StorageLike = (() => {
  try {
    const AS = require("@react-native-async-storage/async-storage").default;
    return {
      getItem: (k: string) => AS.getItem(k),
      setItem: (k: string, v: string) => AS.setItem(k, v),
    };
  } catch {
    return {
      getItem: async (k: string) =>
        typeof window !== "undefined" && (window as any).localStorage
          ? (window as any).localStorage.getItem(k)
          : null,
      setItem: async (k: string, v: string) => {
        if (typeof window !== "undefined" && (window as any).localStorage) {
          (window as any).localStorage.setItem(k, v);
        }
      },
    };
  }
})();

/* ---------------- Card / Deck helpers ---------------- */

type Suit = "♠" | "♥" | "♦" | "♣";
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
type Rank = typeof RANKS[number];

type CardT = { rank: Rank; suit: Suit };

function makeDeck(): CardT[] {
  const d: CardT[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  return d;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function cardToStr(c?: CardT) {
  return c ? `${c.rank}${c.suit}` : "";
}

/* ---------------- Hand Evaluation ---------------- */

function getRankValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14
  };
  return values[rank];
}

function evaluateHand(holeCards: [CardT, CardT], communityCards: CardT[]): number {
  const allCards = [...holeCards, ...communityCards];
  
  // Group by rank and suit
  const ranks: Record<string, number> = {};
  const suits: Record<string, number> = {};
  
  allCards.forEach(card => {
    ranks[card.rank] = (ranks[card.rank] || 0) + 1;
    suits[card.suit] = (suits[card.suit] || 0) + 1;
  });
  
  const rankCounts = Object.values(ranks).sort((a, b) => b - a);
  const isFlush = Object.values(suits).some(count => count >= 5);
  
  // Check for straight
  const uniqueRanks = Object.keys(ranks).map(rank => getRankValue(rank as Rank)).sort((a, b) => a - b);
  let isStraight = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
      isStraight = true;
      break;
    }
  }
  // Check for A-2-3-4-5 straight (wheel)
  if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
    isStraight = true;
  }
  
  // Hand rankings (higher = better)
  if (isStraight && isFlush) return 8; // Straight flush
  if (rankCounts[0] === 4) return 7; // Four of a kind
  if (rankCounts[0] === 3 && rankCounts[1] === 2) return 6; // Full house
  if (isFlush) return 5; // Flush
  if (isStraight) return 4; // Straight
  if (rankCounts[0] === 3) return 3; // Three of a kind
  if (rankCounts[0] === 2 && rankCounts[1] === 2) return 2; // Two pair
  if (rankCounts[0] === 2) return 1; // One pair
  return 0; // High card
}

function didHeroWin(hero: Player, otherPlayers: Player[], communityCards: CardT[]): boolean {
  const heroHandValue = evaluateHand(hero.cards, communityCards);
  
  // Check if hero beats at least one other player
  for (const player of otherPlayers) {
    const playerHandValue = evaluateHand(player.cards, communityCards);
    if (heroHandValue > playerHandValue) {
      return true;
    }
  }
  
  return false;
}

/* ---------------- Chen Formula heuristic ---------------- */

const chenRankValue: Record<Rank, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1,
};

function chenScore(c1: CardT, c2: CardT): number {
  const ranks = [c1.rank, c2.rank].sort((a, b) => chenRankValue[b] - chenRankValue[a]);
  const [rHigh, rLow] = ranks as [Rank, Rank];
  const suited = c1.suit === c2.suit;
  const gap = Math.abs(RANKS.indexOf(rHigh) - RANKS.indexOf(rLow)) - 1;

  let score = chenRankValue[rHigh];
  if (rHigh === rLow) score = Math.max(5, chenRankValue[rHigh] * 2);
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  if (suited) score += 2;
  return Math.round(score * 2) / 2;
}

function recommendAction(
  score: number,
  numPlayers: number,
  facingRaise: boolean
): "raise" | "call/check" | "fold" {
  const tableTightener = Math.max(0, (numPlayers - 6) * 0.7);
  if (facingRaise) {
    if (score >= 11 + tableTightener) return "raise";
    if (score >= 8 + tableTightener) return "call/check";
    return "fold";
  } else {
    if (score >= 9 + tableTightener) return "raise";
    if (score >= 6 + tableTightener) return "call/check";
    return "fold";
  }
}

/* ---------------- Types ---------------- */

type Player = {
  id: number;
  name: string;
  role: "Dealer" | "SB" | "BB" | "";
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
  positionLabel?: string;
};
type Action = "check" | "call" | "fold" | "raise";

function labelForPos(posFromDealer: number, n: number): string {
  if (posFromDealer === 0) return "Dealer"; // BTN
  if (posFromDealer === 1) return "SB";
  if (posFromDealer === 2) return "BB";
  const rest = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO"];
  return rest[posFromDealer - 3] || `Seat ${posFromDealer}`;
}

/* ---------------- UI bits ---------------- */

function withHotkey(label: string, hotkey: string) {
  const i = label.toLowerCase().indexOf(hotkey.toLowerCase());
  if (i === -1) return <Text>{label}</Text>;
  return (
    <ThemedText>
      {label.slice(0, i)}
      <ThemedText style={styles.underlineLetter}>{label[i]}</ThemedText>
      {label.slice(i + 1)}
    </ThemedText>
  );
}

const Pill: React.FC<{ text: string; large?: boolean }> = ({ text, large }) => (
  <View style={[styles.pill, large && styles.pillLarge]}>
    <Text style={[styles.pillText, large && styles.pillLargeText]}>{text}</Text>
  </View>
);

const PlayingCard: React.FC<{ card?: CardT; hidden?: boolean; compact?: boolean }> = ({ card, hidden, compact }) => {
  const red = card && (card.suit === "♥" || card.suit === "♦");
  const box = compact ? { width: 44, height: 60 } : { width: 50, height: 68 };
  const inner = compact ? { width: 36, height: 52 } : { width: 40, height: 58 };
  const font = compact ? { fontSize: 20 } : { fontSize: 22 };
  return (
    <View style={[styles.cardBox, box]}>
      {hidden ? (
        <View style={[styles.cardHidden, inner]} />
      ) : (
        <Text style={[styles.cardText, font, red && { color: "#d11" }]}>{cardToStr(card)}</Text>
      )}
    </View>
  );
};

const RowButton: React.FC<{
  label: React.ReactNode;
  onPress: () => void;
  kind?: "primary" | "secondary" | "outline";
  equal?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, kind = "secondary", equal = false, disabled = false }) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={({ pressed }) => [
      styles.btn,
      equal && styles.btnGrow,
      kind === "primary" && styles.btnPrimary,
      kind === "outline" && styles.btnOutline,
      disabled && styles.btnDisabled,
      !disabled && pressed && { opacity: 0.8 },
    ]}
    disabled={disabled}
  >
    <ThemedText style={[styles.btnText, kind === "primary" && { color: "#fff" }, disabled && styles.btnTextDisabled]}>{label}</ThemedText>
  </Pressable>
);

/* ---------------- Screen ---------------- */

export default function TexasHoldemTab() {
  const [numPlayers, setNumPlayers] = useState(6);
  const [bigBlind, setBigBlind] = useState(2);
  const [autoNew, setAutoNew] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [facingRaise, setFacingRaise] = useState(false);
  const [heroAction, setHeroAction] = useState<"" | Action>("");
  const [lastAction, setLastAction] = useState<"" | Action>("");
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<string>("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  const [feedbackSecs, setFeedbackSecs] = useState(1.0);
  const [showWhy, setShowWhy] = useState(false);
  const [showScore, setShowScore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlop, setShowFlop] = useState(false);
  const [showTurn, setShowTurn] = useState(false);
  const [showRiver, setShowRiver] = useState(false);
  const [flopCards, setFlopCards] = useState<[CardT, CardT, CardT] | null>(null);
  const [turnCard, setTurnCard] = useState<CardT | null>(null);
  const [riverCard, setRiverCard] = useState<CardT | null>(null);
  const [currentStreet, setCurrentStreet] = useState<"preflop" | "flop" | "turn" | "river" | "complete">("preflop");
  const [showAllCards, setShowAllCards] = useState(false);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [pot, setPot] = useState(0);
  const [foldedHand, setFoldedHand] = useState(false);
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false);
  const [showAutoNewTooltip, setShowAutoNewTooltip] = useState(false);
  const [showFacingRaiseTooltip, setShowFacingRaiseTooltip] = useState(false);
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const [showFlopTooltip, setShowFlopTooltip] = useState(false);
  const [showTurnTooltip, setShowTurnTooltip] = useState(false);
  const [showRiverTooltip, setShowRiverTooltip] = useState(false);
  const [showCommunityCards, setShowCommunityCards] = useState(false);
  const [showCommunityCardsTooltip, setShowCommunityCardsTooltip] = useState(false);
  const [heroWonHand, setHeroWonHand] = useState<boolean | null>(null);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());

  const isCompact = Platform.OS !== "web";

  // hero row flash (fade) state
  const [heroFlash, setHeroFlash] = useState<"none" | "correct" | "incorrect">("none");
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hero = useMemo(() => players.find((p) => p.isHero), [players]);

  // Function to toggle individual player card visibility
  const togglePlayerReveal = (playerId: number) => {
    setRevealedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Function to toggle feedback tooltip
  const toggleFeedbackTooltip = () => {
    if (showFeedbackTooltip) {
      setShowFeedbackTooltip(false);
    } else {
      // Close all other tooltips
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowFeedbackTooltip(true);
    }
  };

  const toggleAutoNewTooltip = () => {
    if (showAutoNewTooltip) {
      setShowAutoNewTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowAutoNewTooltip(true);
    }
  };

  const toggleFacingRaiseTooltip = () => {
    if (showFacingRaiseTooltip) {
      setShowFacingRaiseTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowFacingRaiseTooltip(true);
    }
  };

  const toggleScoreTooltip = () => {
    if (showScoreTooltip) {
      setShowScoreTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowScoreTooltip(true);
    }
  };

  const toggleFlopTooltip = () => {
    if (showFlopTooltip) {
      setShowFlopTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowFlopTooltip(true);
    }
  };

  const toggleTurnTooltip = () => {
    if (showTurnTooltip) {
      setShowTurnTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowTurnTooltip(true);
    }
  };

  const toggleRiverTooltip = () => {
    if (showRiverTooltip) {
      setShowRiverTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowCommunityCardsTooltip(false);
      setShowRiverTooltip(true);
    }
  };

  const toggleCommunityCardsTooltip = () => {
    if (showCommunityCardsTooltip) {
      setShowCommunityCardsTooltip(false);
    } else {
      // Close all other tooltips
      setShowFeedbackTooltip(false);
      setShowAutoNewTooltip(false);
      setShowFacingRaiseTooltip(false);
      setShowScoreTooltip(false);
      setShowFlopTooltip(false);
      setShowTurnTooltip(false);
      setShowRiverTooltip(false);
      setShowCommunityCardsTooltip(true);
    }
  };

  // Close all tooltips helper
  const closeAllTooltips = () => {
    setShowFeedbackTooltip(false);
    setShowAutoNewTooltip(false);
    setShowFacingRaiseTooltip(false);
    setShowScoreTooltip(false);
    setShowFlopTooltip(false);
    setShowTurnTooltip(false);
    setShowRiverTooltip(false);
    setShowCommunityCardsTooltip(false);
  };

  // Settings modal animation
  const settingsSlideAnim = useRef(new Animated.Value(0)).current;

  // Load persisted prefs first, then deal first hand
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const [sWhy, sAuto, sFacing, sSecs, sScore, sSettings, sFlop, sTurn, sRiver, sCommunityCards] = await Promise.all([
        Storage.getItem("poker.showWhy"),
        Storage.getItem("poker.autoNew"),
        Storage.getItem("poker.facingRaise"),
        Storage.getItem("poker.feedbackSecs"),
        Storage.getItem("poker.showScore"),
        Storage.getItem("poker.showSettings"),
        Storage.getItem("poker.showFlop"),
        Storage.getItem("poker.showTurn"),
        Storage.getItem("poker.showRiver"),
        Storage.getItem("poker.showCommunityCards"),
      ]);
      if (sWhy != null) setShowWhy(sWhy === "1");
      if (sAuto != null) setAutoNew(sAuto === "1");
      if (sFacing != null) setFacingRaise(sFacing === "1");
      if (sSecs != null) {
        const v = Math.max(0, Math.min(10, parseFloat(sSecs)));
        if (!Number.isNaN(v)) setFeedbackSecs(v);
      }
      if (sScore != null) setShowScore(sScore === "1");
      if (sSettings != null) setShowSettings(sSettings === "1");
      if (sFlop != null) setShowFlop(sFlop === "1");
      if (sTurn != null) setShowTurn(sTurn === "1");
      if (sRiver != null) setShowRiver(sRiver === "1");
      if (sCommunityCards != null) setShowCommunityCards(sCommunityCards === "1");
      setReady(true);
    })();
  }, []);

  // Persist prefs on change
  useEffect(() => { Storage.setItem("poker.showWhy", showWhy ? "1" : "0"); }, [showWhy]);
  useEffect(() => { Storage.setItem("poker.autoNew", autoNew ? "1" : "0"); }, [autoNew]);
  useEffect(() => { Storage.setItem("poker.facingRaise", facingRaise ? "1" : "0"); }, [facingRaise]);
  useEffect(() => { Storage.setItem("poker.feedbackSecs", String(feedbackSecs)); }, [feedbackSecs]);
  useEffect(() => { Storage.setItem("poker.showScore", showScore ? "1" : "0"); }, [showScore]);
  useEffect(() => { Storage.setItem("poker.showSettings", showSettings ? "1" : "0"); }, [showSettings]);
  useEffect(() => { Storage.setItem("poker.showFlop", showFlop ? "1" : "0"); }, [showFlop]);
  useEffect(() => { Storage.setItem("poker.showTurn", showTurn ? "1" : "0"); }, [showTurn]);
  useEffect(() => { Storage.setItem("poker.showRiver", showRiver ? "1" : "0"); }, [showRiver]);
  useEffect(() => { Storage.setItem("poker.showCommunityCards", showCommunityCards ? "1" : "0"); }, [showCommunityCards]);

  // Animate settings modal
  useEffect(() => {
    if (showSettings) {
      Animated.timing(settingsSlideAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(settingsSlideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
      // Close all tooltips when settings modal is closed
      closeAllTooltips();
    }
  }, [showSettings]);

  function dealTable(n: number) {
    setHeroFlash("none");
    heroFlashOpacity.setValue(0);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    let freshDeck = shuffle(makeDeck());
    const heroSeat = 0; // fixed hero seat

    // rotating dealer/button
    const g: any = (globalThis as any);
    if (typeof g.__BTN_SEAT__ !== "number") g.__BTN_SEAT__ = Math.floor(Math.random() * n);
    else g.__BTN_SEAT__ = (g.__BTN_SEAT__ + 1) % n;
    const btn: number = g.__BTN_SEAT__;

    // const ps: Array<Player> = Array.from({ length: n }).map((_, i) => ({
    const ps: Player[] = Array.from({ length: n }).map((_, i) => ({
      id: i,
      name: i === heroSeat ? "You" : `P${i + 1}`,
      role: "" as Player["role"],
      bet: 0,
      cards: [freshDeck.pop()!, freshDeck.pop()!] as [CardT, CardT],
      isHero: i === heroSeat,
      positionLabel: "",
    }));

    ps.forEach((p, idx) => {
      const pos = (idx - btn + n) % n; // 0=Dealer,1=SB,2=BB,3=UTG...
      if (pos === 0) p.role = "Dealer";
      else if (pos === 1) p.role = "SB";
      else if (pos === 2) p.role = "BB";
      p.positionLabel = labelForPos(pos, n);
    });

    // Set blinds and calculate initial pot
    let initialPot = 0;
    ps.forEach((p) => {
      if (p.role === "SB") {
        p.bet = Math.max(1, Math.floor(bigBlind / 2));
        initialPot += p.bet;
      }
      if (p.role === "BB") {
        p.bet = bigBlind;
        initialPot += p.bet;
      }
    });

    const sbIndex = ps.findIndex((p) => p.role === "SB");
    const rotated = sbIndex >= 0 ? [...ps.slice(sbIndex), ...ps.slice(0, sbIndex)] : ps;

    // Reset all community cards and street state
    setFlopCards(null);
    setTurnCard(null);
    setRiverCard(null);
    setCurrentStreet("preflop");
    setDeck(freshDeck); // Store remaining deck
    setPot(initialPot);
    setFoldedHand(false);
    setHeroWonHand(null);
    setRevealedPlayers(new Set()); // Reset revealed players

    setPlayers(rotated);
    setHeroAction("");
    setLastActionCorrect(null);
    setShowAllCards(false);
    if (!showWhy) setResult("");
  }

  function newHand() { dealTable(numPlayers); }

  useEffect(() => { if (ready) newHand(); }, [ready]);

  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(
    () => recommendAction(heroScore, numPlayers, facingRaise),
    [heroScore, numPlayers, facingRaise]
  );

  function resetStats() {
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    setResult(showWhy ? "Stats reset." : "");
  }

  function act(action: Action) {
    setHeroAction(action);
    setLastAction(action);
    
    // For post-flop streets, we don't use Chen scoring
    let correct = false;
    let bucket = "";
    
    if (currentStreet === "preflop") {
      bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
      correct = bucket === recommended;
    } else {
      // For post-flop, simplified logic - this could be enhanced with more sophisticated analysis
      correct = true; // For now, accept all post-flop actions as learning experiences
      bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
    }
    
    setLastActionCorrect(correct);

    // Update hero's bet based on action
    const currentBet = Math.max(...players.map(p => p.bet));
    const heroBet = players.find(p => p.isHero)?.bet || 0;
    let betAmount = 0;
    
    if (action === "call") {
      betAmount = currentBet;
    } else if (action === "raise") {
      if (currentBet === 0) {
        // If no one has bet, raise to the big blind amount
        betAmount = bigBlind;
      } else {
        // If there's already a bet, minimum raise is double the current bet
        betAmount = Math.max(currentBet * 2, bigBlind * 2);
      }
    } else if (action === "check") {
      betAmount = heroBet; // No change
    }
    // fold doesn't change bet amount
    
    setPlayers(prevPlayers => 
      prevPlayers.map(p => {
        if (p.isHero) {
          return { ...p, bet: betAmount };
        }
        return p;
      })
    );

    // Handle folding - end the hand
    if (action === "fold") {
      // Collect all current bets into the pot before ending
      const allBets = players.reduce((sum, p) => sum + p.bet, 0);
      setPot(prevPot => prevPot + allBets);
      setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
      setCurrentStreet("complete");
      setFoldedHand(true);
      // Don't deal additional community cards when folding
    } else {
      // Deal next cards based on current street using the stored deck
      if (showFlop && currentStreet === "preflop" && !flopCards && deck.length >= 3) {
        const newDeck = [...deck];
        const flop: [CardT, CardT, CardT] = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
        setFlopCards(flop);
        setDeck(newDeck);
        setCurrentStreet("flop");
        
        // Collect all bets into pot and reset for new betting round
        const allBets = players.reduce((sum, p) => sum + p.bet, 0);
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
        
      } else if (showFlop && showTurn && currentStreet === "flop" && flopCards && !turnCard && deck.length >= 1) {
        const newDeck = [...deck];
        const turn = newDeck.pop()!;
        setTurnCard(turn);
        setDeck(newDeck);
        setCurrentStreet("turn");
        
        // Collect all bets into pot and reset for new betting round
        const allBets = players.reduce((sum, p) => sum + p.bet, 0);
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
        
      } else if (showFlop && showTurn && showRiver && currentStreet === "turn" && turnCard && !riverCard && deck.length >= 1) {
        const newDeck = [...deck];
        const river = newDeck.pop()!;
        setRiverCard(river);
        setDeck(newDeck);
        setCurrentStreet("river");
        
        // Collect all bets into pot and reset for new betting round
        const allBets = players.reduce((sum, p) => sum + p.bet, 0);
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
        
      } else if (showFlop && showTurn && showRiver && currentStreet === "river") {
        // After river action, complete the hand and collect final bets
        const allBets = players.reduce((sum, p) => sum + p.bet, 0);
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
        setCurrentStreet("complete");
        // Don't automatically reveal all cards - let user choose
        // setShowAllCards(true); // Remove this line
        
        // Evaluate who won the hand
        if (hero && flopCards && turnCard && riverCard) {
          const communityCards = [...flopCards, turnCard, riverCard];
          const otherPlayers = players.filter(p => !p.isHero);
          const heroWon = didHeroWin(hero, otherPlayers, communityCards);
          setHeroWonHand(heroWon);
        }
      } else {
        // Hand ends early if settings don't allow further streets
        const allBets = players.reduce((sum, p) => sum + p.bet, 0);
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
        setCurrentStreet("complete");
        
        // If "Always show community cards" is enabled, deal missing cards for analysis
        if (showCommunityCards && deck.length > 0) {
          let newDeck = [...deck];
          
          // Deal flop if not dealt yet
          if (!flopCards && newDeck.length >= 3) {
            const flop: [CardT, CardT, CardT] = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
            setFlopCards(flop);
          }
          
          // Deal turn if not dealt yet
          if (flopCards && !turnCard && newDeck.length >= 1) {
            const turn = newDeck.pop()!;
            setTurnCard(turn);
          }
          
          // Deal river if not dealt yet
          if (flopCards && turnCard && !riverCard && newDeck.length >= 1) {
            const river = newDeck.pop()!;
            setRiverCard(river);
          }
          
          setDeck(newDeck);
        }
      }
    }

    setHeroFlash(correct ? "correct" : "incorrect");
    heroFlashOpacity.setValue(1);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    const totalMs = Math.max(0, Math.round(feedbackSecs * 1000));
    if (totalMs > 0) {
      const fadeStart = Math.floor(totalMs * 0.75);
      const fadeDuration = Math.max(200, totalMs - fadeStart);
      fadeTimerRef.current = setTimeout(() => {
        Animated.timing(heroFlashOpacity, {
          toValue: 0,
          duration: fadeDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(() => { fadeTimerRef.current = null; });
      }, fadeStart);
    } else {
      Animated.timing(heroFlashOpacity, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }

    // Only count pre-flop hands in statistics
    if (currentStreet === "preflop") {
      setTotalHands((t) => t + 1);
      setCorrectHands((c) => c + (correct ? 1 : 0));
    }

    let why = "";
    if (currentStreet === "preflop") {
      why = `score: ${heroScore} (Chen). ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.`;
    } else {
      why = `${currentStreet} betting. Continue playing or fold.`;
    }
    
    const resultText = currentStreet === "preflop" 
      ? (correct ? `✅ ` : `❌ `) + `Recommended: ${recommended.toUpperCase()}. ${why}`
      : `${currentStreet.toUpperCase()} action: ${action.toUpperCase()}. ${why}`;
      
    setResult(resultText);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showWhy && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
    
    // Auto new hand logic:
    // 1. If "Play flop" is OFF, deal new hand after any pre-flop action (skip post-flop)
    // 2. If enabled, deal new hand when hand is complete (folded or reached the furthest enabled street)
    const shouldAutoNew = autoNew && (
      (!showFlop && currentStreet === "preflop") || // Skip post-flop if flop play disabled
      (action === "fold") || // Always auto-deal after folding
      (showFlop && !showTurn && currentStreet === "flop") || // Auto-deal after flop if turn disabled
      (showFlop && showTurn && !showRiver && currentStreet === "turn") || // Auto-deal after turn if river disabled
      (showFlop && showTurn && showRiver && currentStreet === "river") // Auto-deal after river when all enabled
    );
    if (shouldAutoNew) {
      dealTimerRef.current = setTimeout(() => newHand(), delay);
    }
  }

  // Bet label with SB/BB shorthand (with "$")
  const betLabel = (p: Player) => {
    const tag = p.role === "SB" ? "SB" : p.role === "BB" ? "BB" : "";
    const amt = `$${p.bet}`;
    return tag ? `${amt} (${tag})` : amt;
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const isPlayerRevealed = showAllCards || revealedPlayers.has(item.id);
    
    return (
      <Pressable
        onPress={!item.isHero ? () => togglePlayerReveal(item.id) : undefined}
        style={({ pressed }) => [
          styles.row,
          { padding: isCompact ? 8 : 10 },
          item.isHero && styles.rowHero,
          !item.isHero && pressed && { opacity: 0.8 }
        ]}
      >
        {/* Fade overlay only for hero */}
        {item.isHero && heroFlash !== "none" && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rowOverlay,
              { backgroundColor: heroFlash === "correct" ? "#b9efd2" : "#f8c7cc", opacity: heroFlashOpacity },
            ]}
          />
        )}

        {/* LEFT: cards */}
        <View style={styles.cardsCol}>
          <PlayingCard card={item.cards[0]} hidden={!item.isHero && !isPlayerRevealed} compact={isCompact} />
          <PlayingCard card={item.cards[1]} hidden={!item.isHero && !isPlayerRevealed} compact={isCompact} />
        </View>

        {/* MIDDLE: [Position pill] + [Name] inline; Chen score text (hero only) under it */}
        <View style={styles.metaCol}>
          <View style={styles.nameRow}>
            {!!item.positionLabel && (
              <View style={[styles.badge, positionBadgeStyle(item.positionLabel)]}>
                <Text style={[styles.badgeText, isCompact && { fontSize: 13 }]}>{item.positionLabel}</Text>
              </View>
            )}
            <Text style={[styles.playerName, isCompact && { fontSize: 16 }]}>{item.name}</Text>
          </View>
          {item.isHero && showScore ? (
            <Text style={[styles.playerSub, isCompact && { fontSize: 11 }]}>Score: {heroScore} (Chen)</Text>
          ) : null}
          {!item.isHero && isPlayerRevealed && showScore ? (
            <Text style={[styles.playerSub, isCompact && { fontSize: 11 }]}>Score: {chenScore(item.cards[0], item.cards[1])} (Chen)</Text>
          ) : null}
        </View>

        {/* RIGHT: BIG $ bet pill (amount only; adds SB/BB tag) */}
        <View style={styles.tailCol}>
          <Pill large text={betLabel(item)} />
        </View>
      </Pressable>
    );
  };

  const accuracyPct = totalHands ? ((correctHands / totalHands) * 100).toFixed(1) : "0.0";
  const formatAction = (a: "" | Action) => (a ? a[0].toUpperCase() + a.slice(1) : "—");

  // Check if hero can check (no bet to call)
  const currentBet = Math.max(...players.map(p => p.bet));
  const heroBet = hero?.bet || 0;
  const canCheck = heroBet >= currentBet;
  
  // Calculate total pot
  const totalPot = pot + players.reduce((sum, player) => sum + player.bet, 0);

  /* --- Hotkeys (web): c/a/f/r, Enter repeat, Space new --- */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: any) => {
      const target = e.target as HTMLElement | null;
      const tag = target && (target.tagName || "").toLowerCase();
      const editable = target && (target as any).isContentEditable;
      if (tag === "input" || tag === "textarea" || editable) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "c") act("check");
      else if (k === "a") act("call");
      else if (k === "f") act("fold");
      else if (k === "r") act("raise");
      else if (k === "enter") { if (heroAction) act(heroAction); }
      else if (k === " " || k === "spacebar") { e.preventDefault(); newHand(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [heroAction, newHand]);

  /* --- Hotkeys (native, optional): requires `react-native-key-command` --- */
  useEffect(() => {
    if (Platform.OS === "web") return;
    let KeyCommand: any = null;
    try { KeyCommand = require("react-native-key-command"); } catch { return; }
    // const unsubscribers: Array<() => void> = [];
    const unsubscribers: (() => void)[] = [];
    const add = (input: any, cb: () => void) => { try { const off = KeyCommand.addListener({ input }, cb); unsubscribers.push(off); } catch {} };
    add("c", () => act("check"));
    add("a", () => act("call"));
    add("f", () => act("fold"));
    add("r", () => act("raise"));
    add("\n", () => { if (heroAction) act(heroAction); });
    add("enter", () => { if (heroAction) act(heroAction); });
    if (KeyCommand.constants?.keyInputEnter) add(KeyCommand.constants.keyInputEnter, () => { if (heroAction) act(heroAction); });
    add(" ", () => newHand());
    add("space", () => newHand());
    if (KeyCommand.constants?.keyInputSpace) add(KeyCommand.constants.keyInputSpace, () => newHand());
    return () => { unsubscribers.forEach((off) => typeof off === "function" && off()); };
  }, [heroAction, newHand]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        {/* Header with one-line stats (no gear here) */}
        <View style={styles.header}>
          <Text style={styles.title}>Texas Holdem</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerStats} numberOfLines={1}>
              {correctHands}/{totalHands} • Accuracy: {accuracyPct}%
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showSettings ? "Hide settings" : "Show settings"}
              onPress={() => setShowSettings((s) => !s)}
              style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name={showSettings ? "close" : "settings-outline"} size={18} color="#2b2e57"/>
            </Pressable>
          </View>
        </View>

        {/* Feedback row: always visible when Show why is ON; shows last action pill and pot */}
        {showWhy && (
          <View style={[
            styles.card,
            lastActionCorrect === true && { backgroundColor: "#b9efd2" },
            lastActionCorrect === false && { backgroundColor: "#f8c7cc" }
          ]}>
            <View style={styles.feedbackRow}>
              <Text style={[styles.feedbackText, { flex: 1, paddingRight: 8 }]}>
                {result || "Take an action to see feedback."}
              </Text>
              <View style={styles.feedbackRight}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Last: {formatAction(lastAction)}</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.potText}>Pot: ${totalPot}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Community Cards Row */}
        {((showFlop && (flopCards || (currentStreet !== "preflop" && !foldedHand) || (currentStreet === "complete" && showCommunityCards))) || showCommunityCards) && (
          <View style={[
            styles.card, 
            styles.flopCard,
            heroWonHand === true && { backgroundColor: "#b9efd2" }, // Green for win
            heroWonHand === false && { backgroundColor: "#f8c7cc" }, // Red for loss
          ]}>
            <View style={styles.flopRow}>
              <View style={styles.revealButton}>
                <RowButton 
                  label={<Text>{showAllCards ? "Hide" : "Reveal"}</Text>} 
                  onPress={() => setShowAllCards(!showAllCards)} 
                  kind="outline" 
                />
              </View>
              <View style={[styles.flopCards, { flex: 1, justifyContent: "center" }]}>
                {/* Show placeholder text when no cards are dealt yet but always show is enabled */}
                {!flopCards && !turnCard && !riverCard && showCommunityCards && (
                  <Text style={styles.streetLabel}>Community cards will appear here</Text>
                )}
                {/* Flop Cards */}
                {flopCards && (
                  <>
                    <PlayingCard card={flopCards[0]} compact={isCompact} />
                    <PlayingCard card={flopCards[1]} compact={isCompact} />
                    <PlayingCard card={flopCards[2]} compact={isCompact} />
                  </>
                )}
                {/* Turn Card */}
                {turnCard && <PlayingCard card={turnCard} compact={isCompact} />}
                {/* River Card */}
                {riverCard && <PlayingCard card={riverCard} compact={isCompact} />}
              </View>
              <View style={styles.communityActions}>
                <Text style={styles.streetLabel}>{foldedHand ? "FOLDED" : currentStreet.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Table */}
        <FlatList
          data={players}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderPlayer}
          contentContainerStyle={{ gap: 8 }}
        />

        {/* Actions — show betting actions during play, new hand button when complete */}
        <View style={styles.actionsRow}>
          {currentStreet === "complete" ? (
            <RowButton 
              label={<Text>New Hand</Text>} 
              onPress={newHand} 
              kind="primary" 
              equal 
            />
          ) : (
            <View style={styles.actionsLeft}>
              <RowButton equal kind="primary" onPress={() => act("raise")} label={withHotkey("Raise", "r")} />
              <RowButton equal kind="primary" onPress={() => act("call")}  label={withHotkey("Call",  "a")} />
              <RowButton equal kind="primary" onPress={() => act("check")} label={withHotkey("Check", "c")} disabled={!canCheck} />
              <RowButton equal kind="primary" onPress={() => act("fold")}  label={withHotkey("Fold",  "f")} />
            </View>
          )}
        </View>

        {/* Footer: helper text left */}
        <View style={styles.footerRow}>
          <Text style={styles.helper}>Educational trainer (not a full equity/GTO engine).</Text>
        </View>
      </ScrollView>

      {/* Settings panel (toggle via gear) - Outside ScrollView to prevent scroll bars */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => setShowSettings(false)}
          />
          <Animated.View 
            style={[
              styles.modalSheet,
              {
                transform: [{
                  translateY: settingsSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  })
                }]
              }
            ]}
          >
            <View style={styles.modalHandle} />
            
            {/* Floating tooltips */}
            {showFeedbackTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowFeedbackTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, shows feedback after each action.
                  </Text>
                </View>
              </>
            )}
            {showAutoNewTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowAutoNewTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, a new hand is automatically dealt after the feedback delay expires.
                  </Text>
                </View>
              </>
            )}
            {showFacingRaiseTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowFacingRaiseTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    Simulates a scenario where another player has already raised, requiring tighter hand selection.
                  </Text>
                </View>
              </>
            )}
            {showScoreTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowScoreTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    Shows your hand's Chen score, a quick evaluation system for pre-flop hand strength.
                  </Text>
                </View>
              </>
            )}
            {showFlopTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowFlopTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, play continues to the flop, turn, and river after your pre-flop action (except fold).
                  </Text>
                </View>
              </>
            )}
            {showTurnTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowTurnTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, play continues to the turn after flop betting (requires Play flop to be enabled).
                  </Text>
                </View>
              </>
            )}
            {showRiverTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowRiverTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, play continues to the river after turn betting (requires Play flop and Play turn to be enabled).
                  </Text>
                </View>
              </>
            )}
            {showCommunityCardsTooltip && (
              <>
                <Pressable 
                  style={styles.tooltipBackdrop}
                  onPress={() => setShowCommunityCardsTooltip(false)}
                />
                <View style={styles.floatingTooltip}>
                  <Text style={styles.tooltipText}>
                    When enabled, community cards (flop, turn, river) are automatically revealed at the end of each hand for analysis.
                  </Text>
                </View>
              </>
            )}
            
            <View style={styles.card}>
              <View style={styles.controlsRow}>
                <View style={styles.controlBlock}>
                  <ThemedText style={styles.label}>Players</ThemedText>
                  <View style={styles.stepper}>
                    <RowButton label={<Text>-</Text>} onPress={() => { const next = Math.max(2, numPlayers - 1); setNumPlayers(next); dealTable(next); }} />
                    <Text style={styles.stepperNum}>{numPlayers}</Text>
                    <RowButton label={<Text>+</Text>} onPress={() => { const next = Math.min(9, numPlayers + 1); setNumPlayers(next); dealTable(next); }} />
                  </View>
                </View>
                <View style={styles.controlBlock}>
                  <Text style={styles.label}>Big blind</Text>
                  <TextInput
                    value={String(bigBlind)}
                    onChangeText={(t) => { const next = Math.max(1, Number(t.replace(/[^0-9]/g, "")) || 1); setBigBlind(next); dealTable(numPlayers); }}
                    inputMode="numeric"
                    keyboardType={Platform.select({ ios: "number-pad", android: "numeric", default: "numeric" })}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch value={autoNew} onValueChange={(v) => { setAutoNew(v); dealTable(numPlayers); }} />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Automatically deal new hand</Text>
                    <Pressable
                      onPress={toggleAutoNewTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <Switch value={facingRaise} onValueChange={(v) => { setFacingRaise(v); dealTable(numPlayers); }} />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Facing a raise</Text>
                    <Pressable
                      onPress={toggleFacingRaiseTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={[styles.controlBlock, { width: "100%" }]}>
                  <Text style={styles.label}>Feedback time (seconds) — also delays auto new hand</Text>
                  <View style={[styles.stepper, { justifyContent: "flex-start" }]}>
                    <RowButton label={<Text>-</Text>} onPress={() => setFeedbackSecs((s) => Math.max(0, parseFloat((s - 0.5).toFixed(1))))} />
                    <Text style={styles.stepperNum}>{feedbackSecs.toFixed(1)}s</Text>
                    <RowButton label={<Text>+</Text>} onPress={() => setFeedbackSecs((s) => Math.min(10, parseFloat((s + 0.5).toFixed(1))))} />
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch value={showWhy} onValueChange={setShowWhy} />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Show feedback</Text>
                    <Pressable
                      onPress={toggleFeedbackTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch value={showScore} onValueChange={setShowScore} />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Show hand score</Text>
                    <Pressable
                      onPress={toggleScoreTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch value={showFlop} onValueChange={(v) => { setShowFlop(v); dealTable(numPlayers); }} />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Play flop</Text>
                    <Pressable
                      onPress={toggleFlopTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch 
                    value={showTurn} 
                    onValueChange={(v) => { setShowTurn(v); dealTable(numPlayers); }} 
                    disabled={!showFlop}
                  />
                  <View style={styles.labelWithIcon}>
                    <Text style={[styles.switchLabel, !showFlop && { color: "#999" }]}>Play turn</Text>
                    <Pressable
                      onPress={toggleTurnTooltip}
                      style={styles.infoIcon}
                      disabled={!showFlop}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={showFlop ? "#666" : "#ccc"} />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.controlsRow}>
                <View style={styles.switchRow}>
                  <Switch 
                    value={showRiver} 
                    onValueChange={(v) => { setShowRiver(v); dealTable(numPlayers); }} 
                    disabled={!showFlop || !showTurn}
                  />
                  <View style={styles.labelWithIcon}>
                    <Text style={[styles.switchLabel, (!showFlop || !showTurn) && { color: "#999" }]}>Play river</Text>
                    <Pressable
                      onPress={toggleRiverTooltip}
                      style={styles.infoIcon}
                      disabled={!showFlop || !showTurn}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={(showFlop && showTurn) ? "#666" : "#ccc"} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <Switch 
                    value={showCommunityCards} 
                    onValueChange={setShowCommunityCards} 
                  />
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.switchLabel}>Always show community cards</Text>
                    <Pressable
                      onPress={toggleCommunityCardsTooltip}
                      style={styles.infoIcon}
                    >
                      <Ionicons name="information-circle-outline" size={16} color="#666" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <RowButton label={<Text>Reset stats</Text>} onPress={resetStats} kind="outline" />
                <RowButton label={<Text>New hand</Text>} onPress={newHand} kind="outline" />
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

/* Position badge colors */
function positionBadgeStyle(label?: string) {
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

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#000" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  // headerStats: { fontSize: 13, color: "#333", flexShrink: 1, textAlign: "right" },
  headerStats: { fontSize: 13, flexShrink: 1, textAlign: "right", color: "#666" },

  gearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eef1ff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 38,
  },
  gearText: { fontSize: 18, color: "#2b2e57", fontWeight: "700" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  flopCard: { backgroundColor: "#f0f6ff" },

  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  controlBlock: { width: "48%" },
  label: { fontSize: 12, color: "#555", marginBottom: 6 },
  input: { backgroundColor: "#f2f2f6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperNum: { width: 60, textAlign: "center", fontSize: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 14 },
  labelWithIcon: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoIcon: { padding: 2 },
  tooltipBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  floatingTooltip: { 
    position: "absolute",
    width: 320,
    backgroundColor: "#2d3748",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    left: "50%",
    top: "50%",
    marginLeft: -160, // Half of width to center horizontally
    marginTop: -50,   // Adjust to center vertically over modal
  },
  tooltipText: { color: "#fff", fontSize: 12, lineHeight: 16 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10, position: "relative", overflow: "hidden" },
  rowOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },

  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },

  // LEFT cards
  cardsCol: { flexDirection: "row", gap: 6 },

  // MIDDLE meta
  metaCol: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 }, // position pill + name inline
  playerName: { fontWeight: "600", fontSize: 18 },
  playerSub: { color: "#666", fontSize: 12 },

  // RIGHT: big bet pill only
  tailCol: { alignItems: "flex-end", justifyContent: "center" },

  cardBox: { width: 50, height: 68, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cardHidden: { width: 40, height: 58, borderRadius: 8, backgroundColor: "#e6e6ee" },
  cardText: { fontSize: 22, fontWeight: "700" },

  btn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef1ff", borderRadius: 10, alignItems: "center" },
  btnPrimary: { backgroundColor: "#4f6df6" },
  btnOutline: { backgroundColor: "#fff", borderColor: "#d0d0e0", borderWidth: 1 },
  btnDisabled: { backgroundColor: "#f5f5f5", opacity: 0.6 },
  btnText: { color: "#2b2e57", fontWeight: "600" },
  btnTextDisabled: { color: "#999" },
  btnGrow: { flex: 1 },

  underlineLetter: { textDecorationLine: "underline" },

  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },
  potText: { fontSize: 14, fontWeight: "600", color: "#444" },

  // Bigger variant for Bet
  pillLarge: { paddingHorizontal: 12, paddingVertical: 6 },
  pillLargeText: { fontSize: 16, fontWeight: "700" },

  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  actionsLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },

  feedbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  feedbackText: { fontSize: 14, color: "#333" },
  feedbackRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  flopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flopLabel: { fontSize: 16, fontWeight: "600", color: "#333" },
  flopCards: { flexDirection: "row", gap: 6 },
  flopButtons: { flexDirection: "row", gap: 8 },
  revealButton: { width: 80 },

  communityActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  streetLabel: { fontSize: 14, fontWeight: "600", color: "#666", textTransform: "uppercase" },

  helper: { color: "#666", fontSize: 12 },

  // Footer row with centered helper text
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  // badge
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 14, fontWeight: "600" },

  // Modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
});