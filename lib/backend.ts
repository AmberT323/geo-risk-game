'use client';
// 後端抽象層：有 Firebase 設定時使用 Firestore＋Anonymous Auth；
// 沒有設定時自動改用「本機示範模式」（同一瀏覽器多分頁，以 BroadcastChannel 同步）。
import type { Decisions, Phase } from './game';

export interface QuizState { idx: number; open: boolean; reveal: boolean }

export interface RoomDoc {
  code: string;
  hostUid: string;
  phase: Phase;
  month: number; // 第四幕目前月份 1-3
  reveal: boolean; // 是否公布匿名統計
  paused: boolean; // 暫停討論
  bankRun: boolean | null; // 第三幕開始時由主持人依第二幕結果寫入
  world: number | null; // 第五幕世界情境
  quiz: QuizState | null;
  createdAt: number;
}

export interface PlayerDoc {
  uid: string;
  name: string;
  roleId: string | null;
  joinedAt: number;
  d: Decisions;
  done: Record<string, boolean>;
  quiz: Record<string, 'Y' | 'N'>;
}

export type Unsub = () => void;
// 只有扁平的頂層欄位會被取代；d / done / quiz 為深層合併
export type PlayerPatch = Partial<Omit<PlayerDoc, 'd' | 'done' | 'quiz'>> & {
  d?: Partial<Decisions>; done?: Record<string, boolean>; quiz?: Record<string, 'Y' | 'N'>;
};

export interface Backend {
  mode: 'firebase' | 'local';
  uid(): Promise<string>;
  createRoom(): Promise<string>;
  roomExists(code: string): Promise<boolean>;
  watchRoom(code: string, cb: (r: RoomDoc | null) => void): Unsub;
  updateRoom(code: string, patch: Partial<RoomDoc>): Promise<void>;
  join(code: string, name: string): Promise<void>;
  watchPlayer(code: string, uid: string, cb: (p: PlayerDoc | null) => void): Unsub;
  watchPlayers(code: string, cb: (ps: PlayerDoc[]) => void): Unsub;
  updatePlayer(code: string, uid: string, patch: PlayerPatch): Promise<void>;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const newRoom = (code: string, hostUid: string): RoomDoc => ({
  code, hostUid, phase: 'lobby', month: 1, reveal: false, paused: false, bankRun: null, world: null, quiz: null,
  createdAt: Date.now(),
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function deepMerge<T>(a: T, b: unknown): T {
  if (!isObj(a) || !isObj(b)) return b as T;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  return out as T;
}

// ─── 本機示範模式 ─────────────────────────────────────
interface LocalStore { room: RoomDoc; players: Record<string, PlayerDoc> }

function localBackend(): Backend {
  const key = (code: string) => `rg-room-${code}`;
  const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rg-sync') : null;
  const listeners = new Set<(code: string) => void>();
  const notify = (code: string) => { listeners.forEach((l) => l(code)); ch?.postMessage(code); };
  ch?.addEventListener('message', (e) => listeners.forEach((l) => l(e.data)));
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key?.startsWith('rg-room-')) listeners.forEach((l) => l(e.key!.slice(8))); });
  }
  const read = (code: string): LocalStore | null => {
    try { const s = localStorage.getItem(key(code)); return s ? JSON.parse(s) : null; } catch { return null; }
  };
  const write = (code: string, st: LocalStore) => { localStorage.setItem(key(code), JSON.stringify(st)); notify(code); };
  const sub = (code: string, fn: () => void): Unsub => {
    const l = (c: string) => { if (c === code) fn(); };
    listeners.add(l); fn();
    return () => listeners.delete(l);
  };
  const myUid = () => {
    let u = sessionStorage.getItem('rg-uid');
    if (!u) { u = 'local-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('rg-uid', u); }
    return u;
  };
  return {
    mode: 'local',
    uid: async () => myUid(),
    async createRoom() {
      let code = newCode();
      while (read(code)) code = newCode();
      write(code, { room: newRoom(code, myUid()), players: {} });
      return code;
    },
    roomExists: async (code) => !!read(code),
    watchRoom: (code, cb) => sub(code, () => cb(read(code)?.room ?? null)),
    async updateRoom(code, patch) {
      const st = read(code); if (!st) return;
      st.room = { ...st.room, ...patch }; write(code, st);
    },
    async join(code, name) {
      const st = read(code); if (!st) throw new Error('找不到房間');
      const uid = myUid();
      const prev = st.players[uid];
      st.players[uid] = prev ? { ...prev, name } : { uid, name, roleId: null, joinedAt: Date.now(), d: {}, done: {}, quiz: {} };
      write(code, st);
    },
    watchPlayer: (code, uid, cb) => sub(code, () => cb(read(code)?.players[uid] ?? null)),
    watchPlayers: (code, cb) => sub(code, () => cb(Object.values(read(code)?.players ?? {}).sort((a, b) => a.joinedAt - b.joinedAt))),
    async updatePlayer(code, uid, patch) {
      const st = read(code); if (!st || !st.players[uid]) return;
      st.players[uid] = deepMerge(st.players[uid], patch); write(code, st);
    },
  };
}

