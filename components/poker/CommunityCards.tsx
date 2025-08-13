import PlayingCard from "@/components/poker/PlayingCard";
import type { CardT } from "@/lib/cards";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

type Props = {
  street: Street;
  flop?: [CardT, CardT, CardT] | null;
  turn?: CardT | null;
  river?: CardT | null;
  totalPot: number;
  isCompact?: boolean;
  heroWon?: boolean | null;
  folded?: boolean;
};

const CommunityCards: React.FC<Props> = ({ street, flop, turn, river, totalPot, isCompact = Platform.OS !== "web", heroWon, folded }) => {
  const bgStyle = heroWon === true ? { backgroundColor: "#b9efd2" } : heroWon === false ? { backgroundColor: "#f8c7cc" } : undefined;

  return (
    <View style={[styles.card, styles.flopCard, bgStyle]}>
      <View style={styles.flopRow}>
        <View style={styles.communityActions}>
          <Text style={styles.streetLabel}>{folded ? "FOLDED" : street.toUpperCase()}</Text>
        </View>
        <View style={[styles.flopCards, { flex: 1, justifyContent: "center" }]}>
          {flop ? <PlayingCard card={flop[0]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {flop ? <PlayingCard card={flop[1]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {flop ? <PlayingCard card={flop[2]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {turn ? <PlayingCard card={turn} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {river ? <PlayingCard card={river} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
        </View>
        <View style={styles.communityActions}>
          <Text style={styles.streetLabel}>Pot: ${totalPot}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  flopCard: { backgroundColor: "#f0f6ff" },
  flopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flopCards: { flexDirection: "row", gap: 6 },
  communityActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  streetLabel: { fontSize: 14, fontWeight: "600", color: "#666", textTransform: "uppercase" },
});

export default CommunityCards;
