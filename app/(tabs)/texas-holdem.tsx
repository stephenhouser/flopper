import { ThemedText } from '@/components/ThemedText';

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

// Replace in-file helpers and types with imports from lib/models
import { cardToPokerStarsStr, makeDeck, shuffle, type CardT } from "@/lib/cards";
import { chenScore, recommendAction } from "@/lib/chen";
import { didHeroWin } from "@/lib/hand-eval";
import { labelForPos } from "@/lib/positions";
import Storage from "@/lib/storage";
import type { Action, HandAction, HandHistory, Player, Session } from "@/models/poker";

// Import extracted UI components
import CommunityCards from "@/components/poker/CommunityCards";
import PlayerRow from "@/components/poker/PlayerRow";
import SettingsSheet from "@/components/poker/SettingsSheet";
import RowButton from "@/components/ui/RowButton";

/* ---------------- UI bits ---------------- */

function withHotkey(label: string, hotkey: string) {
  const i = label.toLowerCase().indexOf(hotkey.toLowerCase());
  if (i === -1) return <ThemedText>{label}</ThemedText>;
  return (
    <Text>
      {label.slice(0, i)}
      <Text style={styles.underlineLetter}>{label[i]}</Text>
      {label.slice(i + 1)}
    </Text>
  );
}

/* ---------------- Screen ---------------- */

