import { router } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import BigButton from "../../components/BigButton";

export default function HomeTab() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>flopper</Text>
          <Text style={styles.subtitle}>the card game training app</Text>
          <Text style={styles.description}>
            Sharpen your decision-making for poker and blackjack with focused,
            bite-size drills. Pick a module below to start practicing.
          </Text>
        </View>

        <View style={styles.buttons}>
          <BigButton label="Texas Holdem" onPress={() => router.navigate("/(tabs)/texas-holdem")} />
          <BigButton label="Omaha" onPress={() => router.navigate("/(tabs)/omaha")} />
          <BigButton label="Blackjack" onPress={() => router.navigate("/(tabs)/blackjack")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20 },
  headerBlock: { gap: 6, marginTop: 8 },
  title: { fontSize: 40, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { fontSize: 16, opacity: 0.7 },
  description: { marginTop: 10, fontSize: 16, lineHeight: 22, opacity: 0.9 },
  buttons: { marginTop: 8, gap: 12 },
});
