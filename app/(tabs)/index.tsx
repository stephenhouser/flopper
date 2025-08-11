import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

/**
 * Drop this file in: app/(tabs)/index.tsx
 * Works with Expo Router's Tabs layout. No external UI libs required.
 * If your tabs path differs, place it in the corresponding tab's screen file.
 */

// ---------------- Card / Deck helpers ----------------

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

// ---------------- Chen Formula heuristic ----------------

const chenRankValue: Record<Rank, number> = {
  A: 10,
  K: 8,
  Q: 7,
  J: 6,
  T: 5,
  9: 4.5,
  8: 4,
  7: 3.5,
  6: 3,
  5: 2.5,
  4: 2,
  3: 1.5,
  2: 1,
};

function chenScore(c1: CardT, c2: CardT): number {
  const ranks = [c1.rank, c2.rank].sort((a, b) => chenRankValue[b] - chenRankValue[a]);
  const [rHigh, rLow] = ranks as [Rank, Rank];
  const suited = c1.suit === c2.suit;
  const gap = Math.abs(RANKS.indexOf(rHigh) - RANKS.indexOf(rLow)) - 1; // AK gap=0, A5 gap=3

  let score = chenRankValue[rHigh];

  if (rHigh === rLow) {
    score = Math.max(5, chenRankValue[rHigh] * 2);
  }

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
    if (score >= 11 + tableTightener) return "raise"; // 3-bet
    if (score >= 8 + tableTightener) return "call/check"; // call
    return "fold";
  } else {
    if (score >= 9 + tableTightener) return "raise"; // open
    if (score >= 6 + tableTightener) return "call/check"; // limp/check
    return "fold";
  }
}

// ---------------- Types ----------------

type Player = {
  id: number;
  name: string;
  role: "Dealer" | "SB" | "BB" | "";
  bet: number;
  cards: [CardT, CardT];
  isHero: boolean;
};

// ---------------- UI pieces ----------------

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

const RowButton: React.FC<{ label: string; onPress: () => void; kind?: "primary" | "secondary" | "outline" }> = ({ label, onPress, kind = "secondary" }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [
    styles.btn,
    kind === "primary" && styles.btnPrimary,
    kind === "outline" && styles.btnOutline,
    pressed && { opacity: 0.8 },
  ]}>
    <Text style={[styles.btnText, (kind === "primary") && { color: "#fff" }]}>{label}</Text>
  </Pressable>
);

// ---------------- Screen (Tab) ----------------