export default function TexasHoldemTab() {
  const [numPlayers, setNumPlayers] = useState(6);
  const [bigBlind, setBigBlind] = useState(2);
  const [autoNew, setAutoNew] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [facingRaise, setFacingRaise] = useState(true);
  const [heroAction, setHeroAction] = useState<"" | Action>("");
  const [lastAction, setLastAction] = useState<"" | Action>("");
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<string>("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  const [feedbackSecs, setFeedbackSecs] = useState(1.0);
  const [showFeedback, setshowFeedback] = useState(true);
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

  // Session-based hand history tracking
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentHandHistory, setCurrentHandHistory] = useState<HandHistory | null>(null);

  const isCompact = Platform.OS !== "web";

  // hero row flash (fade) state
  const [heroFlash, setHeroFlash] = useState<"none" | "correct" | "incorrect">("none");
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // New: gate street advancement until after feedback animation
  const advanceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const [sWhy, sAuto, sFacing, sSecs, sScore, sFlop, sTurn, sRiver, sCommunityCards] = await Promise.all([
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
      if (sWhy != null) setshowFeedback(sWhy === "1");
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
      if (sCommunityCards != null) setShowCommunityCards(sCommunityCards === "1");
      setReady(true);
    })();
  }, []);

  // Persist prefs on change
  useEffect(() => { Storage.setItem("poker.showFeedback", showFeedback ? "1" : "0"); }, [showFeedback]);
  useEffect(() => { Storage.setItem("poker.autoNew", autoNew ? "1" : "0"); }, [autoNew]);
  useEffect(() => { Storage.setItem("poker.facingRaise", facingRaise ? "1" : "0"); }, [facingRaise]);
  useEffect(() => { Storage.setItem("poker.feedbackSecs", String(feedbackSecs)); }, [feedbackSecs]);
  useEffect(() => { Storage.setItem("poker.showScore", showScore ? "1" : "0"); }, [showScore]);
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
      name: i === heroSeat ? "Hero" : `Player ${i + 1}`,
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

    // Set blinds - pot starts at 0, blinds are tracked in player.bet
    ps.forEach((p) => {
      if (p.role === "SB") {
        p.bet = Math.max(1, Math.floor(bigBlind / 2));
      }
      if (p.role === "BB") {
        p.bet = bigBlind;
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
    setPot(0); // Start with 0, blinds are in player.bet
    setFoldedHand(false);
    setHeroWonHand(null);
    setRevealedPlayers(new Set()); // Reset revealed players

    setPlayers(rotated);
    setHeroAction("");
    setLastActionCorrect(null);
    setShowAllCards(false);
    if (!showFeedback) setResult("");

    // Initialize hand history for this new hand
    if (currentSession) {
      const handHistory = createHandHistory(rotated);
      setCurrentHandHistory(handHistory);
    }
  }

  function newHand() { dealTable(numPlayers); }

  useEffect(() => { if (ready) newHand(); }, [ready]);

  // Initialize session when app starts
  useEffect(() => {
    if (ready && !currentSession) {
      loadSessionFromStorage().then(savedSession => {
        if (savedSession) {
          setCurrentSession(savedSession);
        } else {
          startNewSession();
        }
      });
    }
  }, [ready, currentSession]);

  // Save session to storage whenever it changes
  useEffect(() => {
    if (currentSession) {
      saveSessionToStorage(currentSession);
    }
  }, [currentSession]);

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
    setResult(showFeedback ? "Stats reset." : "");
  }

  async function resetAll() {
    // Reset stats
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    
    // Reset all settings to defaults
    setshowFeedback(true);
    setAutoNew(true);
    setFacingRaise(true);
    setFeedbackSecs(1.0);
    setShowScore(true);
    setShowSettings(false);
    setShowFlop(false);
    setShowTurn(false);
    setShowRiver(false);
    setShowCommunityCards(false);
    
    // Clear all persisted data
    const keys = [
      "poker.showFeedback",
      "poker.autoNew", 
      "poker.facingRaise",
      "poker.feedbackSecs",
      "poker.showScore",
      "poker.showFlop",
      "poker.showTurn",
      "poker.showRiver",
      "poker.showCommunityCards"
    ];
    
    // Clear storage (set to default values)
    await Promise.all([
      Storage.setItem("poker.showFeedback", "1"),
      Storage.setItem("poker.autoNew", "1"),
      Storage.setItem("poker.facingRaise", "1"),
      Storage.setItem("poker.feedbackSecs", "1.0"),
      Storage.setItem("poker.showScore", "1"),
      Storage.setItem("poker.showFlop", "0"),
      Storage.setItem("poker.showTurn", "0"),
      Storage.setItem("poker.showRiver", "0"),
      Storage.setItem("poker.showCommunityCards", "0")
    ]);
    
    // Clear session from storage and reset session state
    await clearSessionFromStorage();
    setCurrentSession(null);
    setCurrentHandHistory(null);
    
    // Start a new session after clearing everything
    setTimeout(() => {
      startNewSession();
    }, 100); // Small delay to ensure state is cleared first
    
    setResult(showFeedback ? "All settings and stats reset." : "");
  }

  // Session management functions
  function startNewSession() {
    const session: Session = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      hands: []
    };
    setCurrentSession(session);
    setCurrentHandHistory(null);
    
    // Save new session to storage
    saveSessionToStorage(session);
    
    // Reset accuracy statistics for the new session
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setLastActionCorrect(null);
    setResult(showFeedback ? "New session started. Stats reset." : "");
  }

  // Session persistence functions
  async function saveSessionToStorage(session: Session) {
    try {
      await Storage.setItem("poker.currentSession", JSON.stringify(session));
    } catch (error) {
      console.warn("Failed to save session to storage:", error);
    }
  }

  async function loadSessionFromStorage(): Promise<Session | null> {
    try {
      const sessionJson = await Storage.getItem("poker.currentSession");
      if (sessionJson) {
        return JSON.parse(sessionJson) as Session;
      }
    } catch (error) {
      console.warn("Failed to load session from storage:", error);
    }
    return null;
  }

  async function clearSessionFromStorage() {
    try {
      await Storage.setItem("poker.currentSession", "");
    } catch (error) {
      console.warn("Failed to clear session from storage:", error);
    }
  }

  function createHandHistory(players: Player[]): HandHistory {
    const handId = `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      handId,
      timestamp: Date.now(),
      players: players.map(p => ({
        name: p.name,
        position: p.positionLabel || "",
        cards: p.cards,
        isHero: p.isHero
      })),
      blinds: {
        smallBlind: Math.max(1, Math.floor(bigBlind / 2)),
        bigBlind: bigBlind
      },
      communityCards: {},
      actions: [],
      pot: 0,
      result: "folded"
    };
  }

  function addActionToHistory(action: Action, amount: number, street: "preflop" | "flop" | "turn" | "river") {
    if (!currentHandHistory || !hero) return;

    const handAction: HandAction = {
      player: hero.name,
      action,
      amount,
      street,
      timestamp: Date.now()
    };

    setCurrentHandHistory(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: [...prev.actions, handAction]
      };
    });
  }

  function exportSessionToPokerStars(): string {
    if (!currentSession || currentSession.hands.length === 0) {
      return "No hands to export in current session.";
    }

    let output = "";
    
    currentSession.hands.forEach((hand, index) => {
      const date = new Date(hand.timestamp);
      const dateStr = date.toISOString().replace('T', ' ').split('.')[0];
      
      // Hand header
      output += `PokerStars Hand #${hand.handId}: Hold'em No Limit ($${hand.blinds.smallBlind}/$${hand.blinds.bigBlind}) - ${dateStr} ET\n`;
      output += `Table 'Training Table' 6-max Seat #1 is the button\n`;
      
      // Seat information
      hand.players.forEach((player, seatIndex) => {
        const seat = seatIndex + 1;
        output += `Seat ${seat}: ${player.name} ($1000 in chips)\n`;
      });
      
      // Blinds posting
      const sbPlayer = hand.players.find(p => p.position === "SB");
      const bbPlayer = hand.players.find(p => p.position === "BB");
      if (sbPlayer) output += `${sbPlayer.name}: posts small blind $${hand.blinds.smallBlind}\n`;
      if (bbPlayer) output += `${bbPlayer.name}: posts big blind $${hand.blinds.bigBlind}\n`;
      
      // Hole cards
      output += "*** HOLE CARDS ***\n";
      const heroPlayer = hand.players.find(p => p.isHero);
      if (heroPlayer) {
        output += `Dealt to ${heroPlayer.name} [${cardToPokerStarsStr(heroPlayer.cards[0])} ${cardToPokerStarsStr(heroPlayer.cards[1])}]\n`;
      }
      
      // Pre-flop actions
      const preflopActions = hand.actions.filter(a => a.street === "preflop");
      preflopActions.forEach(action => {
        const actionStr = action.action === "check" ? "checks" : 
                        action.action === "call" ? `calls $${action.amount}` :
                        action.action === "raise" ? `raises $${action.amount}` :
                        "folds";
        output += `${action.player}: ${actionStr}\n`;
      });
      
      // Community cards and post-flop actions
      if (hand.communityCards.flop) {
        output += `*** FLOP *** [${hand.communityCards.flop.map(cardToPokerStarsStr).join(' ')}]\n`;
        const flopActions = hand.actions.filter(a => a.street === "flop");
        flopActions.forEach(action => {
          const actionStr = action.action === "check" ? "checks" : 
                          action.action === "call" ? `calls $${action.amount}` :
                          action.action === "raise" ? `bets $${action.amount}` :
                          "folds";
          output += `${action.player}: ${actionStr}\n`;
        });
      }
      
      if (hand.communityCards.turn) {
        output += `*** TURN *** [${hand.communityCards.flop?.map(cardToPokerStarsStr).join(' ')} ${cardToPokerStarsStr(hand.communityCards.turn)}]\n`;
        const turnActions = hand.actions.filter(a => a.street === "turn");
        turnActions.forEach(action => {
          const actionStr = action.action === "check" ? "checks" : 
                          action.action === "call" ? `calls $${action.amount}` :
                          action.action === "raise" ? `bets $${action.amount}` :
                          "folds";
          output += `${action.player}: ${actionStr}\n`;
        });
      }
      
      if (hand.communityCards.river) {
        output += `*** RIVER *** [${hand.communityCards.flop?.map(cardToPokerStarsStr).join(' ')} ${cardToPokerStarsStr(hand.communityCards.turn)} ${cardToPokerStarsStr(hand.communityCards.river)}]\n`;
        const riverActions = hand.actions.filter(a => a.street === "river");
        riverActions.forEach(action => {
          const actionStr = action.action === "check" ? "checks" : 
                          action.action === "call" ? `calls $${action.amount}` :
                          action.action === "raise" ? `bets $${action.amount}` :
                          "folds";
          output += `${action.player}: ${actionStr}\n`;
        });
      }
      
      // Show down section (only if hand was completed and not folded)
      if (hand.result === "completed" && hand.communityCards.flop && hand.communityCards.turn && hand.communityCards.river) {
        output += "*** SHOW DOWN ***\n";
        
        // Show final board
        const finalBoard = [
          ...hand.communityCards.flop,
          hand.communityCards.turn,
          hand.communityCards.river
        ];
        output += `Board [${finalBoard.map(cardToPokerStarsStr).join(' ')}]\n`;
        
        // Show all players' hole cards
        hand.players.forEach(player => {
          output += `${player.name}: shows [${cardToPokerStarsStr(player.cards[0])} ${cardToPokerStarsStr(player.cards[1])}]\n`;
        });
      }
      
      // Summary
      output += "*** SUMMARY ***\n";
      output += `Total pot $${hand.pot}\n`;
      
      // Final board in summary (for completed hands)
      if (hand.result === "completed" && hand.communityCards.flop && hand.communityCards.turn && hand.communityCards.river) {
        const finalBoard = [
          ...hand.communityCards.flop,
          hand.communityCards.turn,
          hand.communityCards.river
        ];
        output += `Board [${finalBoard.map(cardToPokerStarsStr).join(' ')}]\n`;
      }
      
      if (hand.result === "folded") {
        output += `${heroPlayer?.name} folded\n`;
      } else if (hand.heroWon !== undefined) {
        output += hand.heroWon ? `${heroPlayer?.name} wins the pot\n` : `${heroPlayer?.name} loses the hand\n`;
      }
      
      output += "\n\n";
    });
    
    return output;
  }

  function downloadSessionExport() {
    const content = exportSessionToPokerStars();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const element = document.createElement("a");
      const file = new Blob([content], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `flopper_holdem_${currentSession?.id || 'unknown'}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      // For mobile, show content in alert for now
      alert(content.length > 1000 ? 
        `Session export ready (${content.length} characters). Feature to save files coming soon.` :
        content
      );
    }
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

    // Track action in hand history
    const currentBet = Math.max(...players.map(p => p.bet));
    const heroBet = players.find(p => p.isHero)?.bet || 0;
    let betAmount = heroBet; // Default to current bet
    
    if (action === "call") {
      betAmount = currentBet; // Match the highest current bet
    } else if (action === "raise") {
      if (currentBet === 0) {
        // If no one has bet, bet the big blind amount
        betAmount = bigBlind;
      } else {
        // If there's already a bet, minimum raise is to double the current bet
        betAmount = currentBet + Math.max(currentBet, bigBlind);
      }
    } else if (action === "check") {
      betAmount = heroBet; // No change in bet amount
    }
    // fold doesn't change bet amount, keep current bet
    
    // Track this action in hand history (only for valid streets)
    if (currentStreet !== "complete") {
      addActionToHistory(action, betAmount, currentStreet);
    }
    
    // Update players and calculate pot with the new hero bet amount
    const updatedPlayers = players.map(p => {
      if (p.isHero) {
        return { ...p, bet: betAmount };
      }
      return p;
    });

    setPlayers(updatedPlayers);

    // Calculate total pot with the updated hero bet
    const updatedTotalPot = pot + updatedPlayers.reduce((sum, player) => sum + player.bet, 0);

    // Handle folding - end the hand
    if (action === "fold") {
      // Collect all current bets into the pot before ending
      const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
      const finalPot = pot + allBets;
      // Delay settling bets so the bet remains visible until the feedback animation ends
      const settleDelayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      setTimeout(() => {
        setPot(prevPot => prevPot + allBets);
        setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
      }, settleDelayMs);
      setCurrentStreet("complete");
      setFoldedHand(true);
      
      // Complete hand history
      if (currentHandHistory && currentSession) {
        const updatedHistory = {
          ...currentHandHistory,
          pot: finalPot,
          result: "folded" as const,
          communityCards: {
            ...(flopCards && { flop: flopCards }),
            ...(turnCard && { turn: turnCard }),
            ...(riverCard && { river: riverCard })
          }
        };
        setCurrentSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            hands: [...prev.hands, updatedHistory]
          };
        });
        setCurrentHandHistory(null);
      }
      // Don't deal additional community cards when folding
    } else {
      // Gate street advancement and bet reset until feedback flash completes
      const delayMs = Math.max(0, Math.round(feedbackSecs * 1000));
      if (advanceStreetTimerRef.current) clearTimeout(advanceStreetTimerRef.current);
      advanceStreetTimerRef.current = setTimeout(() => {
        // Deal next cards based on current street using the stored deck
        if (showFlop && currentStreet === "preflop" && !flopCards && deck.length >= 3) {
          const newDeck = [...deck];
          const flop: [CardT, CardT, CardT] = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
          setFlopCards(flop);
          setDeck(newDeck);
          setCurrentStreet("flop");
          
          // Collect all bets into pot and reset for new betting round
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prevPot => prevPot + allBets);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
          
        } else if (showFlop && showTurn && currentStreet === "flop" && flopCards && !turnCard && deck.length >= 1) {
          const newDeck = [...deck];
          const turn = newDeck.pop()!;
          setTurnCard(turn);
          setDeck(newDeck);
          setCurrentStreet("turn");
          
          // Collect all bets into pot and reset for new betting round
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prevPot => prevPot + allBets);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
          
        } else if (showFlop && showTurn && showRiver && currentStreet === "turn" && turnCard && !riverCard && deck.length >= 1) {
          const newDeck = [...deck];
          const river = newDeck.pop()!;
          setRiverCard(river);
          setDeck(newDeck);
          setCurrentStreet("river");
          
          // Collect all bets into pot and reset for new betting round
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          setPot(prevPot => prevPot + allBets);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
          
        } else if (showFlop && showTurn && showRiver && currentStreet === "river") {
          // After river action, complete the hand and collect final bets
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          const finalPot = pot + allBets;
          setPot(prevPot => prevPot + allBets);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
          setCurrentStreet("complete");
          
          // Reveal all other players' hands when reaching showdown on river
          const allPlayerIds = new Set(updatedPlayers.map(p => p.id).filter(id => id !== hero?.id));
          setRevealedPlayers(allPlayerIds);
          
          // Evaluate who won the hand
          let heroWon: boolean | undefined = undefined;
          if (hero && flopCards && turnCard && riverCard) {
            const communityCards = [...flopCards, turnCard, riverCard];
            const otherPlayers = updatedPlayers.filter(p => !p.isHero);
            heroWon = didHeroWin(hero, otherPlayers, communityCards);
            setHeroWonHand(heroWon);
          }
          
          // Complete hand history
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: finalPot,
              result: "completed" as const,
              heroWon,
              communityCards: {
                flop: flopCards!,
                turn: turnCard!,
                river: riverCard!
              }
            };
            setCurrentSession(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                hands: [...prev.hands, updatedHistory]
              };
            });
            setCurrentHandHistory(null);
          }
        } else {
          // Hand ends early if settings don't allow further streets
          const allBets = updatedPlayers.reduce((sum, p) => sum + p.bet, 0);
          const finalPot = pot + allBets;
          setPot(prevPot => prevPot + allBets);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, bet: 0 })));
          setCurrentStreet("complete");
          
          // Complete hand history for early ending hands
          if (currentHandHistory && currentSession) {
            const updatedHistory = {
              ...currentHandHistory,
              pot: finalPot,
              result: "completed" as const,
              communityCards: {
                ...(flopCards && { flop: flopCards }),
                ...(turnCard && { turn: turnCard }),
                ...(riverCard && { river: riverCard })
              }
            };
            setCurrentSession(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                hands: [...prev.hands, updatedHistory]
              };
            });
            setCurrentHandHistory(null);
          }
          
          // If "Always show community cards" is enabled, deal missing cards for analysis
          // But only if post-flop play is enabled (showFlop is true)
          if (showCommunityCards && showFlop && deck.length > 0) {
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
      why = `Score: ${heroScore} (Chen). ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.`;
    } else {
      why = `${currentStreet} betting. Continue playing or fold.`;
    }
    
    const resultText = currentStreet === "preflop" 
      ? (correct ? `✅ ` : `❌ `) + `Recommended: ${recommended.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`
      : `${currentStreet.toUpperCase()} Action: ${action.toUpperCase()}. ${why} Pot: $${updatedTotalPot}.`;
      
    setResult(resultText);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showFeedback && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
    
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

  const renderPlayer = ({ item }: { item: Player }) => (
    <PlayerRow
      player={item}
      isCompact={isCompact}
      showScore={showScore}
      heroScore={heroScore}
      showAllCards={showAllCards}
      revealed={revealedPlayers.has(item.id)}
      onToggleReveal={togglePlayerReveal}
      flashState={item.isHero ? heroFlash : "none"}
      flashOpacity={item.isHero ? heroFlashOpacity : undefined}
      betLabel={betLabel}
    />
  );

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
        {showFeedback && (
          <View style={[
            styles.card,
            lastActionCorrect === true && { backgroundColor: "#b9efd2" },
            lastActionCorrect === false && { backgroundColor: "#f8c7cc" }
          ]}>
            <View style={styles.feedbackRow}>
              <Text style={[styles.feedbackText, { flex: 1 }]}>
                {result || "Take an action to see feedback."}
              </Text>
              <View style={styles.feedbackRight}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Last: {formatAction(lastAction)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Community Cards Row (uses extracted component) */}
        {((showFlop && (flopCards || (currentStreet !== "preflop" && !foldedHand) || (currentStreet === "complete" && showCommunityCards))) || showCommunityCards) && (
          <CommunityCards
            street={currentStreet}
            flop={flopCards || undefined}
            turn={turnCard || undefined}
            river={riverCard || undefined}
            totalPot={totalPot}
            isCompact={isCompact}
            heroWon={heroWonHand}
            folded={foldedHand}
          />
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

      {/* Settings panel replaced with extracted SettingsSheet */}
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        numPlayers={numPlayers}
        setNumPlayers={setNumPlayers}
        bigBlind={bigBlind}
        setBigBlind={setBigBlind}
        showFlop={showFlop}
        setShowFlop={setShowFlop}
        showTurn={showTurn}
        setShowTurn={setShowTurn}
        showRiver={showRiver}
        setShowRiver={setShowRiver}
        autoNew={autoNew}
        setAutoNew={setAutoNew}
        feedbackSecs={feedbackSecs}
        setFeedbackSecs={setFeedbackSecs}
        showCommunityCards={showCommunityCards}
        setShowCommunityCards={setShowCommunityCards}
        showFeedback={showFeedback}
        setShowFeedback={setshowFeedback}
        facingRaise={facingRaise}
        setFacingRaise={setFacingRaise}
        showScore={showScore}
        setShowScore={setShowScore}
        currentSession={currentSession}
        onStartNewSession={startNewSession}
        onExportSession={downloadSessionExport}
        onResetAll={resetAll}
        dealTable={dealTable}
      />
    </>
  );
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
  singleColumnRow: { marginBottom: 8 },
  controlBlock: { width: "48%" },
  label: { fontSize: 12, color: "#555", marginBottom: 6 },
  input: { backgroundColor: "f2f2f6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  currencyInputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f2f6", borderRadius: 10, paddingLeft: 10 },
  currencyPrefix: { fontSize: 16, color: "#666", fontWeight: "600" },
  currencyInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16 },
  sectionBreak: { marginTop: 20, marginBottom: 8 },
  sectionHeader: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
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
  nameRow1: { flexDirection: "row", alignItems: "center", gap: 8 }, // position pill + name inline
  nameRow2: { flexDirection: "row", alignItems: "baseline", justifyContent: "flex-start", gap: 8, paddingLeft: 4, paddingTop: 3 }, // position pill + name inline
  playerName: { fontWeight: "600", fontSize: 18 },
  playerSub: { color: "666", fontSize: 12 },

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
  lastActionText: { fontSize: 14, color: "#666", fontWeight: "600", minWidth: 80 },
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

  // Modal styles (still referenced for legacy tooltip styles in this file)
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
  sessionInfo: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});