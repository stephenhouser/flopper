// Lightweight SQLite wrapper with graceful fallback to AsyncStorage on web.
import { emit, TrackerEvents } from '@/lib/events';
import Storage from '@/lib/storage';

export type Row = Record<string, any>;

let sqlite: any = null;
try { sqlite = require('expo-sqlite'); } catch {}

const DB_NAME = 'flopper.db';

class SQLiteDB {
  db: any;
  ready = false;

  constructor() {
    if (!sqlite) return;
    // Prefer sync API if available
    const open = sqlite.openDatabaseSync || sqlite.openDatabase;
    this.db = open ? open(DB_NAME) : null;
    if (this.db) {
      this.migrate();
      this.ready = true;
    }
  }

  migrate() {
    if (!this.db) return;
    this.exec(`CREATE TABLE IF NOT EXISTS tracked_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      date INTEGER NOT NULL,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      startingStake REAL NOT NULL DEFAULT 0,
      exitAmount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      sessionId TEXT,
      handsPlayed INTEGER,
      isRealMoney INTEGER,
      attachmentIds TEXT
    );`);
    this.exec(`CREATE TABLE IF NOT EXISTS session_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      trackedSessionId TEXT NOT NULL,
      type TEXT NOT NULL,
      mime TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(trackedSessionId) REFERENCES tracked_sessions(id) ON DELETE CASCADE
    );`);
    // Migration for existing installs: add columns if missing
    this.exec(`ALTER TABLE tracked_sessions ADD COLUMN handsPlayed INTEGER;`).catch(() => {});
    this.exec(`ALTER TABLE tracked_sessions ADD COLUMN isRealMoney INTEGER;`).catch(() => {});
    this.exec(`ALTER TABLE tracked_sessions ADD COLUMN attachmentIds TEXT;`).catch(() => {});
  }

  exec(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.transaction((tx: any) => {
        tx.executeSql(sql, params, () => resolve(), (_: any, err: any) => { reject(err); return false; });
      });
    });
  }

  all<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([] as T[]);
      this.db.readTransaction((tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, rs: any) => {
            const out: T[] = [] as any;
            const len = rs.rows.length;
            for (let i = 0; i < len; i++) out.push(rs.rows.item(i));
            // Normalize attachmentIds from TEXT JSON -> array
            if (sql.includes('FROM tracked_sessions')) {
              (out as any).forEach((r: any) => {
                if (typeof r.attachmentIds === 'string') {
                  try { r.attachmentIds = JSON.parse(r.attachmentIds); } catch { r.attachmentIds = []; }
                }
              });
            }
            resolve(out);
          },
          (_: any, err: any) => { reject(err); return false; }
        );
      });
    });
  }

  get<T = Row>(sql: string, params: any[] = []): Promise<T | null> {
    return this.all<T>(sql, params).then((rows) => rows[0] ?? null);
  }
}

// Fallback for web: store arrays in AsyncStorage
class FallbackDB {
  keySessions = 'db.tracked_sessions';
  keyAttachments = 'db.session_attachments';

  async ensureInit() {
    const a = await Storage.getItem(this.keySessions);
    if (!a) await Storage.setItem(this.keySessions, '[]');
    const b = await Storage.getItem(this.keyAttachments);
    if (!b) await Storage.setItem(this.keyAttachments, '[]');
  }

  async exec(sql: string, _params: any[] = []) { await this.ensureInit(); }
  async all<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureInit();
    if (sql.includes('FROM tracked_sessions')) {
      const raw = await Storage.getItem(this.keySessions); const arr = JSON.parse(raw || '[]');
      let out = arr;
      if (sql.includes('WHERE sessionId = ?')) {
        const sid = params[0];
        out = (out as any[]).filter(r => r.sessionId === sid);
      }
      if (sql.includes('ORDER BY')) out.sort((a: any, b: any) => b.date - a.date);
      return out as T[];
    }
    if (sql.includes('FROM session_attachments')) {
      const raw = await Storage.getItem(this.keyAttachments); const arr = JSON.parse(raw || '[]');
      if (sql.includes('WHERE trackedSessionId = ?')) {
        const id = params[0];
        return (arr as any[]).filter(r => r.trackedSessionId === id) as T[];
      }
      return arr as T[];
    }
    return [] as T[];
  }
  async get<T = Row>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params); return rows[0] ?? null;
  }

  // Helpers for mutations in fallback
  async insertSession(row: Row) {
    await this.ensureInit();
    const raw = await Storage.getItem(this.keySessions); const arr = JSON.parse(raw || '[]');
    arr.push(row); await Storage.setItem(this.keySessions, JSON.stringify(arr));
    emit(TrackerEvents.SessionsChanged);
  }
  async updateSession(id: string, patch: Row) {
    await this.ensureInit();
    const raw = await Storage.getItem(this.keySessions); const arr = JSON.parse(raw || '[]');
    const next = arr.map((r: any) => r.id === id ? { ...r, ...patch } : r);
    await Storage.setItem(this.keySessions, JSON.stringify(next));
    emit(TrackerEvents.SessionsChanged);
  }
  async deleteSession(id: string) {
    await this.ensureInit();
    const raw = await Storage.getItem(this.keySessions); const arr = JSON.parse(raw || '[]');
    const next = arr.filter((r: any) => r.id !== id);
    await Storage.setItem(this.keySessions, JSON.stringify(next));
    const rawA = await Storage.getItem(this.keyAttachments); const arrA = JSON.parse(rawA || '[]');
    const nextA = arrA.filter((r: any) => r.trackedSessionId !== id);
    await Storage.setItem(this.keyAttachments, JSON.stringify(nextA));
    emit(TrackerEvents.SessionsChanged);
    emit(TrackerEvents.AttachmentsChanged);
  }
  async upsertAttachment(row: Row) {
    await this.ensureInit();
    const raw = await Storage.getItem(this.keyAttachments); const arr = JSON.parse(raw || '[]');
    const idx = arr.findIndex((r: any) => r.id === row.id);
    if (idx >= 0) arr[idx] = row; else arr.push(row);
    await Storage.setItem(this.keyAttachments, JSON.stringify(arr));
    emit(TrackerEvents.AttachmentsChanged);
  }
  async deleteAttachmentsFor(trackedSessionId: string) {
    await this.ensureInit();
    const rawA = await Storage.getItem(this.keyAttachments); const arrA = JSON.parse(rawA || '[]');
    const nextA = arrA.filter((r: any) => r.trackedSessionId !== trackedSessionId);
    await Storage.setItem(this.keyAttachments, JSON.stringify(nextA));
    emit(TrackerEvents.AttachmentsChanged);
  }
}