// ─── Firebase 模式 ───────────────────────────────────
const fbConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = !!(fbConfig.apiKey && fbConfig.projectId);

function firebaseBackend(): Backend {
  // 延遲載入，讓示範模式不必下載 Firebase SDK
  const ready = (async () => {
    const [{ initializeApp, getApps }, auth, fs] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
    ]);
    const app = getApps()[0] ?? initializeApp(fbConfig);
    const a = auth.getAuth(app);
    const user = a.currentUser ?? (await auth.signInAnonymously(a)).user;
    return { db: fs.getFirestore(app), fs, uid: user.uid };
  })();

  const pending = new Set<Unsub>();
  const lazySub = (start: (r: Awaited<typeof ready>) => Unsub): Unsub => {
    let un: Unsub | null = null; let cancelled = false;
    ready.then((r) => { if (!cancelled) un = start(r); });
    const stop = () => { cancelled = true; un?.(); pending.delete(stop); };
    pending.add(stop);
    return stop;
  };

  return {
    mode: 'firebase',
    uid: async () => (await ready).uid,
    async createRoom() {
      const { db, fs, uid } = await ready;
      for (;;) {
        const code = newCode();
        const ref = fs.doc(db, 'rooms', code);
        if ((await fs.getDoc(ref)).exists()) continue;
        await fs.setDoc(ref, newRoom(code, uid));
        return code;
      }
    },
    async roomExists(code) {
      const { db, fs } = await ready;
      return (await fs.getDoc(fs.doc(db, 'rooms', code))).exists();
    },
    watchRoom: (code, cb) => lazySub(({ db, fs }) => fs.onSnapshot(fs.doc(db, 'rooms', code), (s) => cb(s.exists() ? (s.data() as RoomDoc) : null))),
    async updateRoom(code, patch) {
      const { db, fs } = await ready;
      await fs.updateDoc(fs.doc(db, 'rooms', code), patch as Record<string, never>);
    },
    async join(code, name) {
      const { db, fs, uid } = await ready;
      const ref = fs.doc(db, 'rooms', code, 'players', uid);
      const snap = await fs.getDoc(ref);
      if (snap.exists()) await fs.updateDoc(ref, { name });
      else await fs.setDoc(ref, { uid, name, roleId: null, joinedAt: Date.now(), d: {}, done: {}, quiz: {} } satisfies PlayerDoc);
    },
    watchPlayer: (code, uid, cb) => lazySub(({ db, fs }) => fs.onSnapshot(fs.doc(db, 'rooms', code, 'players', uid), (s) => cb(s.exists() ? (s.data() as PlayerDoc) : null))),
    watchPlayers: (code, cb) => lazySub(({ db, fs }) => fs.onSnapshot(fs.collection(db, 'rooms', code, 'players'), (q) => {
      cb(q.docs.map((x) => x.data() as PlayerDoc).sort((a, b) => a.joinedAt - b.joinedAt));
    })),
    async updatePlayer(code, uid, patch) {
      const { db, fs } = await ready;
      await fs.setDoc(fs.doc(db, 'rooms', code, 'players', uid), patch, { merge: true });
    },
  };
}

let instance: Backend | null = null;
export function getBackend(): Backend {
  if (!instance) instance = firebaseConfigured ? firebaseBackend() : localBackend();
  return instance;
}
