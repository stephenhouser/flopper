import { ThemedText } from '@/components/ThemedText';

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

// Replace in-file helpers and types with imports from lib/models
import { exportSessionToPokerStars } from "@/lib/export/pokerstars";
import Storage from "@/lib/storage";
import type { Player } from "@/models/poker";
import { DEFAULT_TRAINER_SETTINGS, SESSION_STORAGE_KEY } from "@/models/poker";

// Import extracted UI components
import { CommunityCards } from "@/components/poker/CommunityCards";
import { PlayerRow } from "@/components/poker/PlayerRow";
import { SettingsSheet } from "@/components/poker/SettingsSheet";
import { RowButton } from "@/components/ui/RowButton";

// New hook for game state/logic
import { useHoldemTrainer } from "@/hooks/useHoldemTrainer";
// Cross-platform download helper and action formatter
import { useHotkeys } from "@/hooks/useHotkeys";
import { downloadTextFile } from "@/lib/utils/download";
import { formatAction } from "../../lib/utils/poker";

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
    showFeedback,
    showScore,
    showFlop,
    showCommunityCards,
    settings, setSettings,

    // game state
    players, currentStreet, board,
    foldedHand, heroWonHand,
    revealedPlayers, togglePlayerReveal,

    // stats
    heroAction, lastActionCorrect, result,
    totalHands, correctHands,

    // session
    currentSession, setCurrentSession,
    startNewSession,

    // ui
    isCompact,
    showSettings, setShowSettings,
    heroFlash, heroFlashOpacity,
    buttonsDisabled,

    // derived
    heroScore,
    canCheck, totalPot,
    betLabel,

    // actions
    dealTable, newHand, act,
  } = useHoldemTrainer();

  // Export is now handled by a library function and cross-platform downloader
  function downloadSessionExport() {
    const content = exportSessionToPokerStars(currentSession);
    const filename = `flopper_holdem_${currentSession?.id || 'unknown'}.txt`;
    downloadTextFile(filename, content);
  }

  async function resetAll() {
    // Reset unified settings to defaults and close settings panel
    setSettings({ ...DEFAULT_TRAINER_SETTINGS });
    setShowSettings(false);

    // Clear session from storage and reset session state
    await Storage.setItem(SESSION_STORAGE_KEY, "");
    setCurrentSession(null);

    // Start a new session after clearing everything
    startNewSession();
  }

  const accuracyPct = totalHands ? ((correctHands / totalHands) * 100).toFixed(1) : "0.0";

  // Hotkeys via reusable hook
  useHotkeys({ disabled: buttonsDisabled, heroAction, onAct: act, onNewHand: newHand });

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
              <Text style={[styles.feedbackText, { flex: 1 }] }>
                {result || "Take an action to see feedback."}
              </Text>
              <View style={styles.feedbackRight}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Last: {formatAction(heroAction)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Community Cards Row (uses extracted component) */}
        {((showFlop && ((board.flop && board.flop.length === 3) || (currentStreet !== "preflop" && !foldedHand) || (currentStreet === "complete" && showCommunityCards))) || showCommunityCards) && (
          <CommunityCards
            street={currentStreet}
            board={board}
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
              <RowButton equal kind="primary" onPress={() => act("raise")} label={withHotkey("Raise", "r")} disabled={buttonsDisabled} />
              <RowButton equal kind="primary" onPress={() => act("call")}  label={withHotkey("Call",  "a")} disabled={buttonsDisabled} />
              <RowButton equal kind="primary" onPress={() => act("check")} label={withHotkey("Check", "c")} disabled={!canCheck || buttonsDisabled} />
              <RowButton equal kind="primary" onPress={() => act("fold")}  label={withHotkey("Fold",  "f")} disabled={buttonsDisabled} />
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
        // Unified settings API
        settings={settings}
        setSettings={setSettings}
        // Legacy/session controls
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