export default function TabIndex() {
  const [numPlayers, setNumPlayers] = useState(6);
  const [bigBlind, setBigBlind] = useState(2);
  const [autoNew, setAutoNew] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [facingRaise, setFacingRaise] = useState(false);
  const [heroAction, setHeroAction] = useState<"" | "check" | "call" | "fold" | "raise">("");
  const [result, setResult] = useState<string>("");

  const hero = useMemo(() => players.find((p) => p.isHero), [players]);

function dealTable(n:number){
  let deck = shuffle(makeDeck());

  // Keep hero fixed at the same seat every hand
  const heroSeat = 0;

  // Advance a global button (dealer) seat each hand so your relative position changes
  const g: any = (globalThis as any);
  if (typeof g.__BTN_SEAT__ !== 'number') {
    g.__BTN_SEAT__ = Math.floor(Math.random() * n); // random starting dealer
  } else {
    g.__BTN_SEAT__ = (g.__BTN_SEAT__ + 1) % n; // dealer advances each hand
  }
  const btn: number = g.__BTN_SEAT__;

  const positionLabels = ["Dealer", "SB", "BB", "UTG", "MP", "HJ", "CO"];

  const ps:Array<Player> = Array.from({ length:n }).map((_, i) => ({
    id: i,
    name: i === heroSeat ? "You" : `P${i+1}`,
    role: "" as Player["role"],
    bet: 0,
    cards: [deck.pop()!, deck.pop()!] as [CardT, CardT],
    isHero: i === heroSeat,
    positionLabel: "" as string,
  } as Player & { positionLabel: string }));

  // Assign roles and position labels based on current dealer (button)
  ps.forEach((p, idx) => {
    const pos = (idx - btn + n) % n;
    if (pos === 0) p.role = "Dealer";
    else if (pos === 1) p.role = "SB";
    else if (pos === 2) p.role = "BB";

    // Assign position labels, cycling through available labels array
    p.positionLabel = positionLabels[pos] || `Pos ${pos}`;
  });

  // Set blinds
  ps.forEach((p) => {
    if (p.role === "SB") p.bet = Math.max(1, Math.floor(bigBlind / 2));
    if (p.role === "BB") p.bet = bigBlind;
  });

  // Rotate list so SB is first (top) and Dealer ends last
  const sbIndex = ps.findIndex((p) => p.role === "SB");
  const rotated = sbIndex >= 0 ? [...ps.slice(sbIndex), ...ps.slice(0, sbIndex)] : ps;

  setPlayers(rotated);
  setHeroAction("");
  setResult("");
}


  function newHand() {
    dealTable(numPlayers);
    setFacingRaise(Math.random() < 0.35);
  }

  useEffect(() => {
    newHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroScore = useMemo(() => {
    if (!hero) return 0;
    return chenScore(hero.cards[0], hero.cards[1]);
  }, [hero]);

  const recommended = useMemo(() => {
    return recommendAction(heroScore, numPlayers, facingRaise);
  }, [heroScore, numPlayers, facingRaise]);

  function act(action: "check" | "call" | "fold" | "raise") {
    setHeroAction(action);
    const bucket = action === "fold" ? "fold" : action === "raise" ? "raise" : "call/check";
    const correct = bucket === recommended;
    const why = `Chen score: ${heroScore}. ${facingRaise ? "Facing a raise." : "No raise yet."} ${numPlayers} players.`;
    setResult(
      correct
        ? `Correct — Recommended: ${recommended.toUpperCase()}. ${why}`
        : `Better play: ${recommended.toUpperCase()} — Your action: ${action.toUpperCase()}. ${why}`
    );
    if (autoNew) setTimeout(() => newHand(), 900);
  }

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.row, item.isHero && styles.rowHero]}> 
      <View style={styles.roleCol}>
        {!!item.role && <View style={[styles.badge, roleBadgeStyle(item.role)]}><Text style={styles.badgeText}>{item.role}</Text></View>}
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
        {item.isHero ? (
          <Pill text={`Score ${heroScore}`} />
        ) : (
          <Pill text="Hidden" />
        )}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}> 
      {/* Header */}
      <View style={styles.header}> 
        <View>
          <Text style={styles.title}>Poker Hand Trainer</Text>
          <Text style={styles.subtitle}>Pre-flop reps with instant feedback</Text>
        </View>
        <RowButton label="New hand" onPress={newHand} kind="outline" />
      </View>

      {/* Controls */}
      <View style={styles.card}> 
        <View style={styles.controlsRow}>
          <View style={styles.controlBlock}>
            <Text style={styles.label}>Players</Text>
            <View style={styles.stepper}> 
              <RowButton label="-" onPress={() => setNumPlayers((n) => Math.max(2, n - 1))} />
              <Text style={styles.stepperNum}>{numPlayers}</Text>
              <RowButton label="+" onPress={() => setNumPlayers((n) => Math.min(9, n + 1))} />
            </View>
          </View>
          <View style={styles.controlBlock}>
            <Text style={styles.label}>Big blind</Text>
            <TextInput
              value={String(bigBlind)}
              onChangeText={(t) => setBigBlind(Math.max(1, Number(t.replace(/[^0-9]/g, "")) || 1))}
              inputMode="numeric"
              keyboardType={Platform.select({ ios: "number-pad", android: "numeric", default: "numeric" })}
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.controlsRow}>
          <View style={styles.switchRow}>
            <Switch value={autoNew} onValueChange={setAutoNew} />
            <Text style={styles.switchLabel}>Auto new hand</Text>
          </View>
          <View style={styles.switchRow}>
            <Switch value={facingRaise} onValueChange={setFacingRaise} />
            <Text style={styles.switchLabel}>Facing a raise</Text>
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

      {/* Actions */}
      <View style={styles.actionsRow}> 
        <RowButton label="Check" onPress={() => act("check")} />
        <RowButton label="Call" onPress={() => act("call")} />
        <RowButton label="Fold" onPress={() => act("fold")} kind="outline" />
        <RowButton label="Raise" onPress={() => act("raise")} kind="primary" />
      </View>

      {/* Feedback */}
      {heroAction ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{result}</Text>
          <Text style={styles.feedbackSub}>Basis: Chen heuristic with table-size & facing-raise adjustments.</Text>
        </View>
      ) : null}

      <Text style={styles.helper}>Educational trainer (not a full equity/GTO engine).</Text>
    </ScrollView>
  );
}

function roleBadgeStyle(role: Player["role"]) {
  switch (role) {
    case "Dealer":
      return { backgroundColor: "#EDE2FF" };
    case "SB":
      return { backgroundColor: "#D7E8FF" };
    case "BB":
      return { backgroundColor: "#FFE8C7" };
    default:
      return {};
  }
}

// ---------------- Styles ----------------

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
  stepperNum: { width: 36, textAlign: "center", fontSize: 16 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 14 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10 },
  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },
  roleCol: { width: 60, alignItems: "center" },
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

  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },

  actionsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },

  feedbackCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12 },
  feedbackText: { fontWeight: "600" },
  feedbackSub: { color: "#666", marginTop: 4, fontSize: 12 },

  helper: { color: "#666", fontSize: 12, textAlign: "center", marginTop: 6 },
});
