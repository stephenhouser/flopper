import { ThemedText } from "@/components/ThemedText";
import RowButton from "@/components/ui/RowButton";
import type { Session, TrainerSettings } from "@/models/poker";
import { MAX_PLAYERS, MIN_BIG_BLIND, MIN_PLAYERS, SMALL_BLIND_FACTOR } from "@/models/poker";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

export type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
  // Either pass unified settings or separate fields (back-compat)
  settings?: TrainerSettings;
  setSettings?: (s: TrainerSettings) => void | React.Dispatch<React.SetStateAction<TrainerSettings>>;
  // table config
  numPlayers?: number;
  setNumPlayers?: (n: number) => void;
  bigBlind?: number;
  setBigBlind?: (n: number) => void;
  showFlop?: boolean;
  setShowFlop?: (v: boolean) => void;
  showTurn?: boolean;
  setShowTurn?: (v: boolean) => void;
  showRiver?: boolean;
  setShowRiver?: (v: boolean) => void;
  autoNew?: boolean;
  setAutoNew?: (v: boolean) => void;
  feedbackSecs?: number;
  setFeedbackSecs?: React.Dispatch<React.SetStateAction<number>> | ((n: number) => void);
  showCommunityCards?: boolean;
  setShowCommunityCards?: (v: boolean) => void;
  showFeedback?: boolean;
  setShowFeedback?: (v: boolean) => void;
  facingRaise?: boolean;
  setFacingRaise?: (v: boolean) => void;
  showScore?: boolean;
  setShowScore?: (v: boolean) => void;
  currentSession: Session | null;
  onStartNewSession: () => void;
  onExportSession: () => void;
  onResetAll: () => void;
  dealTable: (n: number) => void;
};

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  visible,
  onClose,
  settings,
  setSettings,
  numPlayers: _numPlayers,
  setNumPlayers: _setNumPlayers,
  bigBlind: _bigBlind,
  setBigBlind: _setBigBlind,
  showFlop: _showFlop,
  setShowFlop: _setShowFlop,
  showTurn: _showTurn,
  setShowTurn: _setShowTurn,
  showRiver: _showRiver,
  setShowRiver: _setShowRiver,
  autoNew: _autoNew,
  setAutoNew: _setAutoNew,
  feedbackSecs: _feedbackSecs,
  setFeedbackSecs: _setFeedbackSecs,
  showCommunityCards: _showCommunityCards,
  setShowCommunityCards: _setShowCommunityCards,
  showFeedback: _showFeedback,
  setShowFeedback: _setShowFeedback,
  facingRaise: _facingRaise,
  setFacingRaise: _setFacingRaise,
  showScore: _showScore,
  setShowScore: _setShowScore,
  currentSession,
  onStartNewSession,
  onExportSession,
  onResetAll,
  dealTable,
}) => {
  // Resolve values and setters from unified or legacy props
  const numPlayers = settings ? settings.numPlayers : (_numPlayers ?? 6);
  const setNumPlayers = (n: number) => {
    if (settings && setSettings) {
      if (typeof setSettings === "function") (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, numPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)) }));
      else (setSettings as (s: TrainerSettings) => void)({ ...settings, numPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)) });
    } else {
      _setNumPlayers?.(n);
    }
  };
  const bigBlind = settings ? settings.bigBlind : (_bigBlind ?? 2);
  const setBigBlind = (n: number) => {
    if (settings && setSettings) {
      if (typeof setSettings === "function") (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, bigBlind: Math.max(MIN_BIG_BLIND, n) }));
      else (setSettings as (s: TrainerSettings) => void)({ ...settings, bigBlind: Math.max(MIN_BIG_BLIND, n) });
    } else {
      _setBigBlind?.(n);
    }
  };
  const showFlop = settings ? settings.showFlop : (_showFlop ?? false);
  const setShowFlop = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showFlop: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showFlop: v })) :
    _setShowFlop?.(v);
  const showTurn = settings ? settings.showTurn : (_showTurn ?? true);
  const setShowTurn = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showTurn: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showTurn: v })) :
    _setShowTurn?.(v);
  const showRiver = settings ? settings.showRiver : (_showRiver ?? true);
  const setShowRiver = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showRiver: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showRiver: v })) :
    _setShowRiver?.(v);

  const autoNew = settings ? settings.autoNew : (_autoNew ?? true);
  const setAutoNew = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, autoNew: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, autoNew: v })) :
    _setAutoNew?.(v);

  const feedbackSecs = settings ? settings.feedbackSecs : (_feedbackSecs ?? 1);
  const setFeedbackSecs = (n: number) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, feedbackSecs: Math.max(0, Math.min(10, n)) })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, feedbackSecs: Math.max(0, Math.min(10, n)) })) :
    typeof _setFeedbackSecs === "function" ? (_setFeedbackSecs as (n: number) => void)(n) : undefined;

  const showCommunityCards = settings ? settings.showCommunityCards : (_showCommunityCards ?? false);
  const setShowCommunityCards = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showCommunityCards: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showCommunityCards: v })) :
    _setShowCommunityCards?.(v);

  const showFeedback = settings ? settings.showFeedback : (_showFeedback ?? true);
  const setShowFeedback = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showFeedback: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showFeedback: v })) :
    _setShowFeedback?.(v);

  const facingRaise = settings ? settings.facingRaise : (_facingRaise ?? true);
  const setFacingRaise = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, facingRaise: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, facingRaise: v })) :
    _setFacingRaise?.(v);

  const showScore = settings ? settings.showScore : (_showScore ?? true);
  const setShowScore = (v: boolean) => settings && setSettings ?
    (typeof setSettings === "function" ? (setSettings as React.Dispatch<React.SetStateAction<TrainerSettings>>)((s) => ({ ...s, showScore: v })) : (setSettings as (s: TrainerSettings) => void)({ ...settings, showScore: v })) :
    _setShowScore?.(v);

  // Tooltips internal state
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false);
  const [showAutoNewTooltip, setShowAutoNewTooltip] = useState(false);
  const [showFacingRaiseTooltip, setShowFacingRaiseTooltip] = useState(false);
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const [showFlopTooltip, setShowFlopTooltip] = useState(false);
  const [showTurnTooltip, setShowTurnTooltip] = useState(false);
  const [showRiverTooltip, setShowRiverTooltip] = useState(false);
  const [showCommunityCardsTooltip, setShowCommunityCardsTooltip] = useState(false);

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

  const settingsSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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
      closeAllTooltips();
    }
  }, [visible]);

  if (!visible) return null;

  const sbPct = Math.round(SMALL_BLIND_FACTOR * 100);

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.modalSheet,
          {
            transform: [
              {
                translateY: settingsSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.modalHandle} />

        {/* Floating tooltips */}
        {showFeedbackTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowFeedbackTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, shows feedback after each action.</Text>
            </View>
          </>
        )}
        {showAutoNewTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowAutoNewTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, a new hand is automatically dealt after the feedback delay expires.</Text>
            </View>
          </>
        )}
        {showFacingRaiseTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowFacingRaiseTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>Simulates a scenario where another player has already raised, requiring tighter hand selection.</Text>
            </View>
          </>
        )}
        {showScoreTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowScoreTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>Shows your hand's Chen score, a quick evaluation system for pre-flop hand strength.</Text>
            </View>
          </>
        )}
        {showFlopTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowFlopTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, play continues to the flop, turn, and river after your pre-flop action (except fold).</Text>
            </View>
          </>
        )}
        {showTurnTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowTurnTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, play continues to the turn after flop betting (requires Play flop to be enabled).</Text>
            </View>
          </>
        )}
        {showRiverTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowRiverTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, play continues to the river after turn betting (requires Play flop and Play turn to be enabled).</Text>
            </View>
          </>
        )}
        {showCommunityCardsTooltip && (
          <>
            <Pressable style={styles.tooltipBackdrop} onPress={() => setShowCommunityCardsTooltip(false)} />
            <View style={styles.floatingTooltip}>
              <Text style={styles.tooltipText}>When enabled, the community cards row is always visible, showing dealt cards and empty outlines for undealt cards.</Text>
            </View>
          </>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator>
          <View style={styles.card}>
            <View style={styles.singleColumnRow}>
              <View className="controlBlock" style={styles.controlBlock}>
                <ThemedText style={styles.label}>Players</ThemedText>
                <View style={styles.stepper}>
                  <RowButton label={<Text>-</Text>} onPress={() => { const next = Math.max(MIN_PLAYERS, numPlayers - 1); setNumPlayers(next); dealTable(next); }} />
                  <Text style={styles.stepperNum}>{numPlayers}</Text>
                  <RowButton label={<Text>+</Text>} onPress={() => { const next = Math.min(MAX_PLAYERS, numPlayers + 1); setNumPlayers(next); dealTable(next); }} />
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={[styles.controlBlock, { width: "35%" }]}> 
                <Text style={styles.label}>Big blind (small blind is {sbPct}%)</Text>
                <View style={styles.currencyInputContainer}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    value={String(bigBlind)}
                    onChangeText={(t) => { const next = Math.max(MIN_BIG_BLIND, Number(t.replace(/[^0-9]/g, "")) || MIN_BIG_BLIND); setBigBlind(next); dealTable(numPlayers); }}
                    inputMode="numeric"
                    keyboardType={Platform.select({ ios: "number-pad", android: "numeric", default: "numeric" })}
                    style={styles.currencyInput}
                  />
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showFlop} onValueChange={(v) => { setShowFlop(v); dealTable(numPlayers); }} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Play flop</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowFlopTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showTurn} onValueChange={(v) => { setShowTurn(v); dealTable(numPlayers); }} disabled={!showFlop} />
                <View style={styles.labelWithIcon}>
                  <Text style={[styles.switchLabel, !showFlop && { color: "#999" }]}>Play turn</Text>
                  <Pressable onPress={() => { if (showFlop) { closeAllTooltips(); setShowTurnTooltip(true); } }} style={styles.infoIcon} disabled={!showFlop}>
                    <Ionicons name="information-circle-outline" size={16} color={showFlop ? "#666" : "#ccc"} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showRiver} onValueChange={(v) => { setShowRiver(v); dealTable(numPlayers); }} disabled={!showFlop || !showTurn} />
                <View style={styles.labelWithIcon}>
                  <Text style={[styles.switchLabel, (!showFlop || !showTurn) && { color: "#999" }]}>Play river</Text>
                  <Pressable onPress={() => { if (showFlop && showTurn) { closeAllTooltips(); setShowRiverTooltip(true); } }} style={styles.infoIcon} disabled={!showFlop || !showTurn}>
                    <Ionicons name="information-circle-outline" size={16} color={(showFlop && showTurn) ? "#666" : "#ccc"} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={autoNew} onValueChange={(v) => { setAutoNew(v); dealTable(numPlayers); }} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Automatically deal new hand</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowAutoNewTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={[styles.controlBlock, { width: "100%" }]}> 
                <Text style={styles.label}>Deal delay (seconds)</Text>
                <View style={[styles.stepper, { justifyContent: "flex-start" }]}> 
                  <RowButton label={<Text>-</Text>} onPress={() => setFeedbackSecs(Math.max(0, parseFloat((feedbackSecs - 0.5).toFixed(1))))} />
                  <Text style={styles.stepperNum}>{feedbackSecs.toFixed(1)}s</Text>
                  <RowButton label={<Text>+</Text>} onPress={() => setFeedbackSecs(Math.min(10, parseFloat((feedbackSecs + 0.5).toFixed(1))))} />
                </View>
              </View>
            </View>

            <View style={styles.sectionBreak}>
              <Text style={styles.sectionHeader}>Feedback</Text>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showCommunityCards} onValueChange={setShowCommunityCards} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Always show community cards</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowCommunityCardsTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showFeedback} onValueChange={setShowFeedback} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Show feedback</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowFeedbackTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.sectionBreak}>
              <Text style={styles.sectionHeader}>Hand scoring (Chen method)</Text>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={facingRaise} onValueChange={(v) => { setFacingRaise(v); dealTable(numPlayers); }} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Facing a raise</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowFacingRaiseTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.singleColumnRow}>
              <View style={styles.switchRow}>
                <Switch value={showScore} onValueChange={setShowScore} />
                <View style={styles.labelWithIcon}>
                  <Text style={styles.switchLabel}>Show hand score</Text>
                  <Pressable onPress={() => { closeAllTooltips(); setShowScoreTooltip(true); }} style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.sectionBreak}>
              <Text style={styles.sectionHeader}>Data Management</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
              <RowButton label={<Text>New Session</Text>} onPress={onStartNewSession} kind="outline" />
              <RowButton label={<Text>Export Session</Text>} onPress={onExportSession} kind="outline" disabled={!currentSession || currentSession.hands.length === 0} />
              <View style={{ flex: 1 }} />
            </View>

            {currentSession && (
              <View style={styles.singleColumnRow}>
                <Text style={styles.sessionInfo}>Current session: {currentSession.hands.length} hands played</Text>
              </View>
            )}

            <View style={styles.sectionBreak}>
              <Text style={styles.sectionHeader}>Danger Zone</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
              <RowButton label={<Text>Reset all</Text>} onPress={onResetAll} kind="outline" />
            </View>
            <View style={styles.singleColumnRow}>
              <Text style={styles.sessionInfo}>Resets all settings, clears current session, and starts a new hand.</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Modal styles
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", zIndex: 1000 },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: 32, paddingHorizontal: 20, maxHeight: "80%", shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 16 },

  // Tooltip styles
  tooltipBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  floatingTooltip: { position: "absolute", width: 320, backgroundColor: "#2d3748", borderRadius: 8, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, zIndex: 1000, left: "50%", top: "50%", marginLeft: -160, marginTop: -50 },
  tooltipText: { color: "#fff", fontSize: 12, lineHeight: 16 },

  // Card container styles inside sheet
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12 },
  singleColumnRow: { marginBottom: 8 },
  controlBlock: { width: "48%" },
  label: { fontSize: 12, color: "#555", marginBottom: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperNum: { width: 60, textAlign: "center", fontSize: 16 },
  currencyInputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f2f6", borderRadius: 10, paddingLeft: 10 },
  currencyPrefix: { fontSize: 16, color: "#666", fontWeight: "600" },
  currencyInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 14 },
  labelWithIcon: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoIcon: { padding: 2 },

  sectionBreak: { marginTop: 20, marginBottom: 8 },
  sectionHeader: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  sessionInfo: { fontSize: 12, color: "#666", marginTop: 4 },
});

export default SettingsSheet;
