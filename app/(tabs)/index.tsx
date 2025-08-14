import { ThemedText } from '@/components/ThemedText';

import { usePersistentState } from "@/hooks/usePersistentState";
import { useSession } from "@/hooks/useSession";
import { DEFAULT_TRAINER_SETTINGS, SETTINGS_STORAGE_KEY, smallBlindFromBigBlind, type TrainerSettings } from "@/models/poker";
import { router } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import BigButton from "../../components/BigButton";

export default function HomeTab() {
  const { currentSession } = useSession();
  const [settings] = usePersistentState<TrainerSettings>(SETTINGS_STORAGE_KEY, DEFAULT_TRAINER_SETTINGS);
  const sb = smallBlindFromBigBlind(settings.bigBlind);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}>
        <View style={styles.headerBlock}>
          <ThemedText style={styles.title}>flopper</ThemedText>
          <ThemedText style={styles.subtitle}>the card game training app</ThemedText>
          <ThemedText style={styles.description}>
            Sharpen your decision-making for poker and blackjack with focused,
            bite-size drills. Pick a module below to start practicing or playing.
          </ThemedText>
        </View>

        <View style={styles.buttons}>
          <BigButton label="Texas Holdem" onPress={() => router.navigate("/(tabs)/texas-holdem")} />
          <BigButton label="Omaha" onPress={() => router.navigate("/(tabs)/omaha")} />
          <BigButton label="Blackjack" onPress={() => router.navigate("/(tabs)/blackjack")} />
          <BigButton label="Play Tracker" onPress={() => router.navigate("/(tabs)/tracker")} />
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
