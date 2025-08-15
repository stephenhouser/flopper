import type { CardT } from "@/lib/cards";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export const PlayingCard: React.FC<{ card?: CardT; hidden?: boolean }> = ({ card, hidden }) => {
  const red = card && (card.suit === "♥" || card.suit === "♦");
  return (
    <View style={styles.cardBox}>
      {hidden ? (
        <View style={styles.cardHidden} />
      ) : (
        <Text style={[styles.cardText, red && { color: "#d11" }]}>{card ? card.cardToStr() : ""}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardBox: { width: 50, height: 68, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cardHidden: { width: 40, height: 58, borderRadius: 8, backgroundColor: "#e6e6ee" },
  cardText: { fontSize: 22, fontWeight: "700" },
});

export default PlayingCard;
