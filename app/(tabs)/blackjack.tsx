import { StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useHandHistory } from '@/hooks/useHandHistory';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useSession } from '@/hooks/useSession';
import { DEFAULT_TRAINER_SETTINGS, SETTINGS_STORAGE_KEY, smallBlindFromBigBlind, type TrainerSettings } from '@/models/poker';

export default function BlackjackTab() {
  const { currentSession, setCurrentSession } = useSession('Blackjack');
  const [settings] = usePersistentState<TrainerSettings>(SETTINGS_STORAGE_KEY, DEFAULT_TRAINER_SETTINGS);
  const sb = smallBlindFromBigBlind(settings.bigBlind);

  // Scaffolding: initialize hand history hook (not used yet)
  useHandHistory({ session: currentSession, setSession: setCurrentSession, bigBlind: settings.bigBlind });

  // Scaffolding: hotkeys disabled with no-op handlers
  useHotkeys({ disabled: true, heroAction: '', onAct: () => {}, onNewHand: () => {} });

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Blackjack</ThemedText>
      </ThemedView>
      <ThemedText>This tab will eventually have a blackjack trainer.</ThemedText>

      <View style={{ marginTop: 12 }}>
        <ThemedText style={{ opacity: 0.8, fontSize: 13 }}>
          Poker table: {settings.numPlayers} players • Blinds {'$'}{sb}/{'$'}{settings.bigBlind}
        </ThemedText>
        <ThemedText style={{ opacity: 0.8, fontSize: 13 }}>
          Session: {currentSession ? `${currentSession.hands.length} hands recorded` : 'no active session'}
        </ThemedText>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
