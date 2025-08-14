import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import type { GameType } from '@/models/tracker';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

export type SessionModalProps = {
  title: string;
  visible: boolean;
  onRequestClose: () => void;
  onSubmitLabel: string;
  onSubmit: () => void;
  canSubmit: boolean;
  // form values
  name: string; setName: (v: string) => void;
  game: GameType; setGame: (v: GameType) => void;
  starting: string; setStarting: (v: string) => void;
  exit: string; setExit: (v: string) => void;
  hands: string; setHands: (v: string) => void;
  isReal: boolean; setIsReal: (v: boolean) => void;
  notes: string; setNotes: (v: string) => void;
  dateStr: string; setDateStr: (v: string) => void;
  timeStr: string; setTimeStr: (v: string) => void;
};

export function SessionModal(props: SessionModalProps) {
  const {
    title, visible, onRequestClose, onSubmitLabel, onSubmit, canSubmit,
    name, setName, game, setGame, starting, setStarting, exit, setExit,
    hands, setHands, isReal, setIsReal, notes, setNotes, dateStr, setDateStr, timeStr, setTimeStr,
  } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.modalOverlay} onPress={onRequestClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCardWrapper}>
        <ThemedView style={styles.modalCard}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>{title}</ThemedText>

          {/* Date & Time */}
          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={dateStr} onChangeText={setDateStr} />
            <TextInput style={styles.input} placeholder="Time (HH:MM)" value={timeStr} onChangeText={setTimeStr} />
          </View>

          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Session name" value={name} onChangeText={setName} autoFocus />
          </View>
          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Game (Texas Holdem/Omaha/Blackjack)" value={game} onChangeText={(t) => setGame((t as GameType) || 'Texas Holdem')} />
          </View>
          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Starting stake" keyboardType="numeric" value={starting} onChangeText={setStarting} />
            <TextInput style={styles.input} placeholder="Exit amount" keyboardType="numeric" value={exit} onChangeText={setExit} />
          </View>
          <View style={styles.formRow}>
            <TextInput style={styles.input} placeholder="Hands played (optional)" keyboardType="numeric" value={hands} onChangeText={setHands} />
          </View>
          <View style={[styles.formRow, { justifyContent: 'space-between' }]}> 
            <ThemedText>Real money?</ThemedText>
            <Switch value={isReal} onValueChange={setIsReal} />
          </View>
          <View style={styles.formRow}>
            <TextInput style={[styles.input, { height: 64 }]} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onRequestClose} style={[styles.modalBtn, { backgroundColor: '#6b7280' }]}>
              <ThemedText style={styles.modalBtnText}>Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={onSubmit} disabled={!canSubmit} style={[styles.modalBtn, { backgroundColor: canSubmit ? '#3b82f6' : '#93c5fd' }]}>
              <ThemedText style={styles.modalBtnText}>{onSubmitLabel}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCardWrapper: { flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { borderRadius: 12, padding: 16 },
  modalActions: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  modalBtnText: { color: 'white', fontWeight: '600' },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});

export default SessionModal;
