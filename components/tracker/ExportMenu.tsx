import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

export function ExportMenu({ visible, onRequestClose, onExportSessions, onExportAllJson }: {
  visible: boolean;
  onRequestClose: () => void;
  onExportSessions: () => void;
  onExportAllJson: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.modalOverlay} onPress={onRequestClose} />
      <View pointerEvents="box-none" style={{ flex: 1 }}>
        <ThemedView style={styles.menuCard}>
          <Pressable onPress={() => { onRequestClose(); onExportSessions(); }} style={styles.menuItem}>
            <Ionicons name="document-text-outline" size={18} color="#111827" />
            <ThemedText>Export sessions CSV</ThemedText>
          </Pressable>
          <Pressable onPress={() => { onRequestClose(); onExportAllJson(); }} style={styles.menuItem}>
            <Ionicons name="save-outline" size={18} color="#111827" />
            <ThemedText>Export all JSON</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
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
  menuCard: {
    position: 'absolute',
    top: 88,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    minWidth: 220,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

export default ExportMenu;
