import React from "react";
import { Pressable, Text, TextStyle, ViewStyle } from "react-native";

type Props = {
  label: React.ReactNode;
  onPress: () => void;
  kind?: "primary" | "secondary" | "outline";
  equal?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export const RowButton: React.FC<Props> = ({ label, onPress, kind = "secondary", equal = false, disabled = false, style, textStyle }) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={({ pressed }) => [
      { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef1ff", borderRadius: 10, alignItems: "center" },
      equal && { flex: 1 },
      kind === "primary" && { backgroundColor: "#4f6df6" },
      kind === "outline" && { backgroundColor: "#fff", borderColor: "#d0d0e0", borderWidth: 1 },
      disabled && { backgroundColor: "#f5f5f5", opacity: 0.6 },
      !disabled && pressed && { opacity: 0.8 },
      style as any,
    ]}
    disabled={disabled}
  >
    <Text style={[{ color: kind === "primary" ? "#fff" : "#2b2e57", fontWeight: "600" }, disabled && { color: "#999" }, textStyle as any]}>{label as any}</Text>
  </Pressable>
);

export default RowButton;
