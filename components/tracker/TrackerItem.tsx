import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { listAttachmentsFor } from '@/lib/db';
import { downloadTextFile } from '@/lib/utils/download';
import type { TrackedSession } from '@/models/tracker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

// Keep local copy of styles that are item-specific to decouple from the screen styles
const styles = StyleSheet.create({
  item: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexGrow: 1 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  actionBtnPrimary: { backgroundColor: '#3b82f6' },
  actionBtnDanger: { backgroundColor: '#ef4444' },
  actionBtnSecondary: { backgroundColor: '#6366f1' },
  actionBtnDisabled: { backgroundColor: '#e5e7eb', opacity: 0.7 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 0, borderWidth: StyleSheet.hairlineWidth, height: 24, justifyContent: 'center', alignSelf: 'center' },
  tagText: { fontSize: 12, fontWeight: '600' },
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
  const canExport = attachmentCount > 0;

  return (
    <ThemedView style={styles.item}>
      {/* Header: title + tag on the left, icon actions on the right */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={{ flexShrink: 1 }} numberOfLines={1}>{item.name}</ThemedText>
          <View style={[styles.tag, item.isRealMoney ? styles.tagReal : styles.tagPlay]}>
            <ThemedText style={[styles.tagText, item.isRealMoney ? styles.tagTextReal : styles.tagTextPlay]}>{item.isRealMoney ? 'Real Money' : 'Play Money'}</ThemedText>
          </View>
        </View>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => onEdit(item)}
            accessibilityRole="button"
            accessibilityLabel="Edit session"
            style={[styles.actionBtn, styles.actionBtnPrimary]}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => onRemove(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Delete session"
            style={[styles.actionBtn, styles.actionBtnDanger]}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
          </Pressable>
          <Pressable
            onPress={onExportAttachments}
            disabled={!canExport}
            accessibilityRole="button"
            accessibilityLabel="Export hand history"
            style={[styles.actionBtn, styles.actionBtnSecondary, !canExport && styles.actionBtnDisabled]}
          >
            <Ionicons name="download-outline" size={16} color={canExport ? '#fff' : '#9ca3af'} />
          </Pressable>
        </View>
      </View>

      {/* Subtitle */}
      <ThemedText style={{ opacity: 0.8, fontSize: 12 }}>{subtitle}</ThemedText>

      {/* Details Row */}
      <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <ThemedText>Start {currency(item.startingStake)} • Exit {currency(item.exitAmount)} • Net {currency(net)}</ThemedText>
        {typeof item.handsPlayed === 'number' ? <ThemedText style={{ opacity: 0.8 }}> • Hands {item.handsPlayed}</ThemedText> : null}
        {attachmentCount > 0 ? <ThemedText style={{ opacity: 0.8 }}> • Attachments {attachmentCount}</ThemedText> : null}
      </View>

      {/* Notes */}
      {item.notes ? <ThemedText style={{ marginTop: 6, opacity: 0.9 }}>{item.notes}</ThemedText> : null}
    </ThemedView>
  );
}

export default TrackerItem;