export const DB: any = sqlite ? new SQLiteDB() : new FallbackDB();

export async function insertTrackedSession(row: Row) {
  if (DB instanceof SQLiteDB) {
    await DB.exec(
      `INSERT INTO tracked_sessions (id, date, name, game, startingStake, exitAmount, notes, sessionId, handsPlayed, isRealMoney, attachmentIds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [row.id, row.date, row.name, row.game, row.startingStake ?? 0, row.exitAmount ?? 0, row.notes ?? null, row.sessionId ?? null, row.handsPlayed ?? null, row.isRealMoney != null ? (row.isRealMoney ? 1 : 0) : null, row.attachmentIds ? JSON.stringify(row.attachmentIds) : null]
    );
    emit(TrackerEvents.SessionsChanged);
  } else {
    await DB.insertSession(row);
  }
}

export async function updateTrackedSession(id: string, patch: Row) {
  if (DB instanceof SQLiteDB) {
    const cols: string[] = []; const vals: any[] = [];
    for (const k of Object.keys(patch)) {
      cols.push(`${k} = ?`);
      const v = (patch as any)[k];
      if (k === 'isRealMoney' && v != null) {
        vals.push(v ? 1 : 0);
      } else if (k === 'attachmentIds' && Array.isArray(v)) {
        vals.push(JSON.stringify(v));
      } else {
        vals.push(v);
      }
    }
    if (!cols.length) return;
    await DB.exec(`UPDATE tracked_sessions SET ${cols.join(', ')} WHERE id = ?;`, [...vals, id]);
    emit(TrackerEvents.SessionsChanged);
  } else {
    await DB.updateSession(id, patch);
  }
}

export async function deleteTrackedSession(id: string) {
  if (DB instanceof SQLiteDB) {
    await DB.exec(`DELETE FROM tracked_sessions WHERE id = ?;`, [id]);
    emit(TrackerEvents.SessionsChanged);
  } else {
    await DB.deleteSession(id);
  }
}

export async function listTrackedSessions() {
  return DB.all(`SELECT * FROM tracked_sessions ORDER BY date DESC;`);
}

export async function getTrackedSessionBySessionId(sessionId: string) {
  return DB.get(`SELECT * FROM tracked_sessions WHERE sessionId = ? LIMIT 1;`, [sessionId]);
}

export async function upsertAttachment(row: Row) {
  if (DB instanceof SQLiteDB) {
    await DB.exec(
      `INSERT OR REPLACE INTO session_attachments (id, trackedSessionId, type, mime, content, createdAt) VALUES (?, ?, ?, ?, ?, ?);`,
      [row.id, row.trackedSessionId, row.type, row.mime, row.content, row.createdAt]
    );
    emit(TrackerEvents.AttachmentsChanged);
  } else {
    await DB.upsertAttachment(row);
  }
}

export async function listAttachmentsFor(trackedSessionId: string) {
  return DB.all(`SELECT * FROM session_attachments WHERE trackedSessionId = ? ORDER BY createdAt DESC;`, [trackedSessionId]);
}

export async function listAllAttachments() {
  return DB.all(`SELECT * FROM session_attachments ORDER BY createdAt DESC;`);
}

export async function deleteAttachmentsFor(trackedSessionId: string) {
  if (DB instanceof SQLiteDB) {
    await DB.exec(`DELETE FROM session_attachments WHERE trackedSessionId = ?;`, [trackedSessionId]);
    emit(TrackerEvents.AttachmentsChanged);
  } else {
    await DB.deleteAttachmentsFor(trackedSessionId);
  }
}
