'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { getBackend, type PlayerDoc, type RoomDoc } from '@/lib/backend';
import {
  ACT2_EVENTS, ACT2_KEYS, ACT2_OPTIONS, ACT4_EVENTS, ALLOC_KEYS, ALLOC_LABEL, ASSETS, ASSET_KEYS, DIMENSIONS, ENDINGS,
  NONFIN, PHASES, PHASE_INFO, QUIZ, ROLES, WORLDS, r1, roleById, runGame, type Ctx, type Phase, type Scores,
} from '@/lib/game';
import { ActMap, Bars, Radar, Ticker } from '@/components/ui';

const doneKey = (room: RoomDoc) => (room.phase === 'act4' ? `act4_${room.month}` : room.phase);

export default function Host() {
  const { code } = useParams<{ code: string }>();
  const be = useMemo(() => getBackend(), []);
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => { be.uid().then(setUid); return be.watchRoom(code, setRoom); }, [be, code]);
  useEffect(() => be.watchPlayers(code, setPlayers), [be, code]);
  useEffect(() => {
    const url = `${location.origin}/?room=${code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#0f1419', light: '#ffffff' } }).then(setQr);
  }, [code]);

  // 遊戲開始後才加入（或開始瞬間加入）的玩家：自動補發目前最少人使用的角色
  const lateKey = room && room.phase !== 'lobby' ? players.filter((p) => !p.roleId).map((p) => p.uid).join(',') : '';
  useEffect(() => {
    if (!lateKey) return;
    const used = new Map(ROLES.map((r) => [r.id, players.filter((p) => p.roleId === r.id).length]));
    for (const p of players.filter((x) => !x.roleId)) {
      const r = [...used.entries()].sort((x, y) => x[1] - y[1])[0][0];
      used.set(r, used.get(r)! + 1);
      be.updatePlayer(code, p.uid, { roleId: r });
    }
  }, [lateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (room === undefined) return <div className="wrap center muted">連線中…</div>;
  if (!room) return <div className="wrap center">找不到房間 {code}</div>;
  if (uid && room.hostUid !== uid) return <div className="wrap center">你不是這個房間的主持人。</div>;

  const set = (patch: Partial<RoomDoc>) => be.updateRoom(code, patch);
  const ctx: Ctx = { bankRun: !!room.bankRun, world: room.world ?? undefined };
  const active = players.filter((p) => p.roleId);
  const dk = doneKey(room);
  const doneCount = active.filter((p) => p.done[dk]).length;
  const info = PHASE_INFO[room.phase];
  const pi = PHASES.indexOf(room.phase);

  const next = async () => {
    const base = { reveal: false, paused: false };
    // 中途加入的玩家：補發目前最少人使用的角色
    if (room.phase !== 'lobby') {
      const late = players.filter((p) => !p.roleId);
      const used = new Map(ROLES.map((r) => [r.id, active.filter((p) => p.roleId === r.id).length]));
      for (const p of late) {
        const r = [...used.entries()].sort((x, y) => x[1] - y[1])[0][0];
        used.set(r, used.get(r)! + 1);
        await be.updatePlayer(code, p.uid, { roleId: r });
      }
    }
    switch (room.phase) {
      case 'lobby': {
        // 洗牌分配角色（超過 7 人時重複）
        const order = [...ROLES].sort(() => Math.random() - 0.5);
        await Promise.all(players.map((p, i) => be.updatePlayer(code, p.uid, { roleId: order[i % order.length].id })));
        return set({ ...base, phase: 'role' });
      }
      case 'act2': {
        const a = active.filter((p) => p.d.act2 === 'A').length;
        return set({ ...base, phase: 'act3', bankRun: active.length >= 2 && a / active.length >= 0.5 });
      }
      case 'survival': return set({ ...base, phase: 'act4', month: 1 });
      case 'act4':
        if (room.month < 3) return set({ ...base, month: room.month + 1 });
        return set({ ...base, phase: 'act5', world: Math.floor(Math.random() * WORLDS.length) });
      default:
        if (pi < PHASES.length - 1) return set({ ...base, phase: PHASES[pi + 1] });
    }
  };
  const prev = () => {
    if (room.phase === 'act4' && room.month > 1) return set({ month: room.month - 1, reveal: false });
    if (pi > 1) return set({ phase: PHASES[pi - 1], reveal: false, paused: false });
  };
  const nextLabel = room.phase === 'lobby' ? '開始遊戲 ▶' : room.phase === 'act4' && room.month < 3 ? `推進到 Month ${room.month + 1} ▶`
    : pi < PHASES.length - 1 ? `下一步：${PHASE_INFO[PHASES[pi + 1]].label} ▶` : '遊戲結束';

  return (
    <div className="host">
      <main>
        <div className="row between">
          <span className="muted">房間 <b style={{ color: 'var(--text)', letterSpacing: '.2em' }}>{code}</b>{be.mode === 'local' && '（本機示範模式）'}</span>
          <span className="muted">{active.length || players.length} 位玩家</span>
        </div>
        <ActMap phase={room.phase} />
        <Ticker phase={room.phase} />

        {room.phase === 'lobby' ? (
          <Lobby qr={qr} url={joinUrl} players={players} />
        ) : (
          <>
            <div>
              <div className="kicker">{room.phase === 'act4' ? `${info.title}｜Month ${room.month}` : info.label}</div>
              <h1 className="title">{info.title}</h1>
              <div className="q">{info.question}</div>
            </div>
            <div className="scene">
              {room.phase === 'act4' ? <p style={{ margin: 0 }}>{info.scene[room.month - 1]}</p> : info.scene.map((s) => <p key={s} style={{ margin: '4px 0' }}>{s}</p>)}
            </div>
            {room.phase === 'act5' && room.world != null && (
              <div className="card" style={{ borderColor: 'var(--accent)' }}>
                <div className="kicker">重新開機後的世界</div>
                <h2>🌐 {WORLDS[room.world].name}</h2>
                <p style={{ margin: 0, fontSize: 20 }}>{WORLDS[room.world].story}</p>
              </div>
            )}
            {room.phase === 'act3' && room.bankRun && (
              <div className="card" style={{ borderColor: 'var(--danger)', fontSize: 20 }}>
                🏃 <b>擠兌效應</b>：第二幕有過半數玩家選擇提款。大量提領讓銀行進一步下修 ATM 限額，所有人的存款可動用率從 20% 降到 10%。
              </div>
            )}
            {room.reveal ? (
              <>
                <Stats room={room} players={active} ctx={ctx} />
                {info.learn && <div className="learn">💡 {info.learn}</div>}
              </>
            ) : (
              <p className="muted">已提交 {doneCount}/{active.length}。全部完成後，按「公布匿名統計」。</p>
            )}
          </>
        )}
      </main>

      <aside>
        <h3 style={{ margin: 0 }}>主持人控制台</h3>
        <button className="btn primary block" onClick={next} disabled={pi === PHASES.length - 1 || (room.phase === 'lobby' && players.length === 0)}>{nextLabel}</button>
        <div className="grid2">
          <button className="btn" onClick={prev} disabled={pi <= 1 && !(room.phase === 'act4' && room.month > 1)}>◀ 上一步</button>
          <button className={`btn ${room.reveal ? 'teal' : ''}`} onClick={() => set({ reveal: !room.reveal })} disabled={room.phase === 'lobby'}>
            {room.reveal ? '隱藏統計' : '公布匿名統計'}
          </button>
        </div>
        <button className={`btn block ${room.paused ? 'teal' : ''}`} onClick={() => set({ paused: !room.paused })} disabled={room.phase === 'lobby'}>
          {room.paused ? '結束討論' : '💬 暫停討論'}
        </button>

        <div className="card soft" style={{ margin: 0 }}>
          <div className="row between"><b>提交狀態</b><span className="small muted">{doneCount}/{active.length}</span></div>
          <div className="status" style={{ marginTop: 8 }}>
            {(room.phase === 'lobby' ? players : active).map((p) => (
              <span key={p.uid} className={`pill ${p.done[dk] ? 'ok' : ''}`}>{p.done[dk] ? '✓ ' : ''}{p.name}</span>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>只顯示是否完成，不顯示任何人的選擇。</p>
        </div>

        <div className="card soft" style={{ margin: 0 }}>
          <b>迷思快問快答</b>
          <p className="small muted" style={{ margin: '4px 0' }}>可在幕次之間插入匿名投票。</p>
          {room.quiz?.open ? (
            <div className="grid2">
              <button className="btn sm" onClick={() => set({ quiz: { ...room.quiz!, reveal: !room.quiz!.reveal } })}>{room.quiz.reveal ? '隱藏答案' : '揭曉'}</button>
              <button className="btn sm" onClick={() => set({ quiz: { ...room.quiz!, open: false } })}>關閉</button>
            </div>
          ) : (
            <div className="row wrapflex" style={{ gap: 6 }}>
              {QUIZ.map((_, i) => <button key={i} className="btn sm" onClick={() => set({ quiz: { idx: i, open: true, reveal: false } })} disabled={room.phase === 'lobby'}>Q{i + 1}</button>)}
            </div>
          )}
        </div>

        {room.phase === 'act5' && (
          <div className="card soft" style={{ margin: 0 }}>
            <b>世界情境</b>
            <p className="small muted" style={{ margin: '4px 0' }}>系統已隨機抽出，必要時可手動更換。</p>
            <div className="row wrapflex" style={{ gap: 6 }}>
              {WORLDS.map((w) => <button key={w.id} className={`btn sm ${room.world === w.id ? 'primary' : ''}`} onClick={() => set({ world: w.id })}>{w.name}</button>)}
            </div>
          </div>
        )}

        {room.phase !== 'lobby' && info.discuss.length > 0 && (
          <div className="card soft" style={{ margin: 0 }}>
            <b>討論提示</b>
            <ul className="small" style={{ paddingLeft: 18, marginBottom: 0 }}>{info.discuss.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        )}
        <a className="small muted" href="/" style={{ marginTop: 'auto' }}>回首頁</a>
      </aside>

      {room.paused && (
        <div className="overlay" onClick={() => set({ paused: false })}>
          <div className="kicker">現場討論</div>
          {info.discuss.map((d) => <h1 key={d}>{d}</h1>)}
          {info.learn && <p className="big muted">{info.learn}</p>}
          <p className="small muted">點擊任意處結束討論</p>
        </div>
      )}
      {room.quiz?.open && <QuizBoard room={room} players={active.length ? active : players} onClose={() => set({ quiz: { ...room.quiz!, open: false } })} />}
    </div>
  );
}

function Lobby({ qr, url, players }: { qr: string; url: string; players: PlayerDoc[] }) {
  return (
    <div className="row wrapflex" style={{ gap: 32, alignItems: 'flex-start' }}>
      <div className="card center" style={{ background: '#fff', color: '#0f1419', padding: 20 }}>
        {qr && <img src={qr} alt="加入房間 QR Code" width={300} height={300} />}
        <div style={{ fontSize: 14, wordBreak: 'break-all', maxWidth: 300 }}>{url}</div>
      </div>
      <div style={{ flex: 1, minWidth: 260 }}>
        <h1 className="title">掃描加入</h1>
        <p className="scene muted">輸入暱稱即可加入，不需要註冊。</p>
        <div className="status">{players.map((p) => <span key={p.uid} className="pill ok" style={{ fontSize: 20, padding: '6px 14px' }}>{p.name}</span>)}</div>
        {players.length === 0 && <p className="muted">等待第一位玩家…</p>}
      </div>
    </div>
  );
}

function QuizBoard({ room, players, onClose }: { room: RoomDoc; players: PlayerDoc[]; onClose: () => void }) {
  const q = room.quiz!; const k = String(q.idx);
  const y = players.filter((p) => p.quiz?.[k] === 'Y').length;
  const n = players.filter((p) => p.quiz?.[k] === 'N').length;
  return (
    <div className="overlay">
      <div className="kicker">迷思快問快答 {q.idx + 1}/{QUIZ.length}</div>
      <h1>{QUIZ[q.idx].q}</h1>
      <p className="big muted">已投票 {y + n}/{players.length}</p>
      {q.reveal && (
        <>
          <div style={{ width: 'min(700px, 90vw)' }}>
            <Bars items={[{ label: 'YES', value: y, tone: 'alt' }, { label: 'NO', value: n }]} max={Math.max(1, y + n)} fmt={(v) => `${v} 人`} />
          </div>
          <p className="big"><b>答案：NO</b>　{QUIZ[q.idx].a}</p>
        </>
      )}
      <button className="btn" style={{ marginTop: 16 }} onClick={onClose}>關閉快問快答</button>
    </div>
  );
}

// ─── 匿名統計 ───────────────────────────────────────
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Stats({ room, players, ctx }: { room: RoomDoc; players: PlayerDoc[]; ctx: Ctx }) {
  const games = players.map((p) => {
    const role = roleById(p.roleId)!;
    const finished = (p.d.rolls || []).filter((x) => x != null).length === 3 && room.world != null;
    const months = room.phase === 'act4' ? room.month : 3;
    return { p, g: runGame(role, p.d, ctx, { act4Months: months, finish: finished && ['act5', 'report', 'personal'].includes(room.phase) }) };
  });
  const n = Math.max(1, games.length);

  switch (room.phase) {
    case 'role': {
      const tot = Object.fromEntries(ASSET_KEYS.map((k) => [k, games.reduce((s, { g }) => s + g.role.assets[k], 0) / n]));
      return (
        <div className="statgrid">
          <div className="card"><h3>全場平均資源結構（調整前）</h3><Bars items={ASSET_KEYS.map((k) => ({ label: `${ASSETS[k].icon} ${ASSETS[k].name}`, value: tot[k] }))} fmt={(v) => r1(v).toString()} /></div>
          <div className="card"><h3>有負債的角色</h3><p style={{ fontSize: 48, margin: 0 }}>{games.filter(({ g }) => g.hadDebt).length}<span className="muted" style={{ fontSize: 20 }}> / {games.length}</span></p></div>
        </div>
      );
    }
    case 'act1': {
      const totalPts = games.length * 20;
      const sums = ALLOC_KEYS.map((k) => ({ label: ALLOC_LABEL[k], value: games.reduce((s, { p }) => s + (p.d.alloc?.[k] || 0), 0) }));
      const nf = games.reduce((s, { p }) => s + (p.d.buyNonfin?.length || 0) * 2, 0);
      const used = sums.reduce((s, x) => s + x.value, 0) + nf;
      const none = games.filter(({ p }) => !p.d.alloc || Object.values(p.d.alloc).every((v) => !v)).length;
      const nfCount = Object.entries(NONFIN).map(([k, v]) => ({ label: `${v.icon} ${v.name}`, value: games.filter(({ p }) => p.d.buyNonfin?.includes(k as never)).length })).filter((x) => x.value > 0);
      return (
        <div className="statgrid">
          <div className="card"><h3>全場 20 點的去向</h3>
            <Bars items={[...sums, { label: '非金融備援', value: nf }, { label: '留在銀行存款（未調整）', value: totalPts - used, tone: 'ice' }]} max={totalPts} fmt={(v) => pct(v / totalPts)} />
          </div>
          <div className="card"><h3>完全沒有調整</h3><p style={{ fontSize: 48, margin: 0 }}>{none}<span className="muted" style={{ fontSize: 20 }}> 人</span></p>
            {nfCount.length > 0 && <><h3>新建立的生存資本</h3><Bars items={nfCount} fmt={(v) => `${v} 人`} /></>}
          </div>
        </div>
      );
    }
    case 'act2': {
      const opts = ACT2_KEYS.map((k) => ({ label: `${k}. ${ACT2_OPTIONS[k].title}`, value: games.filter(({ p }) => p.d.act2 === k).length, tone: k === 'A' ? 'alt' as const : undefined }));
      const evs = ACT2_EVENTS.map((e, i) => ({ label: e.title, value: games.filter(({ p }) => p.d.act2Roll === i + 1).length })).filter((x) => x.value > 0);
      const a = games.filter(({ p }) => p.d.act2 === 'A').length / n;
      return (
        <div className="statgrid">
          <div className="card"><h3>大家選擇的行動</h3><Bars items={opts} max={n} fmt={(v) => `${v} 人`} />
            <p className="small muted">選擇提款的比例：{pct(a)}{a >= 0.5 ? '（已達擠兌門檻）' : ''}</p>
          </div>
          <div className="card"><h3>人生事件</h3><Bars items={evs} max={n} fmt={(v) => `${v} 人`} /></div>
        </div>
      );
    }
    case 'act3': {
      const owned = games.reduce((s, { g }) => s + g.owned, 0) / n;
      const acc = games.reduce((s, { g }) => s + g.accessible, 0) / n;
      const per = ASSET_KEYS.map((k) => {
        const held = games.reduce((s, { g }) => s + (g.access.find((r) => r.key === k)?.held || 0), 0);
        const ac = games.reduce((s, { g }) => s + (g.access.find((r) => r.key === k)?.access || 0), 0);
        return { k, held, ac };
      }).filter((x) => x.held > 0.1);
      return (
        <div className="statgrid">
          <div className="card center"><h3>全場平均</h3>
            <div className="muted">擁有</div><div style={{ fontSize: 56, fontWeight: 800 }}>{r1(owned)}</div>
            <div className="muted">現在能動用</div><div style={{ fontSize: 72, fontWeight: 800, color: 'var(--ice)' }}>{r1(acc)}</div>
          </div>
          <div className="card"><h3>各類資產：持有 vs 可動用</h3>
            <Bars items={per.flatMap(({ k, held, ac }) => [
              { label: `${ASSETS[k].icon} ${ASSETS[k].name}｜持有`, value: held },
              { label: '　　　可動用', value: ac, tone: 'ice' as const },
            ])} fmt={(v) => r1(v / n).toString()} />
          </div>
        </div>
      );
    }
    case 'survival': {
      const buckets = [['不到 1 個月', 0, 1], ['1–3 個月', 1, 3], ['3–6 個月', 3, 6], ['6–12 個月', 6, 12], ['12 個月以上', 12, Infinity]] as const;
      const items = buckets.map(([l, lo, hi]) => ({ label: l, value: games.filter(({ g }) => g.survivalMonths >= lo && g.survivalMonths < hi).length }));
      const paper = games.reduce((s, { g }) => s + g.owned / g.role.L, 0) / n;
      const real = games.reduce((s, { g }) => s + g.survivalMonths, 0) / n;
      return (
        <div className="statgrid">
          <div className="card"><h3>生存期分布（匿名）</h3><Bars items={items} max={n} fmt={(v) => `${v} 人`} /></div>
          <div className="card"><h3>平均生存期</h3>
            <Bars items={[{ label: '以帳面總資產計算', value: paper, tone: 'alt' }, { label: '以可動用資源計算', value: real, tone: 'ice' }]} fmt={(v) => `${r1(v)} 個月`} />
          </div>
        </div>
      );
    }
    case 'act4': {
      const m = room.month;
      const shortfall = games.filter(({ g }) => g.months[m - 1]?.unmet > 0).length;
      const evs = ACT4_EVENTS.map((e, i) => ({ label: e.title, value: games.filter(({ p }) => p.d.rolls?.[m - 1] === i + 1).length })).filter((x) => x.value > 0);
      const debtHit = m === 3 ? games.filter(({ g }) => (g.months[2]?.debtDue || 0) > 0).length : 0;
      const network = games.filter(({ g }) => g.months.some((l) => l.paidFrom.network)).length;
      return (
        <div className="statgrid">
          <div className="card"><h3>Month {m}：出現資源缺口</h3><p style={{ fontSize: 56, margin: 0, color: shortfall ? 'var(--danger)' : 'var(--ok)' }}>{shortfall}<span className="muted" style={{ fontSize: 20 }}> / {games.length} 人</span></p>
            {m === 3 && <p>📬 收到貸款繳款通知：<b>{debtHit}</b> 人</p>}
            {network > 0 && <p>🤝 曾獲得親友支援：<b>{network}</b> 人</p>}
          </div>
          <div className="card"><h3>本月個人事件</h3><Bars items={evs} max={n} fmt={(v) => `${v} 人`} /></div>
        </div>
      );
    }
    case 'act5': {
      const fin = games.filter(({ g }) => g.finalNet != null);
      const nets = fin.map(({ g }) => g.finalNet!);
      const avg = nets.reduce((a, b) => a + b, 0) / Math.max(1, nets.length);
      const loans = fin.filter(({ g }) => g.forcedLoan > 0.05).length;
      return (
        <div className="statgrid">
          <div className="card center"><h3>重新開機後平均淨資源</h3><div style={{ fontSize: 64, fontWeight: 800 }}>{r1(avg)}</div><div className="muted">起點 100</div></div>
          <div className="card"><h3>淨資源分布</h3>
            <Bars items={[['低於 40', -Infinity, 40], ['40–70', 40, 70], ['70–90', 70, 90], ['90 以上', 90, Infinity]].map(([l, lo, hi]) => ({ label: l as string, value: nets.filter((v) => v >= (lo as number) && v < (hi as number)).length }))} max={Math.max(1, nets.length)} fmt={(v) => `${v} 人`} />
            <p>危機中曾被迫借款：<b>{loans}</b> 人</p>
          </div>
        </div>
      );
    }
    case 'report':
    case 'personal': {
      const fin = games.filter(({ g }) => g.scores);
      const counts = Object.values(ENDINGS).map((e) => ({ label: `${e.icon} ${e.name}`, value: fin.filter(({ g }) => g.ending?.id === e.id).length })).filter((x) => x.value > 0);
      const avg = Object.fromEntries(DIMENSIONS.map((d) => [d.key, Math.round(fin.reduce((s, { g }) => s + g.scores![d.key], 0) / Math.max(1, fin.length))])) as unknown as Scores;
      return (
        <div className="statgrid">
          <div className="card"><h3>全場結局</h3><Bars items={counts} max={Math.max(1, fin.length)} fmt={(v) => `${v} 人`} /></div>
          <div className="card"><h3>全場平均韌性</h3>{fin.length > 0 && <Radar scores={avg} size={320} />}</div>
        </div>
      );
    }
    default: return null;
  }
}
