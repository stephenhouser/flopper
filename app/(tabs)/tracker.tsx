import { ThemedText } from '@/components/ThemedText';
import { ExportMenu } from '@/components/tracker/ExportMenu';
import { SessionModal } from '@/components/tracker/SessionModal';
import { TrackerItem } from '@/components/tracker/TrackerItem';
import { useTracker } from '@/hooks/useTracker';
import { listAllAttachments, listTrackedSessions } from '@/lib/db';
import { downloadTextFile } from '@/lib/utils/download';
import type { GameType, TrackedSession } from '@/models/tracker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Type for attachments from DB
type AttachmentRow = { id: string; trackedSessionId: string; type: string; mime: string; content: string; createdAt: number };

function currency(n: number) { return `$${n}`; }

// Helpers to format/parse local date & time strings
function fmtDate(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0'); const mi = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${mi}`;
}
function parseDateTime(dateStr: string, timeStr: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  const tm = /^(\d{2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!dm || !tm) return null;
  const y = parseInt(dm[1], 10); const mo = parseInt(dm[2], 10) - 1; const da = parseInt(dm[3], 10);
  const h = parseInt(tm[1], 10); const mi = parseInt(tm[2], 10);
  const d = new Date(y, mo, da, h, mi);
  const ts = d.getTime();
  return Number.isNaN(ts) ? null : ts;
}

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
  // New: date/time for Add
  const [dateStr, setDateStr] = useState<string>(() => fmtDate(Date.now()));
  const [timeStr, setTimeStr] = useState<string>(() => fmtTime(Date.now()));

  // Ensure we refresh whenever this tab/screen gains focus
  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  // New: export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [editing, setEditing] = useState<TrackedSession | null>(null);
  const [editName, setEditName] = useState('');
  const [editGame, setEditGame] = useState<GameType>('Texas Holdem');
  const [editStarting, setEditStarting] = useState('');
  const [editExit, setEditExit] = useState('');
  const [editHands, setEditHands] = useState('');
  const [editIsReal, setEditIsReal] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  // New: date/time for Edit
  const [editDateStr, setEditDateStr] = useState('');
  const [editTimeStr, setEditTimeStr] = useState('');

  const canAdd = useMemo(() => name.trim().length > 0 && starting !== '' && exit !== '', [name, starting, exit]);
  const canSaveEdit = useMemo(() => editName.trim().length > 0 && editStarting !== '' && editExit !== '' && !!editing, [editName, editStarting, editExit, editing]);

  const onAdd = () => {
    if (!canAdd) return;
    const date = parseDateTime(dateStr, timeStr) ?? Date.now();
    add({ name: name.trim(), game, startingStake: Number(starting) || 0, exitAmount: Number(exit) || 0, notes: notes.trim() || undefined, handsPlayed: hands ? Number(hands) : undefined, isRealMoney: isReal, date });
    setName(''); setStarting(''); setExit(''); setHands(''); setIsReal(false); setNotes('');
    // reset date/time to now after adding
    setDateStr(fmtDate(Date.now())); setTimeStr(fmtTime(Date.now()));
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
    // Seed date/time from the item's current date
    setEditDateStr(fmtDate(item.date));
    setEditTimeStr(fmtTime(item.date));
    setShowEditModal(true);
  };

  const onSaveEdit = async () => {
    if (!editing || !canSaveEdit) return;
    const newTs = parseDateTime(editDateStr, editTimeStr) ?? editing.date;
    await update(editing.id, {
      name: editName.trim(),
      game: editGame,
      startingStake: Number(editStarting) || 0,
      exitAmount: Number(editExit) || 0,
      notes: editNotes.trim() || undefined,
      handsPlayed: editHands ? Number(editHands) : undefined,
      isRealMoney: editIsReal,
      date: newTs,
    });
    setShowEditModal(false);
    setEditing(null);
  };

  const onExportCSV = async () => {
    const rows = sessions.length ? sessions : (await listTrackedSessions()) as unknown as TrackedSession[];
    const csv = sessionsToCSV(rows);
    downloadTextFile('flopper_sessions.csv', csv);
  };

  const onExportAllJSON = async () => {
    const [sessionsRows, attachmentsRows] = [
      sessions.length ? sessions : (await listTrackedSessions()) as unknown as TrackedSession[],
      await listAllAttachments() as unknown as AttachmentRow[],
    ];
    const payload = {
      exportedAt: Date.now(),
      sessions: sessionsRows,
      attachments: attachmentsRows,
    };
    downloadTextFile('flopper_export.json', JSON.stringify(payload, null, 2));
  };

  const openExportMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Export sessions CSV', 'Export all JSON'],
          cancelButtonIndex: 0,
          userInterfaceStyle: 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) onExportCSV();
          if (buttonIndex === 2) onExportAllJSON();
        }
      );
    } else {
      setShowExportMenu(true);
    }
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export"
              onPress={openExportMenu}
              style={({ pressed }) => [styles.gearBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="download-outline" size={18} color="#2b2e57" />
            </Pressable>
          </View>
        </View>

        {/* Sessions list */}
        {sessions.length === 0 && loaded ? (
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', marginTop: 12 }}>No sessions yet.</ThemedText>
        ) : (
          <View style={{ gap: 10 }}>
            {sessions.map((item) => (
              <TrackerItem key={item.id} item={item} onRemove={remove} onEdit={onStartEdit} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable onPress={() => setShowAddModal(true)} accessibilityRole="button" accessibilityLabel="Add session" style={styles.fab}>
        <ThemedText style={styles.fabText}>＋</ThemedText>
      </Pressable>

      {/* Export menu (Android/Web) */}
      <ExportMenu visible={showExportMenu} onRequestClose={() => setShowExportMenu(false)} onExportSessions={onExportCSV} onExportAllJson={onExportAllJSON} />

      {/* Add Session Modal */}
      <SessionModal
        title="Add Session"
        visible={showAddModal}
        onRequestClose={() => setShowAddModal(false)}
        onSubmitLabel="Add"
        onSubmit={onAdd}
        canSubmit={canAdd}
        name={name} setName={setName}
        game={game} setGame={setGame}
        starting={starting} setStarting={setStarting}
        exit={exit} setExit={setExit}
        hands={hands} setHands={setHands}
        isReal={isReal} setIsReal={setIsReal}
        notes={notes} setNotes={setNotes}
        dateStr={dateStr} setDateStr={setDateStr}
        timeStr={timeStr} setTimeStr={setTimeStr}
      />

      {/* Edit Session Modal */}
      <SessionModal
        title="Edit Session"
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
        onSubmitLabel="Save"
        onSubmit={onSaveEdit}
        canSubmit={canSaveEdit}
        name={editName} setName={setEditName}
        game={editGame} setGame={setEditGame}
        starting={editStarting} setStarting={setEditStarting}
        exit={editExit} setExit={setEditExit}
        hands={editHands} setHands={setEditHands}
        isReal={editIsReal} setIsReal={setEditIsReal}
        notes={editNotes} setNotes={setEditNotes}
        dateStr={editDateStr} setDateStr={setEditDateStr}
        timeStr={editTimeStr} setTimeStr={setEditTimeStr}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#000' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerStats: { fontSize: 13, flexShrink: 1, textAlign: 'right', color: '#666' },
  gearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eef1ff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
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
});
