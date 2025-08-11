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
  View,
} from "react-native";

/**
 * Expo Router Tabs — app/(tabs)/index.tsx
 * - Title: Pre-Flop Trainer
 * - Header stats: "{correctHands}/{totalHands} • Accuracy: {accuracyPct}%"
 * - Dealer advances each hand; your seat fixed; SB at top, Dealer at bottom
 * - Cards on LEFT; on the RIGHT a vertical stack with Position pill (top) and Score/Hidden pill (bottom)
 * - Actions: Check / Call / Fold / Raise (primary blue, equal width), New hand on far right
 * - Hotkeys: c/a/f/r, Enter=repeat, Space=new hand (web + optional native via react-native-key-command)
 * - Controls: instant redeal, adjustable feedback time, Show why toggle
 * - Persisted prefs: showWhy, autoNew, facingRaise, feedbackSecs
 * - Reset stats: clears stats AND all persisted prefs (resets to defaults)
 * - Hero row flashes green/red; fade starts at 3/4 of feedback time
 * - If "Show why" is ON, feedback row is always visible (not auto-cleared)
 */

/* ---------------- Storage (AsyncStorage with web fallback) ---------------- */

type StorageLike = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

const Storage: StorageLike = (() => {
  try {
    const AS = require("@react-native-async-storage/async-storage").default;
    return {
      getItem: (k: string) => AS.getItem(k),
      setItem: (k: string, v: string) => AS.setItem(k, v),
      removeItem: (k: string) => AS.removeItem(k),
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
      removeItem: async (k: string) => {
        if (typeof window !== "undefined" && (window as any).localStorage) {
          (window as any).localStorage.removeItem(k);
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

// underline helper for hotkey letters
function withHotkey(label: string, hotkey: string) {
  const i = label.toLowerCase().indexOf(hotkey.toLowerCase());
  if (i === -1) return <Text>{label}</Text>;
  return (
    <Text>
      {label.slice(0, i)}
      <Text style={styles.underlineLetter}>{label[i]}</Text>
      {label.slice(i + 1)}
    </Text>
  );
}

const Pill: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>
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
}> = ({ label, onPress, kind = "secondary", equal = false }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.btn,
      equal && styles.btnGrow,
      kind === "primary" && styles.btnPrimary,
      kind === "outline" && styles.btnOutline,
      pressed && { opacity: 0.8 },
    ]}
  >
    <Text style={[styles.btnText, kind === "primary" && { color: "#fff" }]}>{label}</Text>
  </Pressable>
);

/* ---------------- Screen ---------------- */

export default function TabIndex() {
  const [numPlayers, setNumPlayers] = useState(6);
  const [bigBlind, setBigBlind] = useState(2);
  const [autoNew, setAutoNew] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [facingRaise, setFacingRaise] = useState(false);
  const [heroAction, setHeroAction] = useState<"" | Action>("");
  const [lastAction, setLastAction] = useState<"" | Action>("");
  const [result, setResult] = useState<string>("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  const [feedbackSecs, setFeedbackSecs] = useState(1.0);
  const [showWhy, setShowWhy] = useState(false);

  // compact mode for mobile
  const isCompact = Platform.OS !== "web";

  // hero row flash (fade) state
  const [heroFlash, setHeroFlash] = useState<"none" | "correct" | "incorrect">("none");
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hero = useMemo(() => players.find((p) => p.isHero), [players]);

  // Load persisted prefs first, then deal first hand
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const [sWhy, sAuto, sFacing, sSecs] = await Promise.all([
        Storage.getItem("poker.showWhy"),
        Storage.getItem("poker.autoNew"),
        Storage.getItem("poker.facingRaise"),
        Storage.getItem("poker.feedbackSecs"),
      ]);
      if (sWhy != null) setShowWhy(sWhy === "1");
      if (sAuto != null) setAutoNew(sAuto === "1");
      if (sFacing != null) setFacingRaise(sFacing === "1");
      if (sSecs != null) {
        const v = Math.max(0, Math.min(10, parseFloat(sSecs)));
        if (!Number.isNaN(v)) setFeedbackSecs(v);
      }
      setReady(true);
    })();
  }, []);

  // Persist prefs on change
  useEffect(() => { Storage.setItem("poker.showWhy", showWhy ? "1" : "0"); }, [showWhy]);
  useEffect(() => { Storage.setItem("poker.autoNew", autoNew ? "1" : "0"); }, [autoNew]);
  useEffect(() => { Storage.setItem("poker.facingRaise", facingRaise ? "1" : "0"); }, [facingRaise]);
  useEffect(() => { Storage.setItem("poker.feedbackSecs", String(feedbackSecs)); }, [feedbackSecs]);

  function dealTable(n: number) {
    // reset hero highlight each new hand
    setHeroFlash("none");
    heroFlashOpacity.setValue(0);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    let deck = shuffle(makeDeck());
    const heroSeat = 0; // fixed hero seat

    // rotating dealer/button
    const g: any = (globalThis as any);
    if (typeof g.__BTN_SEAT__ !== "number") g.__BTN_SEAT__ = Math.floor(Math.random() * n);
    else g.__BTN_SEAT__ = (g.__BTN_SEAT__ + 1) % n;
    const btn: number = g.__BTN_SEAT__;

    const ps: Array<Player> = Array.from({ length: n }).map((_, i) => ({
      id: i,
      name: i === heroSeat ? "You" : `P${i + 1}`,
      role: "" as Player["role"],
      bet: 0,
      cards: [deck.pop()!, deck.pop()!] as [CardT, CardT],
      isHero: i === heroSeat,
      positionLabel: "",
    }));

    // assign roles + position labels
    ps.forEach((p, idx) => {
      const pos = (idx - btn + n) % n; // 0=Dealer,1=SB,2=BB,3=UTG...
      if (pos === 0) p.role = "Dealer";
      else if (pos === 1) p.role = "SB";
      else if (pos === 2) p.role = "BB";
      p.positionLabel = labelForPos(pos, n);
    });

    // blinds
    ps.forEach((p) => {
      if (p.role === "SB") p.bet = Math.max(1, Math.floor(bigBlind / 2));
      if (p.role === "BB") p.bet = bigBlind;
    });

    // rotate list so SB is first (top) and Dealer last
    const sbIndex = ps.findIndex((p) => p.role === "SB");
    const rotated = sbIndex >= 0 ? [...ps.slice(sbIndex), ...ps.slice(0, sbIndex)] : ps;

    setPlayers(rotated);
    setHeroAction("");
    if (!showWhy) setResult("");
  }

  function newHand() { dealTable(numPlayers); }

  // First deal after prefs are loaded
  useEffect(() => { if (ready) newHand(); }, [ready]);

  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);
  const recommended = useMemo(() => recommendAction(heroScore, numPlayers, facingRaise), [heroScore, numPlayers, facingRaise]);

  async function resetStatsAndPrefs() {
    // Reset in-memory stats
    setTotalHands(0);
    setCorrectHands(0);
    setLastAction("");
    setResult(showWhy ? "Stats reset." : "");

    // Clear persisted prefs
    await Promise.all([
      Storage.removeItem("poker.showWhy"),
      Storage.removeItem("poker.autoNew"),
      Storage.removeItem("poker.facingRaise"),
      Storage.removeItem("poker.feedbackSecs"),
    ]);

    // Reset current session prefs to defaults
    setShowWhy(false);
    setAutoNew(true);
    setFacingRaise(false);
    setFeedbackSecs(1.0);

    // Redeal to reflect defaults
    dealTable(numPlayers);
  }

  function act(action: Action) {
    setHeroAction(action);
    setLastAction(action);
    const bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
    const correct = bucket === recommended;

    // set hero flash color & animate fade tied to feedbackSecs
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

    setTotalHands((t) => t + 1);
    setCorrectHands((c) => c + (correct ? 1 : 0));

    const why = `Chen score: ${heroScore}. ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.`;
    setResult((correct ? `Correct — ` : `Better play — `) + `Recommended: ${recommended.toUpperCase()}. ${why}`);

    // timers: only auto-hide feedback when Show why is OFF
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (!showWhy && feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
    if (autoNew) dealTimerRef.current = setTimeout(() => newHand(), delay);
  }

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.row, { padding: isCompact ? 8 : 10 }, item.isHero && styles.rowHero]}>
      {/* Fade overlay only for hero */}
      {item.isHero && heroFlash !== "none" && (
        <Animated.View
          pointerEvents="none"
          style={[styles.rowOverlay, { backgroundColor: heroFlash === "correct" ? "#b9efd2" : "#f8c7cc", opacity: heroFlashOpacity }]}
        />
      )}

      {/* LEFT: cards */}
      <View style={styles.cardsCol}>
        <PlayingCard card={item.cards[0]} hidden={!item.isHero} compact={isCompact} />
        <PlayingCard card={item.cards[1]} hidden={!item.isHero} compact={isCompact} />
      </View>

      {/* MIDDLE: name + bet */}
      <View style={styles.metaCol}>
        <Text style={[styles.playerName, isCompact && { fontSize: 14 }]}>{item.name}</Text>
        <Text style={[styles.playerSub, isCompact && { fontSize: 11 }]}>Bet: {item.bet}</Text>
      </View>

      {/* RIGHT: position pill on top, then score/hidden under it */}
      <View style={styles.tailCol}>
        {!!item.positionLabel && (
          <View style={[styles.badge, positionBadgeStyle(item.positionLabel)]}>
            <Text style={[styles.badgeText, isCompact && { fontSize: 11 }]}>{item.positionLabel}</Text>
          </View>
        )}
        <View style={{ height: 6 }} />
        {item.isHero ? <Pill text={`Score ${heroScore}`} /> : <Pill text="Hidden" />}
      </View>
    </View>
  );

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
  }, [heroAction, newHand]);

  /* --- Hotkeys (native, optional): requires `react-native-key-command` --- */
  useEffect(() => {
    if (Platform.OS === "web") return;
    let KeyCommand: any = null;
    try { KeyCommand = require("react-native-key-command"); } catch { return; }
    const unsubscribers: Array<() => void> = [];
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
    <ScrollView contentContainerStyle={styles.screen}>
      {/* Header with compact one-line stats */}
      <View style={styles.header}>
        <Text style={styles.title}>Pre-Flop Trainer</Text>
        <Text style={styles.headerStats} numberOfLines={1}>
          {correctHands}/{totalHands} • Accuracy: {accuracyPct}%
        </Text>
      </View>

      {/* Feedback row: always visible when Show why is ON; shows last action pill */}
      {showWhy && (
        <View style={styles.card}>
          <View style={styles.feedbackRow}>
            <Text style={[styles.feedbackText, { flex: 1, paddingRight: 8 }]}>
              {result || "Take an action to see feedback."}
            </Text>
            <View style={styles.pill}><Text style={styles.pillText}>Last: {formatAction(lastAction)}</Text></View>
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

      {/* Actions — left: C/A/F/R equal widths, right: New hand */}
      <View style={styles.actionsRow}>
        <View style={styles.actionsLeft}>
          <RowButton equal kind="primary" onPress={() => act("check")} label={withHotkey("Check", "c")} />
          <RowButton equal kind="primary" onPress={() => act("call")}  label={withHotkey("Call",  "a")} />
          <RowButton equal kind="primary" onPress={() => act("fold")}  label={withHotkey("Fold",  "f")} />
          <RowButton equal kind="primary" onPress={() => act("raise")} label={withHotkey("Raise", "r")} />
        </View>
        <RowButton label={<Text>New hand</Text>} onPress={newHand} kind="outline" />
      </View>

      {/* Controls (bottom) */}
      <View style={styles.card}>
        <View style={styles.controlsRow}>
          <View style={styles.controlBlock}>
            <Text style={styles.label}>Players</Text>
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
          <View style={styles.switchRow}><Switch value={autoNew} onValueChange={(v) => { setAutoNew(v); dealTable(numPlayers); }} /><Text style={styles.switchLabel}>Auto new hand</Text></View>
          <View style={styles.switchRow}><Switch value={facingRaise} onValueChange={(v) => { setFacingRaise(v); dealTable(numPlayers); }} /><Text style={styles.switchLabel}>Facing a raise</Text></View>
        </View>

        <View style={styles.controlsRow}>
          <View style={[styles.controlBlock, { width: "100%" }]}>
            <Text style={styles.label}>Feedback time (seconds) — also delays auto new hand</Text>
            <View style={[styles.stepper, { justifyContent: "flex-start" }]}>
              <RowButton label={<Text>-</Text>} onPress={() => setFeedbackSecs((s) => Math.max(0, parseFloat((s - 0.5).toFixed(1))))} />
              <Text style={styles.stepperNum}>{feedbackSecs.toFixed(1)}s</Text>
              <RowButton label={<Text>+</Text>} onPress={() => setFeedbackSecs((s) => Math.min(10, parseFloat((s + 0.5).toFixed(1))))} />
            </View>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
              If "Show why" is ON, feedback stays visible; otherwise it hides after the delay above.
            </Text>
          </View>
        </View>

        {/* Show why toggle (persisted) */}
        <View style={styles.controlsRow}>
          <View style={styles.switchRow}>
            <Switch value={showWhy} onValueChange={setShowWhy} />
            <Text style={styles.switchLabel}>Show why (feedback)</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <RowButton label={<Text>Reset stats & prefs</Text>} onPress={resetStatsAndPrefs} kind="outline" />
        </View>
      </View>

      <Text style={styles.helper}>Educational trainer (not a full equity/GTO engine).</Text>
    </ScrollView>
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

  // Header with compact one-line stats on the right
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  headerStats: { fontSize: 13, color: "#333", marginLeft: 12, flexShrink: 1, textAlign: "right" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  controlBlock: { width: "48%" },
  label: { fontSize: 12, color: "#555", marginBottom: 6 },
  input: { backgroundColor: "#f2f2f6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperNum: { width: 60, textAlign: "center", fontSize: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 14 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10, position: "relative", overflow: "hidden" },
  rowOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },

  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },

  // LEFT cards
  cardsCol: { flexDirection: "row", gap: 6 },

  // MIDDLE meta
  metaCol: { flex: 1 },
  playerName: { fontWeight: "600" },
  playerSub: { color: "#666", fontSize: 12 },

  // RIGHT stack: position pill on top, then score
  tailCol: { alignItems: "flex-end", justifyContent: "center" },

  cardBox: { width: 50, height: 68, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cardHidden: { width: 40, height: 58, borderRadius: 8, backgroundColor: "#e6e6ee" },
  cardText: { fontSize: 22, fontWeight: "700" },

  btn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef1ff", borderRadius: 10, alignItems: "center" },
  btnPrimary: { backgroundColor: "#4f6df6" },
  btnOutline: { backgroundColor: "#fff", borderColor: "#d0d0e0", borderWidth: 1 },
  btnText: { color: "#2b2e57", fontWeight: "600" },
  btnGrow: { flex: 1 }, // equal-width action buttons

  underlineLetter: { textDecorationLine: "underline" },

  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },

  // Actions row
  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  actionsLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },

  // Feedback row layout
  feedbackRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },

  // Helper
  helper: { color: "#666", fontSize: 12, textAlign: "center", marginTop: 6 },

  // badge
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
