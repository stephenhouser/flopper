import type { CardT } from "@/lib/cards";
import { cardToStr } from "@/lib/cards";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

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

const styles = StyleSheet.create({
  cardBox: { width: 50, height: 68, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cardHidden: { width: 40, height: 58, borderRadius: 8, backgroundColor: "#e6e6ee" },
  cardText: { fontSize: 22, fontWeight: "700" },
});

export default PlayingCard;
