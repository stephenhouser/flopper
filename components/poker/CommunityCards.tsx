import PlayingCard from "@/components/poker/PlayingCard";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { Board, Street } from "@/models/poker";

type Props = {
  street: Street;
  board: Board;
  totalPot: number;
  isCompact?: boolean;
  heroWon?: boolean | null;
  folded?: boolean;
};

const CommunityCards: React.FC<Props> = ({ street, board, totalPot, isCompact = Platform.OS !== "web", heroWon, folded }) => {
  const bgStyle = heroWon === true ? { backgroundColor: "#b9efd2" } : heroWon === false ? { backgroundColor: "#f8c7cc" } : undefined;

  // Determine left label: show FOLDED if folded; when complete and heroWon is known, show WIN/LOST; otherwise show street
  const leftLabel = folded
    ? "Folded"
    : street === "complete" && heroWon != null
      ? (heroWon ? "Win" : "Lost")
      : street;

  return (
    <View style={[styles.card, styles.flopCard, bgStyle]}>
      <View style={styles.flopRow}>
        <View style={styles.communityActions}>
          <Text style={styles.streetLabel}>{leftLabel}</Text>
        </View>
        <View style={[styles.flopCards, { flex: 1, justifyContent: "center" }]}>
          {board.flop ? <PlayingCard card={board.flop[0]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {board.flop ? <PlayingCard card={board.flop[1]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {board.flop ? <PlayingCard card={board.flop[2]} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {board.turn ? <PlayingCard card={board.turn} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
          {board.river ? <PlayingCard card={board.river} compact={isCompact} /> : <PlayingCard hidden compact={isCompact} />}
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
