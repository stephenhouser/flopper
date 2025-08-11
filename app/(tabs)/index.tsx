import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

/**
 * Drop this file in: app/(tabs)/index.tsx
 * - Dealer/button advances each hand; your seat stays fixed (seat 0)
 * - SB shown at top, Dealer at bottom
 * - Position pill on the left (Dealer/SB/BB/UTG/UTG+1/MP/LJ/HJ/CO), unique colors
 * - Actions: Check / Call / Fold / Raise (primary blue, hotkeys underlined)
 * - Hotkeys: c/a/f/r, Enter=repeat, Space=new hand (web + optional native)
 * - Stats & feedback at top; controls at bottom (instant redeal, reset stats)
 * - Adjustable feedback time (also delays auto new hand)
 */

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

function cardToStr(c?: CardT) { return c ? `${c.rank}${c.suit}` : ""; }

/* ---------------- Chen Formula heuristic ---------------- */

const chenRankValue: Record<Rank, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5,
  9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1,
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
  const tableTightener = Math.max(0, (numPlayers - 6) * 0.7); // +0 at 6-max, tighter at 9
  if (facingRaise) {
    if (score >= 11 + tableTightener) return "raise";       // 3-bet
    if (score >= 8 + tableTightener) return "call/check";   // call
    return "fold";
  } else {
    if (score >= 9 + tableTightener) return "raise";        // open
    if (score >= 6 + tableTightener) return "call/check";   // limp/check
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

function labelForPos(posFromDealer: number, n: number): string {
  if (posFromDealer === 0) return "Dealer"; // BTN
  if (posFromDealer === 1) return "SB";
  if (posFromDealer === 2) return "BB";
  const rest = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO"]; // extend if needed
  return rest[posFromDealer - 3] || `Seat ${posFromDealer}`;
}

/* ---------------- UI bits ---------------- */

const Pill: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>
);

const PlayingCard: React.FC<{ card?: CardT; hidden?: boolean }> = ({ card, hidden }) => {
  const red = card && (card.suit === "♥" || card.suit === "♦");
  return (
    <View style={styles.cardBox}>
      {hidden ? <View style={styles.cardHidden} /> : (
        <Text style={[styles.cardText, red && { color: "#d11" }]}>{cardToStr(card)}</Text>
      )}
    </View>
  );
};

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

// Add `equal?: boolean`
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
      equal && styles.btnGrow,            // ⬅️ equal-width
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
  const [heroAction, setHeroAction] = useState<"" | "check" | "call" | "fold" | "raise">("");
  const [result, setResult] = useState<string>("");
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  const [feedbackSecs, setFeedbackSecs] = useState(1.0); // also controls auto new hand delay

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hero = useMemo(() => players.find((p) => p.isHero), [players]);

  function dealTable(n: number) {
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
    setResult("");
  }

  function newHand() { dealTable(numPlayers); }

  useEffect(() => { newHand(); }, []);

  const heroScore = useMemo(() => (hero ? chenScore(hero.cards[0], hero.cards[1]) : 0), [hero]);

  const recommended = useMemo(
    () => recommendAction(heroScore, numPlayers, facingRaise),
    [heroScore, numPlayers, facingRaise]
  );

  function resetStats() {
    setTotalHands(0);
    setCorrectHands(0);
    setResult("Stats reset. Play the next hand to start tracking again.");
  }

  function act(action: "check" | "call" | "fold" | "raise") {
    setHeroAction(action);
    const bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
    const correct = bucket === recommended;

    setTotalHands((t) => t + 1);
    setCorrectHands((c) => c + (correct ? 1 : 0));

    const why = `Chen score: ${heroScore}. ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.`;
    setResult((correct ? `Correct ✅ — ` : `Better play ❗ — `) + `Recommended: ${recommended.toUpperCase()}. ${why}`);

    // timers
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    const delay = Math.max(0, Math.round(feedbackSecs * 1000));
    if (feedbackSecs > 0) hideTimerRef.current = setTimeout(() => setResult(""), delay);
    if (autoNew) dealTimerRef.current = setTimeout(() => newHand(), delay);
  }

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.row, item.isHero && styles.rowHero]}>
      <View style={styles.roleCol}>
        {!!item.positionLabel && (
          <View style={[styles.badge, positionBadgeStyle(item.positionLabel)]}>
            <Text style={styles.badgeText}>{item.positionLabel}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardsCol}>
        <PlayingCard card={item.cards[0]} hidden={!item.isHero} />
        <PlayingCard card={item.cards[1]} hidden={!item.isHero} />
      </View>
      <View style={styles.metaCol}>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerSub}>Bet: {item.bet}</Text>
      </View>
      <View style={styles.tailCol}>
        {item.isHero ? <Pill text={`Score ${heroScore}`} /> : <Pill text="Hidden" />}
      </View>
    </View>
  );

  const accuracyPct = totalHands ? ((correctHands / totalHands) * 100).toFixed(1) : "0.0";

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

  /* --- Hotkeys (native, optional): requires `react-native-key-command` in a dev build --- */
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Poker Hand Trainer</Text>
          <Text style={styles.subtitle}>Pre-flop reps with instant feedback</Text>
        </View>
      </View>

      {/* Stats & Feedback (why on left; totals stacked on right) */}
      <View style={styles.card}>
        <View style={styles.statsRow}>
          <View style={styles.statsLeft}>
            <Text style={styles.feedbackText}>{result || "Take an action to see feedback here."}</Text>
            <Text style={styles.feedbackSub}>Basis: Chen heuristic with table-size & facing-raise adjustments.</Text>
          </View>
          <View style={styles.statsRight}>
            <Text style={styles.statLine}>Total: {totalHands}</Text>
            <Text style={styles.statLine}>Correct: {correctHands}</Text>
            <Text style={styles.statLine}>Accuracy: {accuracyPct}%</Text>
          </View>
        </View>
      </View>

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
          <RowButton equal label={<Text>New hand</Text>} onPress={newHand} kind="outline" />
        </View>

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
              Set to 0.0s to keep feedback visible (turn off Auto new hand if you want to study longer).
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <RowButton label={<Text>Reset stats</Text>} onPress={resetStats} kind="outline" />
        </View>
      </View>

      <Text style={styles.helper}>Educational trainer (not a full equity/GTO engine).</Text>
    </ScrollView>
  );
}

