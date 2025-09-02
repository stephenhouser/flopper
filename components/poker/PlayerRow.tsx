import { PlayingCard } from "@/components/poker/PlayingCard";
import { Pill } from "@/components/ui/Pill";
import { chenScore } from "@/lib/chen";
import { Player, positionBadgeStyle } from "@/models/poker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

export type FlashState = "none" | "correct" | "incorrect" | "active";

type Props = {
  player: Player;
  showHandScore: boolean;
  flashState?: FlashState;
  flashOpacity?: Animated.Value;
  pulseKey?: number; // increments when this player acts
  isActive?: boolean; // New: highlight when it's this player's turn
};

const PlayerRowComponent = React.memo(
  ({ player, showHandScore, flashState = "none", flashOpacity, pulseKey, isActive = false }: Props) => {
    // Local reveal state for non-hero players
    const [isRevealed, setIsRevealed] = useState(false);
    
    const isPlayerRevealed = player.isHero || isRevealed; // Hero cards are always visible
    
    // Calculate Chen score locally for all players
    const playerScore = chenScore(player.cards[0], player.cards[1]);

    const actionText = player.lastAction ? player.lastAction.toUpperCase() : "";

    // Format bet display directly here
    const betText = player.bet === 0 ? "" : `$${player.bet}`;

    // Toggle reveal for non-hero players
    const handleToggleReveal = () => {
      if (!player.isHero) {
        setIsRevealed(prev => !prev);
      }
    };

    // Local transient highlight for non-hero when they act
    const pulseOpacityRef = useRef(new Animated.Value(0));
    useEffect(() => {
      if (player.isHero) return; // hero uses flash overlay
      if (!pulseKey) return;
      // Make AI row highlight more visible and last 0.25s
      pulseOpacityRef.current.setValue(1);
      Animated.timing(pulseOpacityRef.current, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, [pulseKey, player.isHero]);

    const overlayStyle = useMemo(() => {
      if (player.isHero && flashState !== "none" && flashOpacity) {
        return [
          styles.rowOverlay,
          { backgroundColor: flashState === "correct" ? "#b9efd2" : flashState === "incorrect" ? "#f8c7cc" : "#e5f1ff", opacity: flashOpacity },
        ];
      }
      if (!player.isHero) {
        return [styles.rowOverlay, { backgroundColor: "#bfdbfe", opacity: pulseOpacityRef.current }];
      }
      return null;
    }, [player.isHero, flashState, flashOpacity]);

    // Use the player's computed labels directly
    const badges: { label: string; style: any }[] = player.labels.map(label => ({
      label,
      style: positionBadgeStyle(label)
    }));

    return (
      <Pressable
        onPress={!player.isHero ? handleToggleReveal : undefined}
        style={({ pressed }) => [
          styles.row,
          !player.isHero && player.folded && styles.rowFolded,
          player.isHero && styles.rowHero,
          isActive && !player.folded && styles.rowActive, // Highlight active player (but not if folded)
          !player.isHero && pressed && { opacity: 0.8 },
        ]}
      >
        {overlayStyle && (
          <Animated.View pointerEvents="none" style={overlayStyle} />
        )}

        <View style={styles.cardsCol}>
          <PlayingCard card={player.cards[0]} hidden={!player.isHero && !isPlayerRevealed} />
          <PlayingCard card={player.cards[1]} hidden={!player.isHero && !isPlayerRevealed} />
        </View>

        <View style={styles.metaCol}>
          <View style={styles.nameRow1}>
            {badges.map((b, i) => (
              <View key={`${b.label}-${i}`} style={[styles.badge, b.style]}>
                <Text style={styles.badgeText}>{b.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.nameRow2}>
            <Text style={[styles.playerName, player.folded && { color: '#4b5563' }]}>{player.name} (${player.stack})</Text>
            {player.isHero && showHandScore ? (
              <Text style={styles.playerSub}>Score: {playerScore}</Text>
            ) : null}
            {!player.isHero && isPlayerRevealed && showHandScore ? (
              <Text style={styles.playerSub}>Score: {playerScore}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tailCol}>
          <View style={styles.tailRow}>
            {!!actionText && (
              <View style={styles.actionPill}>
                <Text style={styles.actionPillText}>{actionText}</Text>
              </View>
            )}
            <Pill large text={betText} />
          </View>
        </View>
      </Pressable>
    );
  }
);

PlayerRowComponent.displayName = "PlayerRow";

export const PlayerRow = PlayerRowComponent;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 10, position: "relative", overflow: "hidden" },
  rowOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  rowHero: { borderWidth: 1, borderColor: "#6b8afd" },
  rowFolded: { backgroundColor: "#d1d5db", borderWidth: 1, borderColor: "#9ca3af" },
  rowActive: { backgroundColor: "#fef3c7", borderWidth: 2, borderColor: "#f59e0b" }, // Yellow highlight for active player
  cardsCol: { flexDirection: "row", gap: 6 },
  metaCol: { flex: 1 },
  nameRow1: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameRow2: { flexDirection: "row", alignItems: "baseline", justifyContent: "flex-start", gap: 8, paddingLeft: 4, paddingTop: 3 },
  playerName: { fontWeight: "600", fontSize: 18 },
  playerSub: { color: "#666", fontSize: 12 },
  tailCol: { alignItems: "flex-end", justifyContent: "center" },
  tailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionPill: { backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  actionPillText: { fontSize: 11, color: "#1e40af", fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 14, fontWeight: "600" },
});

export default PlayerRow;
