import PlayingCard from "@/components/poker/PlayingCard";
import Pill from "@/components/ui/Pill";
import { chenScore } from "@/lib/chen";
import { positionBadgeStyle } from "@/lib/positions";
import type { Player } from "@/models/poker";
import React from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type FlashState = "none" | "correct" | "incorrect";

type Props = {
  player: Player;
  isCompact?: boolean;
  showScore: boolean;
  heroScore: number;
  showAllCards: boolean;
  revealed: boolean;
  onToggleReveal?: (playerId: number) => void;
  flashState?: FlashState;
  flashOpacity?: Animated.Value;
  betLabel: (p: Player) => string;
};

export const PlayerRow: React.FC<Props> = React.memo(({ player, isCompact = Platform.OS !== "web", showScore, heroScore, showAllCards, revealed, onToggleReveal, flashState = "none", flashOpacity, betLabel }) => {
  const isPlayerRevealed = showAllCards || revealed;

  return (
    <Pressable
      onPress={!player.isHero && onToggleReveal ? () => onToggleReveal(player.id) : undefined}
      style={({ pressed }) => [
        styles.row,
        { padding: isCompact ? 8 : 10 },
        player.isHero && styles.rowHero,
        !player.isHero && pressed && { opacity: 0.8 },
      ]}
    >
      {player.isHero && flashState !== "none" && flashOpacity && (
        <Animated.View
          pointerEvents="none"
          style={[styles.rowOverlay, { backgroundColor: flashState === "correct" ? "#b9efd2" : "#f8c7cc", opacity: flashOpacity }]}
        />
      )}

      <View style={styles.cardsCol}>
        <PlayingCard card={player.cards[0]} hidden={!player.isHero && !isPlayerRevealed} compact={isCompact} />
        <PlayingCard card={player.cards[1]} hidden={!player.isHero && !isPlayerRevealed} compact={isCompact} />
      </View>

      <View style={styles.metaCol}>
        <View style={styles.nameRow1}>
          {!!player.positionLabel && (
            <View style={[styles.badge, positionBadgeStyle(player.positionLabel)]}>
              <Text style={[styles.badgeText, isCompact && { fontSize: 13 }]}>{player.positionLabel}</Text>
            </View>
          )}
        </View>
        <View style={styles.nameRow2}>
          <Text style={[styles.playerName, isCompact && { fontSize: 16 }]}>{player.name}</Text>
          {player.isHero && showScore ? (
            <Text style={[styles.playerSub, isCompact && { fontSize: 11 }]}>Score: {heroScore}</Text>
          ) : null}
          {!player.isHero && isPlayerRevealed && showScore ? (
            <Text style={[styles.playerSub, isCompact && { fontSize: 11 }]}>Score: {chenScore(player.cards[0], player.cards[1])}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.tailCol}>
        <Pill large text={betLabel(player)} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10, position: "relative", overflow: "hidden" },
  rowOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },
  cardsCol: { flexDirection: "row", gap: 6 },
  metaCol: { flex: 1 },
  nameRow1: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameRow2: { flexDirection: "row", alignItems: "baseline", justifyContent: "flex-start", gap: 8, paddingLeft: 4, paddingTop: 3 },
  playerName: { fontWeight: "600", fontSize: 18 },
  playerSub: { color: "#666", fontSize: 12 },
  tailCol: { alignItems: "flex-end", justifyContent: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 14, fontWeight: "600" },
});

export default PlayerRow;