/* Position badge colors for all seats */
function positionBadgeStyle(label?: string) {
  switch (label) {
    case "Dealer": return { backgroundColor: "#EDE2FF" }; // purple
    case "SB":     return { backgroundColor: "#D7E8FF" }; // light blue
    case "BB":     return { backgroundColor: "#FFE8C7" }; // pale orange

    case "UTG":    return { backgroundColor: "#E6F6EB" }; // soft green
    case "UTG+1":  return { backgroundColor: "#E3F4FF" }; // light sky
    case "MP":     return { backgroundColor: "#FFF5CC" }; // pale yellow
    case "LJ":     return { backgroundColor: "#FDE2F2" }; // light pink
    case "HJ":     return { backgroundColor: "#E0E7FF" }; // periwinkle
    case "CO":     return { backgroundColor: "#ECECEC" }; // neutral gray
    default:       return { backgroundColor: "#F1F1F6" };
  }
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 12, color: "#666" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  controlsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  controlBlock: { width: "48%" },
  label: { fontSize: 12, color: "#555", marginBottom: 6 },
  input: { backgroundColor: "#f2f2f6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperNum: { width: 60, textAlign: "center", fontSize: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 14 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10 },
  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },
  roleCol: { width: 74, alignItems: "center" },
  cardsCol: { flexDirection: "row", gap: 6 },
  metaCol: { flex: 1 },
  tailCol: {},
  playerName: { fontWeight: "600" },
  playerSub: { color: "#666", fontSize: 12 },

  cardBox: { width: 50, height: 68, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cardHidden: { width: 40, height: 58, borderRadius: 8, backgroundColor: "#e6e6ee" },
  cardText: { fontSize: 22, fontWeight: "700" },

  btn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef1ff", borderRadius: 10, alignItems: "center" },
  btnPrimary: { backgroundColor: "#4f6df6" },
  btnOutline: { backgroundColor: "#fff", borderColor: "#d0d0e0", borderWidth: 1 },
  btnText: { color: "#2b2e57", fontWeight: "600" },

  underlineLetter: { textDecorationLine: "underline" },

  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  actionsLeft: {
    flex: 1,                         // ⬅️ left group fills row
    flexDirection: "row",
    alignItems: "center",
    gap: 8,                          // spacing between equal buttons
  },
  btnGrow: {
    flex: 1,                         // ⬅️ each action button shares space evenly
  },

  // Stats layout
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  statsLeft: { flex: 1, paddingRight: 8 },
  statsRight: { minWidth: 120, alignItems: "flex-end" },
  statLine: { fontSize: 13, fontWeight: "600" },

  feedbackText: { fontWeight: "600" },
  feedbackSub: { color: "#666", marginTop: 4, fontSize: 12 },

  helper: { color: "#666", fontSize: 12, textAlign: "center", marginTop: 6 },

  // badge
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
