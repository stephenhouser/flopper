import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTracker } from '@/hooks/useTracker';
import { listAllAttachments, listAttachmentsFor, listTrackedSessions } from '@/lib/db';
import { downloadTextFile } from '@/lib/utils/download';
import type { GameType, TrackedSession } from '@/models/tracker';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

// Type for attachments from DB
type AttachmentRow = { id: string; trackedSessionId: string; type: string; mime: string; content: string; createdAt: number };

function currency(n: number) { return `$${n}`; }

function sessionsToCSV(rows: TrackedSession[]) {
  const header = ['id','date','name','game','startingStake','exitAmount','notes','sessionId','handsPlayed','isRealMoney'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const vals = [
      r.id,
      String(r.date),
      JSON.stringify(r.name),
      r.game,
      String(r.startingStake),
      String(r.exitAmount),
      JSON.stringify(r.notes ?? ''),
      r.sessionId ? r.sessionId : '',
      r.handsPlayed != null ? String(r.handsPlayed) : '',
      r.isRealMoney != null ? (r.isRealMoney ? '1' : '0') : '',
    ];
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function attachmentsToCSV(rows: AttachmentRow[]) {
  const header = ['id','trackedSessionId','type','mime','createdAt'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const vals = [r.id, r.trackedSessionId, r.type, r.mime, String(r.createdAt)];
    lines.push(vals.map(v => /[,\n\"]/ .test(v) ? JSON.stringify(v) : v).join(','));
  }
  return lines.join('\n');
}

export default function TrackerTab() {
  const { sessions, add, remove, update, totals, loaded, refresh } = useTracker();

  const [name, setName] = useState('');
  const [game, setGame] = useState<GameType>('Texas Holdem');
  const [starting, setStarting] = useState('');
  const [exit, setExit] = useState('');
  const [hands, setHands] = useState('');
  const [isReal, setIsReal] = useState(false);
  const [notes, setNotes] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState<TrackedSession | null>(null);
  const [editName, setEditName] = useState('');
  const [editGame, setEditGame] = useState<GameType>('Texas Holdem');
  const [editStarting, setEditStarting] = useState('');
  const [editExit, setEditExit] = useState('');
  const [editHands, setEditHands] = useState('');
  const [editIsReal, setEditIsReal] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  const canAdd = useMemo(() => name.trim().length > 0 && starting !== '' && exit !== '', [name, starting, exit]);
  const canSaveEdit = useMemo(() => editName.trim().length > 0 && editStarting !== '' && editExit !== '' && !!editing, [editName, editStarting, editExit, editing]);

  const onAdd = () => {
    if (!canAdd) return;
    add({ name: name.trim(), game, startingStake: Number(starting) || 0, exitAmount: Number(exit) || 0, notes: notes.trim() || undefined, handsPlayed: hands ? Number(hands) : undefined, isRealMoney: isReal });
    setName(''); setStarting(''); setExit(''); setHands(''); setIsReal(false); setNotes('');
    setShowAddModal(false);
  };

  const onStartEdit = (item: TrackedSession) => {
    setEditing(item);
    setEditName(item.name);
    setEditGame(item.game);
    setEditStarting(String(item.startingStake));
    setEditExit(String(item.exitAmount));
    setEditHands(item.handsPlayed != null ? String(item.handsPlayed) : '');
    setEditIsReal(item.isRealMoney === true);
    setEditNotes(item.notes ?? '');
    setShowEditModal(true);
  };

  const onSaveEdit = async () => {
    if (!editing || !canSaveEdit) return;
    await update(editing.id, {
      name: editName.trim(),
      game: editGame,
      startingStake: Number(editStarting) || 0,
      exitAmount: Number(editExit) || 0,
      notes: editNotes.trim() || undefined,
      handsPlayed: editHands ? Number(editHands) : undefined,
      isRealMoney: editIsReal,
    });
    setShowEditModal(false);
    setEditing(null);
  };

  const onExportCSV = async () => {
    const rows = sessions.length ? sessions : (await listTrackedSessions()) as unknown as TrackedSession[];
    const csv = sessionsToCSV(rows);
    downloadTextFile('flopper_sessions.csv', csv);
  };

  const onExportAttachmentsCSV = async () => {
    const rows = await listAllAttachments() as unknown as AttachmentRow[];
    const csv = attachmentsToCSV(rows);
    downloadTextFile('flopper_attachments.csv', csv);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        {/* Header styled like Texas Hold'em */}
        <View style={styles.header}>
          <Text style={styles.title}>Tracker</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerStats} numberOfLines={1}>
              Real Money: {totals.real.count} • Net: {currency(totals.real.net)} | Play Money: {totals.play.count} • Net: {currency(totals.play.net)}
            </Text>
          </View>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <Pressable onPress={onExportCSV} style={[styles.toolbarBtn, { backgroundColor: '#10b981' }]}>
            <ThemedText style={styles.toolbarBtnText}>Export CSV</ThemedText>
          </Pressable>
          <Pressable onPress={onExportAttachmentsCSV} style={[styles.toolbarBtn, { backgroundColor: '#059669' }]}>
            <ThemedText style={styles.toolbarBtnText}>Export Attachments</ThemedText>
          </Pressable>
        </View>

        {/* Sessions list */}
        {sessions.length === 0 && loaded ? (
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', marginTop: 12 }}>No sessions yet.</ThemedText>
        ) : (
          <View style={{ gap: 10 }}>
            {sessions.map((item) => (
              <TrackerItem key={item.id} item={item} onRemove={remove} onRefresh={refresh} onEdit={onStartEdit} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable onPress={() => setShowAddModal(true)} accessibilityRole="button" accessibilityLabel="Add session" style={styles.fab}>
        <ThemedText style={styles.fabText}>＋</ThemedText>
      </Pressable>

      {/* Add Session Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCardWrapper}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Add Session</ThemedText>

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
              <Pressable onPress={() => setShowAddModal(false)} style={[styles.modalBtn, { backgroundColor: '#6b7280' }]}>
                <ThemedText style={styles.modalBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={onAdd} disabled={!canAdd} style={[styles.modalBtn, { backgroundColor: canAdd ? '#3b82f6' : '#93c5fd' }]}>
                <ThemedText style={styles.modalBtnText}>Add</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Session Modal */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCardWrapper}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Edit Session</ThemedText>

            <View style={styles.formRow}>
              <TextInput style={styles.input} placeholder="Session name" value={editName} onChangeText={setEditName} autoFocus />
            </View>
            <View style={styles.formRow}>
              <TextInput style={styles.input} placeholder="Game (Texas Holdem/Omaha/Blackjack)" value={editGame} onChangeText={(t) => setEditGame((t as GameType) || 'Texas Holdem')} />
            </View>
            <View style={styles.formRow}>
              <TextInput style={styles.input} placeholder="Starting stake" keyboardType="numeric" value={editStarting} onChangeText={setEditStarting} />
              <TextInput style={styles.input} placeholder="Exit amount" keyboardType="numeric" value={editExit} onChangeText={setEditExit} />
            </View>
            <View style={styles.formRow}>
              <TextInput style={styles.input} placeholder="Hands played (optional)" keyboardType="numeric" value={editHands} onChangeText={setEditHands} />
            </View>
            <View style={[styles.formRow, { justifyContent: 'space-between' }]}>
              <ThemedText>Real money?</ThemedText>
              <Switch value={editIsReal} onValueChange={setEditIsReal} />
            </View>
            <View style={styles.formRow}>
              <TextInput style={[styles.input, { height: 64 }]} placeholder="Notes" value={editNotes} onChangeText={setEditNotes} multiline />
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowEditModal(false)} style={[styles.modalBtn, { backgroundColor: '#6b7280' }]}>
                <ThemedText style={styles.modalBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={onSaveEdit} disabled={!canSaveEdit} style={[styles.modalBtn, { backgroundColor: canSaveEdit ? '#3b82f6' : '#93c5fd' }]}>
                <ThemedText style={styles.modalBtnText}>Save</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function TrackerItem({ item, onRemove, onRefresh, onEdit }: { item: TrackedSession, onRemove: (id: string) => void, onRefresh: () => void, onEdit: (item: TrackedSession) => void }) {
  const net = item.exitAmount - item.startingStake;
  const date = new Date(item.date);
  const subtitle = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} • ${item.game}`;

  const onExportAttachments = async () => {
    const atts = await listAttachmentsFor(item.id) as unknown as AttachmentRow[];
    const pokerstars = atts.find((a: AttachmentRow) => a.type === 'pokerstars');
    if (pokerstars) {
      downloadTextFile(`${item.name.replace(/\s+/g, '_')}_pokerstars.txt`, pokerstars.content);
    } else {
      // fallback
      if (item.sessionId) {
        // Attachment should exist soon, allow user to refresh
        alert('Attachment not ready yet. Please try again after a hand is played.');
      } else {
        alert('No PokerStars attachment available for this session.');
      }
    }
  };

  return (
    <ThemedView style={styles.item}>
      <View style={{ flex: 1 }}>
        <ThemedText type="subtitle">{item.name}</ThemedText>
        <ThemedText style={{ opacity: 0.8, fontSize: 12 }}>{subtitle}</ThemedText>
        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <ThemedText>Start {currency(item.startingStake)} • Exit {currency(item.exitAmount)} • Net {currency(net)}</ThemedText>
          {typeof item.handsPlayed === 'number' ? <ThemedText style={{ opacity: 0.8 }}> • Hands {item.handsPlayed}</ThemedText> : null}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#000' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerStats: { fontSize: 13, flexShrink: 1, textAlign: 'right', color: '#666' },
  toolbar: { flexDirection: 'row', gap: 8 },
  toolbarBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  toolbarBtnText: { color: 'white', fontWeight: '600' },
  // Removed old list/header styles; using ScrollView layout now
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: 'white', fontSize: 28, lineHeight: 30, marginTop: -2 },
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
});
