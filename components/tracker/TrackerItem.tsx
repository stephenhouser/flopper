import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { listAttachmentsFor } from '@/lib/db';
import { downloadTextFile } from '@/lib/utils/download';
import type { TrackedSession } from '@/models/tracker';
import { Pressable, StyleSheet, View } from 'react-native';

// Keep local copy of styles that are item-specific to decouple from the screen styles
const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth },
  tagText: { fontSize: 11, fontWeight: '600' },
  tagReal: { backgroundColor: '#ecfeff', borderColor: '#06b6d4' },
  tagPlay: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  tagTextReal: { color: '#0891b2' },
  tagTextPlay: { color: '#166534' },
  removeBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});

export type AttachmentRow = { id: string; trackedSessionId: string; type: string; mime: string; content: string; createdAt: number };

function currency(n: number) { return `$${n}`; }

export function TrackerItem({ item, onRemove, onEdit }: { item: TrackedSession, onRemove: (id: string) => void, onEdit: (item: TrackedSession) => void }) {
  const net = item.exitAmount - item.startingStake;
  const date = new Date(item.date);
  const subtitle = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} • ${item.game}`;

  const onExportAttachments = async () => {
    const atts = await listAttachmentsFor(item.id) as unknown as AttachmentRow[];
    const pokerstars = atts.find((a: AttachmentRow) => a.type === 'pokerstars');
    if (pokerstars) {
      downloadTextFile(`${item.name.replace(/\s+/g, '_')}_pokerstars.txt`, pokerstars.content);
    } else {
      if (item.sessionId) {
        alert('Attachment not ready yet. Please try again after a hand is played.');
      } else {
        alert('No PokerStars attachment available for this session.');
      }
    }
  };

  const attachmentCount = Array.isArray(item.attachmentIds) ? item.attachmentIds.length : 0;

  return (
    <ThemedView style={styles.item}>
      <View style={{ flex: 1 }}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <ThemedText style={{ opacity: 0.8, fontSize: 12 }}>{subtitle}</ThemedText>
        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <ThemedText>Start {currency(item.startingStake)} • Exit {currency(item.exitAmount)} • Net {currency(net)}</ThemedText>
          {typeof item.handsPlayed === 'number' ? <ThemedText style={{ opacity: 0.8 }}> • Hands {item.handsPlayed}</ThemedText> : null}
          {attachmentCount > 0 ? <ThemedText style={{ opacity: 0.8 }}> • Attachments {attachmentCount}</ThemedText> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <View style={[styles.tag, item.isRealMoney ? styles.tagReal : styles.tagPlay]}>
            <ThemedText style={[styles.tagText, item.isRealMoney ? styles.tagTextReal : styles.tagTextPlay]}>{item.isRealMoney ? 'Real Money' : 'Play Money'}</ThemedText>
          </View>
        </View>
        {item.notes ? <ThemedText style={{ marginTop: 6, opacity: 0.9 }}>{item.notes}</ThemedText> : null}
      </View>
      <View style={{ gap: 6 }}>
        <Pressable onPress={() => onEdit(item)} style={[styles.removeBtn, { backgroundColor: '#3b82f6' }]} >
          <ThemedText style={{ color: 'white', fontWeight: '600' }}>Edit</ThemedText>
        </Pressable>
        <Pressable onPress={() => onRemove(item.id)} style={styles.removeBtn}>
          <ThemedText style={{ color: 'white', fontWeight: '600' }}>Delete</ThemedText>
        </Pressable>
        <Pressable onPress={onExportAttachments} style={[styles.removeBtn, { backgroundColor: '#6366f1' }]}> 
          <ThemedText style={{ color: 'white', fontWeight: '600' }}>Export HH</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default TrackerItem;
