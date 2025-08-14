import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTracker } from '@/hooks/useTracker';
import { listAllAttachments, listAttachmentsFor, listTrackedSessions } from '@/lib/db';
import { downloadTextFile } from '@/lib/utils/download';
import type { GameType, TrackedSession } from '@/models/tracker';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

// Type for attachments from DB
type AttachmentRow = { id: string; trackedSessionId: string; type: string; mime: string; content: string; createdAt: number };

function currency(n: number) { return `$${n}`; }

function sessionsToCSV(rows: TrackedSession[]) {
  const header = ['id','date','name','game','startingStake','exitAmount','notes','sessionId'];
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
      r.sessionId ? r.sessionId : ''
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
    lines.push(vals.map(v => /[,\n\"]/.test(v) ? JSON.stringify(v) : v).join(','));
  }
  return lines.join('\n');
}

export default function TrackerTab() {
  const { sessions, add, remove, totals, loaded, refresh } = useTracker();

  const [name, setName] = useState('');
  const [game, setGame] = useState<GameType>('Texas Holdem');
  const [starting, setStarting] = useState('');
  const [exit, setExit] = useState('');
  const [notes, setNotes] = useState('');

  const canAdd = useMemo(() => name.trim().length > 0 && starting !== '' && exit !== '', [name, starting, exit]);

  const onAdd = () => {
    if (!canAdd) return;
    add({ name: name.trim(), game, startingStake: Number(starting) || 0, exitAmount: Number(exit) || 0, notes: notes.trim() || undefined });
    setName(''); setStarting(''); setExit(''); setNotes('');
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
        headerImage={
          <IconSymbol
            size={310}
            color="#808080"
            name="chart.line.uptrend.xyaxis"
            style={styles.headerImage}
          />
        }>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Tracker</ThemedText>
        </ThemedView>

        <ThemedText style={{ marginBottom: 8 }}>Log your game sessions.</ThemedText>

        <ThemedView style={styles.formRow}>
          <TextInput style={styles.input} placeholder="Session name" value={name} onChangeText={setName} />
        </ThemedView>
        <ThemedView style={styles.formRow}>
          <TextInput style={styles.input} placeholder="Game (Texas Holdem/Omaha/Blackjack)" value={game} onChangeText={(t) => setGame((t as GameType) || 'Texas Holdem')} />
        </ThemedView>
        <ThemedView style={styles.formRow}>
          <TextInput style={styles.input} placeholder="Starting stake" keyboardType="numeric" value={starting} onChangeText={setStarting} />
          <TextInput style={styles.input} placeholder="Exit amount" keyboardType="numeric" value={exit} onChangeText={setExit} />
        </ThemedView>
        <ThemedView style={styles.formRow}>
          <TextInput style={[styles.input, { height: 64 }]} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
        </ThemedView>
        <Pressable onPress={onAdd} disabled={!canAdd} style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}>
          <ThemedText style={{ color: 'white', fontWeight: '600' }}>Add session</ThemedText>
        </Pressable>

        <ThemedView style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ThemedText style={{ opacity: 0.8, fontSize: 13 }}>Total sessions: {totals.count} • Net: {currency(totals.net)}</ThemedText>
          <Pressable onPress={onExportCSV} style={[styles.addBtn, { backgroundColor: '#10b981' }]}>
            <ThemedText style={{ color: 'white', fontWeight: '600' }}>Export CSV</ThemedText>
          </Pressable>
          <Pressable onPress={onExportAttachmentsCSV} style={[styles.addBtn, { backgroundColor: '#059669' }]}>
            <ThemedText style={{ color: 'white', fontWeight: '600' }}>Export Attachments CSV</ThemedText>
          </Pressable>
        </ThemedView>

        <FlatList
          style={{ marginTop: 8 }}
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TrackerItem item={item} onRemove={remove} onRefresh={refresh} />}
          ListEmptyComponent={loaded ? <ThemedText style={{ opacity: 0.7 }}>No sessions yet.</ThemedText> : null}
        />
      </ParallaxScrollView>
    </KeyboardAvoidingView>
  );
}

function TrackerItem({ item, onRemove, onRefresh }: { item: TrackedSession, onRemove: (id: string) => void, onRefresh: () => void }) {
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
        <ThemedText style={{ marginTop: 4 }}>Start {currency(item.startingStake)} • Exit {currency(item.exitAmount)} • Net {currency(net)}</ThemedText>
        {item.notes ? <ThemedText style={{ marginTop: 4, opacity: 0.9 }}>{item.notes}</ThemedText> : null}
      </View>
      <View style={{ gap: 6 }}>
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
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addBtn: {
    marginTop: 4,
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#777',
  },
  removeBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
