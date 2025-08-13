import { ThemedText } from '@/components/ThemedText';

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

// Replace in-file helpers and types with imports from lib/models
import { cardToPokerStarsStr } from "@/lib/cards";
import Storage from "@/lib/storage";
import type { Action, Player } from "@/models/poker";

// Import extracted UI components
import CommunityCards from "@/components/poker/CommunityCards";
import PlayerRow from "@/components/poker/PlayerRow";
import SettingsSheet from "@/components/poker/SettingsSheet";
import RowButton from "@/components/ui/RowButton";

// New hook for game state/logic
import useHoldemTrainer from "@/hooks/useHoldemTrainer";

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
  const {
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
    players, currentStreet, flopCards, turnCard, riverCard,
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
    heroScore,
    canCheck, totalPot,
    betLabel,

    // actions
    dealTable, newHand, act,
  } = useHoldemTrainer();

  // Export current session to PokerStars-like hand history (kept on screen for now)
  function exportSessionToPokerStars(): string {
    if (!currentSession || currentSession.hands.length === 0) {
      return "No hands to export in current session.";
    }

    let output = "";
    currentSession.hands.forEach((hand) => {
      const date = new Date(hand.timestamp);
      const dateStr = date.toISOString().replace('T', ' ').split('.')[0];

      output += `PokerStars Hand #${hand.handId}: Hold'em No Limit ($${hand.blinds.smallBlind}/$${hand.blinds.bigBlind}) - ${dateStr} ET\n`;
      output += `Table 'Training Table' 6-max Seat #1 is the button\n`;

      hand.players.forEach((player, seatIndex) => {
        const seat = seatIndex + 1;
        output += `Seat ${seat}: ${player.name} ($1000 in chips)\n`;
      });

      const sbPlayer = hand.players.find(p => p.position === "SB");
      const bbPlayer = hand.players.find(p => p.position === "BB");
      if (sbPlayer) output += `${sbPlayer.name}: posts small blind $${hand.blinds.smallBlind}\n`;
      if (bbPlayer) output += `${bbPlayer.name}: posts big blind $${hand.blinds.bigBlind}\n`;

      output += "*** HOLE CARDS ***\n";
      const heroPlayer = hand.players.find(p => p.isHero);
      if (heroPlayer) {
        output += `Dealt to ${heroPlayer.name} [${cardToPokerStarsStr(heroPlayer.cards[0])} ${cardToPokerStarsStr(heroPlayer.cards[1])}]\n`;
      }

      const preflopActions = hand.actions.filter(a => a.street === "preflop");
      preflopActions.forEach(action => {
        const actionStr = action.action === "check" ? "checks" :
                          action.action === "call" ? `calls $${action.amount}` :
                          action.action === "raise" ? `raises $${action.amount}` :
                          "folds";
        output += `${action.player}: ${actionStr}\n`;
      });

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

      if (hand.result === "completed" && hand.communityCards.flop && hand.communityCards.turn && hand.communityCards.river) {
        output += "*** SHOW DOWN ***\n";
        const finalBoard = [
          ...hand.communityCards.flop,
          hand.communityCards.turn,
          hand.communityCards.river
        ];
        output += `Board [${finalBoard.map(cardToPokerStarsStr).join(' ')}]\n`;
        hand.players.forEach(player => {
          output += `${player.name}: shows [${cardToPokerStarsStr(player.cards[0])} ${cardToPokerStarsStr(player.cards[1])}]\n`;
        });
      }

      output += "*** SUMMARY ***\n";
      output += `Total pot $${hand.pot}\n`;
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
      alert(content.length > 1000 ?
        `Session export ready (${content.length} characters). Feature to save files coming soon.` :
        content
      );
    }
  }

  async function resetAll() {
    // Reset settings to defaults via hook setters
    setShowFeedback(true);
    setAutoNew(true);
    setFacingRaise(true);
    setFeedbackSecs(1.0);
    setShowScore(true);
    setShowSettings(false);
    setShowFlop(false);
    setShowTurn(true);
    setShowRiver(true);
    setShowCommunityCards(false);

    // Persist defaults
    await Promise.all([
      Storage.setItem("poker.showFeedback", "1"),
      Storage.setItem("poker.autoNew", "1"),
      Storage.setItem("poker.facingRaise", "1"),
      Storage.setItem("poker.feedbackSecs", "1.0"),
      Storage.setItem("poker.showScore", "1"),
      Storage.setItem("poker.showFlop", "0"),
      Storage.setItem("poker.showTurn", "1"),
      Storage.setItem("poker.showRiver", "1"),
      Storage.setItem("poker.showCommunityCards", "0"),
    ]);

    // Clear session from storage and reset session state
    await Storage.setItem("poker.currentSession", "");
    setCurrentSession(null);
    setCurrentHandHistory(null);

    // Start a new session after clearing everything
    startNewSession();
  }

  const accuracyPct = totalHands ? ((correctHands / totalHands) * 100).toFixed(1) : "0.0";
  const formatAction = (a: "" | Action) => (a ? a[0].toUpperCase() + a.slice(1) : "—");

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
  }, [heroAction, newHand, act]);

  /* --- Hotkeys (native, optional): requires `react-native-key-command` --- */
  useEffect(() => {
    if (Platform.OS === "web") return;
    let KeyCommand: any = null;
    try { KeyCommand = require("react-native-key-command"); } catch { return; }
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
  }, [heroAction, newHand, act]);

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
          renderItem={({ item }: { item: Player }) => (
            <PlayerRow
              player={item}
              isCompact={isCompact}
              showScore={showScore}
              heroScore={heroScore}
              showAllCards={false}
              revealed={revealedPlayers.has(item.id)}
              onToggleReveal={togglePlayerReveal}
              flashState={item.isHero ? heroFlash : "none"}
              flashOpacity={item.isHero ? heroFlashOpacity : undefined}
              betLabel={betLabel}
            />
          )}
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

      {/* Settings panel */}
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
        setShowFeedback={setShowFeedback}
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

  underlineLetter: { textDecorationLine: "underline" },

  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },

  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  actionsLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },

  feedbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  feedbackText: { fontSize: 14, color: "#333" },
  feedbackRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  helper: { color: "#666", fontSize: 12 },
});