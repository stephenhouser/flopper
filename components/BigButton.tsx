import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

type BigButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function BigButton({ label, onPress, disabled }: BigButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.bigBtn,
        pressed && !disabled && { transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.bigBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bigBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bigBtnText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
