import { PlayingCard } from "@/components/poker/PlayingCard";
import { Pill } from "@/components/ui/Pill";
import { chenScore } from "@/lib/chen";
import { Player } from "@/models/poker";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

export type FlashState = "none" | "correct" | "incorrect" | "active";

type Props = {
  player: Player;
  showHandScore: boolean; // renamed prop
  handScore: number; // renamed prop
  revealed: boolean;
  onToggleReveal?: (playerId: number) => void;
  flashState?: FlashState;
  flashOpacity?: Animated.Value;
  betLabel: (p: Player) => string;
  actionLabel?: (p: Player) => string; // New: optional action pill label provider
  pulseKey?: number; // increments when this player acts
};

const PlayerRowComponent = React.memo(
  ({ player, showHandScore, handScore, revealed, onToggleReveal, flashState = "none", flashOpacity, betLabel, actionLabel, pulseKey }: Props) => {
    const isPlayerRevealed = revealed;

    const actionText = actionLabel ? (actionLabel(player) || "") : "";

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

    // Build badge list: Dealer + blind tags as separate pills
    const badges: Array<{ label: string; style: any }> = [];
    if (player.isDealer) badges.push({ label: "Dealer", style: Player.positionBadgeStyle("Dealer") });
    if (player.isSmallBlind) badges.push({ label: "SB", style: Player.positionBadgeStyle("SB") });
    if (player.isBigBlind) badges.push({ label: "BB", style: Player.positionBadgeStyle("BB") });
    // Also include positionLabel for non-blind seats (e.g., UTG, MP, ...)
    if (player.positionLabel && !["Dealer", "SB", "BB"].includes(player.positionLabel)) {
      badges.push({ label: player.positionLabel, style: Player.positionBadgeStyle(player.positionLabel) });
    }

    return (
      <Pressable
        onPress={!player.isHero && onToggleReveal ? () => onToggleReveal(player.id) : undefined}
        style={({ pressed }) => [
          styles.row,
          player.isHero && styles.rowHero,
          !player.isHero && player.folded && styles.rowFolded,
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
            <Text style={styles.playerName}>{player.name}</Text>
            {player.isHero && showHandScore ? (
              <Text style={styles.playerSub}>Score: {handScore}</Text>
            ) : null}
            {!player.isHero && isPlayerRevealed && showHandScore ? (
              <Text style={styles.playerSub}>Score: {chenScore(player.cards[0], player.cards[1])}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tailCol}>
          <View style={styles.tailRow}>
            {!!actionText && <Pill text={actionText} />}
            <Pill large text={betLabel(player)} />
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
  rowFolded: { backgroundColor: "#f3f4f6" },
  cardsCol: { flexDirection: "row", gap: 6 },
  metaCol: { flex: 1 },
  nameRow1: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameRow2: { flexDirection: "row", alignItems: "baseline", justifyContent: "flex-start", gap: 8, paddingLeft: 4, paddingTop: 3 },
  playerName: { fontWeight: "600", fontSize: 18 },
  playerSub: { color: "#666", fontSize: 12 },
  tailCol: { alignItems: "flex-end", justifyContent: "center" },
  tailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 14, fontWeight: "600" },
});

export default PlayerRow;
