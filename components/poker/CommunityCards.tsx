import { PlayingCard } from "@/components/poker/PlayingCard";
import type { Board, Street } from "@/models/poker";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  street: Street;
  board: Board;
  totalPot: number;
  heroWon?: boolean | null;
  folded?: boolean;
};

export const CommunityCards: React.FC<Props> = ({ street, board, totalPot, heroWon, folded }) => {
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
          <PlayingCard card={board[0]} hidden={board.length < 1} />
          <PlayingCard card={board[1]} hidden={board.length < 2} />
          <PlayingCard card={board[2]} hidden={board.length < 3} />
          <PlayingCard card={board[3]} hidden={board.length < 4} />
          <PlayingCard card={board[4]} hidden={board.length < 5} />
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
