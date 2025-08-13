import React from "react";
import { StyleSheet, Text, View } from "react-native";

export const Pill: React.FC<{ text: string; large?: boolean }> = ({ text, large }) => (
  <View style={[styles.pill, large && styles.pillLarge]}>
    <Text style={[styles.pillText, large && styles.pillLargeText]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  pill: { backgroundColor: "#f1f1f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, color: "#444" },
  pillLarge: { paddingHorizontal: 12, paddingVertical: 6 },
  pillLargeText: { fontSize: 16, fontWeight: "700" },
});

export default Pill;
