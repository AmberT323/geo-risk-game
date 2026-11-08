'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBackend, type PlayerDoc, type PlayerPatch, type RoomDoc } from '@/lib/backend';
import {
  ACT2_EVENTS, ACT2_KEYS, ACT2_OPTIONS, ACT4_EVENTS, ADJUST_POINTS, ALLOC_KEYS, ALLOC_LABEL, ASSETS, ASSET_KEYS,
  DIMENSIONS, NONFIN, NONFIN_COST, PHASE_INFO, QUIZ, WORLDS, allocUsed, r1, roleById, runGame,
  type Act2Key, type AllocKey, type Ctx, type Decisions, type NonFin, type Role,
} from '@/lib/game';
import { ActMap, Bars, Fuel, Radar } from '@/components/ui';

interface P { room: RoomDoc; me: PlayerDoc; role: Role; ctx: Ctx; save: (p: PlayerPatch) => Promise<void> }

export default function Play() {
  const { code } = useParams<{ code: string }>();
  const be = useMemo(() => getBackend(), []);
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [me, setMe] = useState<PlayerDoc | null | undefined>(undefined);

  useEffect(() => { be.uid().then(setUid); return be.watchRoom(code, setRoom); }, [be, code]);
  useEffect(() => (uid ? be.watchPlayer(code, uid, setMe) : undefined), [be, code, uid]);

  if (room === undefined || me === undefined) return <div className="wrap center muted" style={{ paddingTop: 80 }}>連線中…</div>;
  if (!room) return <div className="wrap center" style={{ paddingTop: 80 }}>找不到房間 {code}。<p><a href="/">回首頁</a></p></div>;
  if (!me) return <div className="wrap center" style={{ paddingTop: 80 }}>你還沒有加入這個房間。<p><a href={`/?room=${code}`}>加入房間</a></p></div>;

  const role = roleById(me.roleId);
  const ctx: Ctx = { bankRun: !!room.bankRun, world: room.world ?? undefined };
  const save = (p: PlayerPatch) => be.updatePlayer(code, me.uid, p);
  const props = role ? { room, me, role, ctx, save } : null;

  let body: React.ReactNode;
  if (room.phase === 'lobby' || !props) {
    body = (
      <div className="card center" style={{ marginTop: 40 }}>
        <div style={{ fontSize: 44 }}>☕</div>
        <h2>嗨，{me.name}</h2>
        <p className="muted">已加入房間 <b>{code}</b>，等待主持人開始遊戲。</p>
      </div>
    );
  } else {
    switch (room.phase) {
      case 'role': body = <RoleScreen {...props} />; break;
      case 'act1': body = <Act1 {...props} />; break;
      case 'act2': body = <Act2 {...props} />; break;
      case 'act3': body = <Act3 {...props} />; break;
      case 'survival': body = <Survival {...props} />; break;
      case 'act4': body = <Act4 {...props} />; break;
      case 'act5': body = <Act5 {...props} />; break;
      case 'report': body = <Report {...props} />; break;
      case 'personal': body = <Personal {...props} />; break;
    }
  }

  const info = PHASE_INFO[room.phase];
  return (
    <div className="wrap">
      <div className="row between small muted">
        <span>房間 {code}</span>
        <span>{role ? `${role.emoji} ${role.name}` : me.name}</span>
      </div>
      {room.phase !== 'lobby' && <ActMap phase={room.phase} />}
      {room.phase !== 'lobby' && info.act && (
        <div style={{ marginTop: 6 }}>
          <div className="kicker">{info.title}</div>
          <h2 style={{ marginTop: 2 }}>{info.question}</h2>
        </div>
      )}
      {room.paused && <div className="pill warn" style={{ margin: '6px 0' }}>💬 主持人正在帶領討論</div>}
      {body}
      {room.quiz?.open && <QuizOverlay room={room} me={me} save={save} />}
    </div>
  );
}

// ─── 共用 ────────────────────────────────────────────
function useMarkDone(p: P, key: string, when = true) {
  const done = !!p.me.done[key];
  useEffect(() => { if (when && !done) p.save({ done: { [key]: true } }); }, [when, done]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Waiting({ text = '已完成，等待主持人進入下一步。' }: { text?: string }) {
  return <p className="center muted small" style={{ marginTop: 20 }}>✓ {text}</p>;
}

function Dice({ value, onRoll, disabled }: { value?: number | null; onRoll: (v: number) => void; disabled?: boolean }) {
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(1);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const roll = () => {
    setRolling(true);
    t.current = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    setTimeout(() => {
      if (t.current) clearInterval(t.current);
      const v = 1 + Math.floor(Math.random() * 6);
      setFace(v); setRolling(false); onRoll(v);
    }, 1100);
  };
  const shown = value ?? face;
  return (
    <div className="center">
      <div className={`dice ${rolling ? 'rolling' : ''}`}>{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][shown - 1]}</div>
      {value == null && <button className="btn primary" disabled={rolling || disabled} onClick={roll}>🎲 擲骰子</button>}
    </div>
  );
}

function EventCardView({ title, story, kicker }: { title: string; story: string; kicker?: string }) {
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      {kicker && <div className="kicker">{kicker}</div>}
      <h3>{title}</h3>
      <p style={{ margin: 0 }}>{story}</p>
    </div>
  );
}

function HoldingBars({ h, extra }: { h: Record<string, number>; extra?: { label: string; value: number }[] }) {
  const items = ASSET_KEYS.filter((k) => h[k] > 0.05).map((k) => ({ label: `${ASSETS[k].icon} ${ASSETS[k].name}`, value: h[k] }));
  return <Bars items={[...items, ...(extra || [])]} max={60} fmt={(v) => `${r1(v)}`} />;
}

// ─── 角色揭曉 ─────────────────────────────────────────
function RoleScreen(p: P) {
  const { role } = p;
  return (
    <>
      <div className="card center" style={{ borderColor: 'var(--accent)' }}>
        <div style={{ fontSize: 56 }}>{role.emoji}</div>
        <div className="kicker">你的角色</div>
        <h1 style={{ margin: 0 }}>{role.name}</h1>
        <p className="muted">{role.tagline}</p>
        <p style={{ textAlign: 'left' }}>{role.story}</p>
      </div>
      <RoleFacts role={role} />
      <div className="card">
        <h3>你的財務資源結構（100 WP）</h3>
        <p className="small muted">WP 代表整體財務資源的比例，不是金額。</p>
        <HoldingBars h={role.assets} extra={[{ label: '✳️ 調整權（第一幕配置）', value: ADJUST_POINTS }]} />
      </div>
      <div className="card">
        <h3>生存資本</h3>
        <div className="row wrapflex">{role.nonfin.map((n) => <span key={n} className="pill">{NONFIN[n].icon} {NONFIN[n].name}</span>)}</div>
      </div>
      {p.me.done.role ? <Waiting /> : (
        <div className="sticky-bottom"><div><button className="btn primary block" onClick={() => p.save({ done: { role: true } })}>我讀完了</button></div></div>
      )}
    </>
  );
}

function RoleFacts({ role }: { role: Role }) {
  return (
    <div className="grid2">
      <div className="card soft" style={{ margin: 0 }}><div className="small muted">月收入</div><b>{role.income} WP</b></div>
      <div className="card soft" style={{ margin: 0 }}><div className="small muted">每月生存低標</div><b>{role.L} WP</b></div>
      <div className="card soft" style={{ margin: 0, gridColumn: '1 / -1' }}>
        <div className="small muted">負債</div>
        {role.debt ? <b>{role.debt.name}｜每月還款 {role.debt.payment} WP</b> : <b>無</b>}
      </div>
    </div>
  );
}

// ─── 第一幕：和平配置 ─────────────────────────────────
function Act1(p: P) {
  const { role, me } = p;
  const [alloc, setAlloc] = useState<Partial<Record<AllocKey, number>>>(me.d.alloc || {});
  const [buy, setBuy] = useState<NonFin[]>(me.d.buyNonfin || []);
  const d: Decisions = { alloc, buyNonfin: buy };
  const used = allocUsed(d);
  const left = ADJUST_POINTS - used;
  const done = !!me.done.act1;
  const keys = ALLOC_KEYS.filter((k) => k !== 'prepay' || role.debt);
  const step = (k: AllocKey, dv: number) => {
    const v = Math.max(0, (alloc[k] || 0) + dv);
    if (dv > 0 && left < dv) return;
    setAlloc({ ...alloc, [k]: v });
  };
  const preview = runGame(role, d, p.ctx, { act4Months: 0 }).afterAct1;

  if (done) {
    return (
      <>
        <div className="card">
          <h3>你的配置已提交</h3>
          <HoldingBars h={preview} />
          {buy.length > 0 && <p className="small">新增生存資本：{buy.map((n) => NONFIN[n].name).join('、')}</p>}
        </div>
        <Waiting />
      </>
    );
  }
  return (
    <>
      <p className="muted small">一切正常。你有 <b>20 點調整權</b>，可以為不知道會不會發生的危機做準備，也可以什麼都不做。未使用的點數會留在銀行存款。</p>
      <RoleFacts role={role} />
      <div className="card">
        <div className="row between"><h3>調整權</h3><span className={`pill ${left === 0 ? 'ok' : 'warn'}`}>剩餘 {left} 點</span></div>
        {keys.map((k) => (
          <div key={k} className="row between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
            <span>{k === 'prepay' ? `💳 ${ALLOC_LABEL[k]}` : `${ASSETS[k as keyof typeof ASSETS].icon} ${ALLOC_LABEL[k]}`}</span>
            <div className="stepper">
              <button onClick={() => step(k, -1)} aria-label="減少">−</button>
              <span className="v">{alloc[k] || 0}</span>
              <button onClick={() => step(k, 1)} aria-label="增加">＋</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>建立非金融備援（每項 {NONFIN_COST} 點）</h3>
        {(Object.keys(NONFIN) as NonFin[]).filter((n) => !role.nonfin.includes(n)).map((n) => {
          const on = buy.includes(n);
          return (
            <button key={n} className={`choice ${on ? 'sel' : ''}`} onClick={() => {
              if (on) setBuy(buy.filter((x) => x !== n)); else if (left >= NONFIN_COST) setBuy([...buy, n]);
            }}>
              <div className="t">{NONFIN[n].icon} {NONFIN[n].name} {on && '✓'}</div>
              <div className="small muted">{NONFIN[n].effect}</div>
            </button>
          );
        })}
      </div>
      <div className="card soft">
        <h3>配置預覽</h3>
        <HoldingBars h={preview} />
      </div>
      <div className="sticky-bottom"><div>
        <button className="btn primary block" onClick={() => p.save({ d: { alloc, buyNonfin: buy }, done: { act1: true } })}>
          {used === 0 ? '不做任何調整，提交' : `提交配置（已用 ${used} 點）`}
        </button>
      </div></div>
    </>
  );
}

// ─── 第二幕：警訊決策＋第一次骰子 ─────────────────────
function Act2(p: P) {
  const { me, role } = p;
  const [sel, setSel] = useState<Act2Key | null>(me.d.act2 ?? null);
  const g = runGame(role, { alloc: me.d.alloc, buyNonfin: me.d.buyNonfin }, p.ctx, { act4Months: 0 });
  const h = g.afterAct1;
  const disabled = (k: Act2Key) =>
    (k === 'D' && !role.debt) || (k === 'C' && h.twstock + h.global < 1) || (['A', 'B', 'D', 'E', 'G'].includes(k) && h.deposit < 1);

  if (!me.d.act2) {
    return (
      <>
        <p className="muted small">ATM、銀行與網銀仍然正常。這一幕你<b>只能做一件事</b>。</p>
        {ACT2_KEYS.map((k) => (
          <button key={k} disabled={disabled(k)} className={`choice ${sel === k ? 'sel' : ''}`} onClick={() => setSel(k)} style={disabled(k) ? { opacity: .4 } : undefined}>
            <div className="t">{k}. {ACT2_OPTIONS[k].title}</div>
            <div className="small muted">{ACT2_OPTIONS[k].desc}</div>
          </button>
        ))}
        <div className="sticky-bottom"><div>
          <button className="btn primary block" disabled={!sel} onClick={() => sel && p.save({ d: { act2: sel } })}>確定行動</button>
        </div></div>
      </>
    );
  }
  const roll = me.d.act2Roll;
  const ev = roll ? ACT2_EVENTS[roll - 1] : null;
  const needChoice = roll === 5 && me.d.act2Opt == null;
  const after = runGame(role, me.d, p.ctx, { act4Months: 0 });
  return (
    <>
      <div className="card soft small">你的行動：<b>{me.d.act2}. {ACT2_OPTIONS[me.d.act2].title}</b></div>
      <div className="card center">
        <h3>個人人生事件</h3>
        <p className="small muted">骰子代表你的人生事件，不是戰爭或股市。</p>
        <Dice value={roll} onRoll={(v) => p.save({ d: { act2Roll: v }, ...(v !== 5 ? { done: { act2: true } } : {}) })} />
      </div>
      {ev && <EventCardView kicker={`🎲 ${roll}`} title={ev.title} story={ev.story} />}
      {ev && needChoice && ev.choice && (
        <div className="grid2">
          <button className="btn primary" onClick={() => p.save({ d: { act2Opt: true }, done: { act2: true } })}>{ev.choice.yes}</button>
          <button className="btn" onClick={() => p.save({ d: { act2Opt: false }, done: { act2: true } })}>{ev.choice.no}</button>
        </div>
      )}
      {ev && !needChoice && (
        <>
          {after.act2Notes.map((n) => <p key={n} className="small" style={{ color: 'var(--ok)' }}>{n}</p>)}
          <div className="card"><h3>目前配置</h3><HoldingBars h={after.afterAct2} /></div>
          <Waiting />
        </>
      )}
    </>
  );
}

// ─── 第三幕：金融冰封／資產翻牌 ───────────────────────
function Act3(p: P) {
  const { me, role } = p;
  const g = runGame(role, me.d, p.ctx, { act4Months: 0 });
  const [alert, setAlert] = useState(!me.done.act3);
  const rows = g.access.filter((r) => r.held > 0.05);
  const [flipped, setFlipped] = useState<Set<string>>(new Set(me.done.act3 ? rows.map((r) => r.key) : []));
  const all = flipped.size >= rows.length;
  useMarkDone(p, 'act3', all);

  return (
    <>
      {alert && (
        <div className="alert">
          <div className="box shake">
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h2 style={{ color: 'var(--danger)' }}>金融服務異常</h2>
            <p>網銀無法正常登入<br />ATM 提款受限<br />電子支付不穩定<br />部分金融市場暫停交易</p>
            <p><b>請重新確認你現在真正可以使用的資源。</b></p>
            <button className="btn primary block" onClick={() => setAlert(false)}>查看我的資產</button>
          </div>
        </div>
      )}
      <p className="muted small">點擊每張資產卡，翻開「目前可動用」。</p>
      {g.stashLoss > 0.05 && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          🕵️ 混亂中竊盜與詐騙猖獗。你家中存放大量現鈔與黃金，損失了 <b>{r1(g.stashLoss)}</b> WP。
        </div>
      )}
      <div className="flipgrid">
        {rows.map((r) => {
          const on = flipped.has(r.key);
          return (
            <div key={r.key} className={`flip ${on ? 'on' : ''}`} onClick={() => setFlipped(new Set([...flipped, r.key]))}>
              <div className="inner">
                <div className="face">
                  <div>{ASSETS[r.key].icon} {ASSETS[r.key].name}</div>
                  <div><div className="small muted">持有</div><div className="big">{r1(r.held)}</div></div>
                  <div className="small muted">點擊翻牌 ↻</div>
                </div>
                <div className={`face back ${r.access < 0.05 ? 'zero' : ''}`}>
                  <div>{ASSETS[r.key].icon} {ASSETS[r.key].name}</div>
                  <div><div className="small muted">目前可動用</div><div className="big" style={{ color: r.access < 0.05 ? 'var(--danger)' : 'var(--ice)' }}>{r1(r.access)}</div></div>
                  <div className="small muted">{r.reason}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!all && <button className="btn block" style={{ marginTop: 12 }} onClick={() => setFlipped(new Set(rows.map((r) => r.key)))}>全部翻開</button>}
      {all && (
        <div className="card center" style={{ borderColor: 'var(--ice)' }}>
          <div className="muted">你擁有</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{r1(g.owned)}</div>
          <div className="muted">你現在能動用</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--ice)' }}>{r1(g.accessible)}</div>
          <p className="kicker" style={{ fontSize: 16 }}>擁有權 ≠ 動用權</p>
          {p.ctx.bankRun && <p className="small" style={{ color: 'var(--danger)' }}>⚠ 第二幕有大量玩家提款，擠兌讓 ATM 限額更低。</p>}
        </div>
      )}
      {all && <Waiting />}
    </>
  );
}

// ─── 生存期 ──────────────────────────────────────────
function Survival(p: P) {
  const { me, role } = p;
  const g = runGame(role, me.d, p.ctx, { act4Months: 0 });
  useMarkDone(p, 'survival');
  const paper = g.owned / role.L;
  return (
    <>
      <div className="card center">
        <div className="kicker">財務生存期</div>
        <div style={{ fontSize: 64, fontWeight: 800, color: g.survivalMonths < 3 ? 'var(--danger)' : 'var(--accent)' }}>{r1(g.survivalMonths)}</div>
        <div>個月</div>
        <div style={{ margin: '14px 0' }}><Fuel months={g.survivalMonths} /></div>
        <p className="small muted" style={{ margin: 0 }}>0 ─────────── 3 個月 ─────────── 6 個月</p>
      </div>
      <div className="card">
        <table className="ledger"><tbody>
          <tr><td>目前可動用資源</td><td>{r1(g.accessible)} WP</td></tr>
          <tr><td>÷ 每月最低生存需求</td><td>{role.L} WP</td></tr>
          <tr><td><b>＝ 生存期</b></td><td><b>{r1(g.survivalMonths)} 個月</b></td></tr>
        </tbody></table>
      </div>
      <div className="card soft small">
        如果用<b>帳面總資產</b>計算，你可以撐 <b>{r1(paper)}</b> 個月。<br />
        差距 <b>{r1(paper - g.survivalMonths)}</b> 個月，就是「擁有」與「能用」之間的距離。
        {role.debt && <><br /><br />⚠ 別忘了：你每月還有 {r1(g.payment)} WP 的{role.debt.name}。</>}
      </div>
      <Waiting />
    </>
  );
}

// ─── 第四幕：撐過 90 天＋骰子支線 ─────────────────────
const MONTH_INTRO = [
  { t: 'Month 1｜收入中斷', s: '公司停工、客戶取消訂單。你的收入大幅下降。' },
  { t: 'Month 2｜生活成本上升', s: '食物、醫療、能源價格飆漲，最低生活成本 ×1.5。' },
  { t: 'Month 3｜金融系統部分恢復', s: '銀行陸續恢復營業，部分市場重新交易。信箱裡有一封銀行來信……' },
];

function Act4(p: P) {
  const { me, role, room } = p;
  const rolls = me.d.rolls || [null, null, null];
  const opts = me.d.opts || [null, null, null];
  // 找出最早尚未完成的月份（不超過主持人目前推進的月份）
  let cur = -1;
  for (let i = 0; i < room.month; i++) {
    if (rolls[i] == null || (ACT4_EVENTS[(rolls[i] as number) - 1].choice && opts[i] == null)) { cur = i; break; }
  }
  const resolved = cur === -1 ? room.month : cur;
  const g = runGame(role, me.d, p.ctx, { act4Months: resolved });
  const setArr = (arr: (number | boolean | null)[], i: number, v: number | boolean) => { const a = [...arr, null, null, null].slice(0, 3); a[i] = v; return a; };

  useMarkDone(p, `act4_${room.month}`, cur === -1);

  const ledger = g.months[g.months.length - 1];
  const cashLike = ledger ? ledger.holdingsAfter.cash + ledger.holdingsAfter.supplies + ledger.holdingsAfter.usd : 0;

  return (
    <>
      <div className="row" style={{ gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`pill ${i < g.months.length ? (g.months[i].unmet > 0 ? 'bad' : 'ok') : i === cur ? 'warn' : ''}`}>
            M{i + 1} {i < g.months.length ? (g.months[i].unmet > 0 ? '缺口' : '撐過') : i < room.month ? '進行中' : '—'}
          </span>
        ))}
      </div>

      {cur !== -1 && (
        <>
          <EventCardView kicker="系統衝擊" title={MONTH_INTRO[cur].t} story={MONTH_INTRO[cur].s} />
          <div className="card center">
            <h3>本月個人事件</h3>
            <Dice value={rolls[cur]} onRoll={(v) => p.save({ d: { rolls: setArr(rolls, cur, v) as number[] } })} />
          </div>
          {rolls[cur] != null && (() => {
            const ev = ACT4_EVENTS[(rolls[cur] as number) - 1];
            return (
              <>
                <EventCardView kicker={`🎲 ${rolls[cur]}`} title={ev.title} story={ev.story} />
                {ev.choice && (
                  <div className="grid2">
                    <button className="btn primary" onClick={() => p.save({ d: { opts: setArr(opts, cur, true) as boolean[] } })}>{ev.choice.yes}</button>
                    <button className="btn" onClick={() => p.save({ d: { opts: setArr(opts, cur, false) as boolean[] } })}>{ev.choice.no}</button>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {cur === -1 && ledger && (
        <>
          <EventCardView kicker={`Month ${ledger.month} 結算`} title={ACT4_EVENTS[(ledger.event || 1) - 1].title} story={MONTH_INTRO[ledger.month - 1].t} />
          <div className="card">
            <table className="ledger"><tbody>
              <tr><td>本月生活需求</td><td>−{r1(ledger.need)}</td></tr>
              {ledger.debtDue > 0 && <tr><td>📬 債務到期</td><td style={{ color: 'var(--danger)' }}>−{r1(ledger.debtDue)}</td></tr>}
              <tr><td>本月收入</td><td>+{r1(ledger.income)}</td></tr>
              {Object.entries(ledger.paidFrom).map(([k, v]) => (
                <tr key={k}><td className="muted">　動用 {k === 'network' ? '🤝 親友支援' : `${ASSETS[k as keyof typeof ASSETS].icon} ${ASSETS[k as keyof typeof ASSETS].name}`}</td><td className="muted">{r1(v || 0)}</td></tr>
              ))}
              {ledger.unmet > 0 && <tr><td style={{ color: 'var(--danger)' }}>資源缺口</td><td style={{ color: 'var(--danger)' }}>{r1(ledger.unmet)}</td></tr>}
            </tbody></table>
            {ledger.notes.map((n) => <p key={n} className="small" style={{ margin: '6px 0' }}>• {n}</p>)}
          </div>
          <div className="card soft">
            <div className="small muted">手邊可直接使用（現鈔＋美元＋物資）</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{r1(cashLike)} WP</div>
            <Fuel months={cashLike / role.L} />
            <div className="small muted">約 {r1(cashLike / role.L)} 個月生活費</div>
          </div>
          {g.months.length > 1 && (
            <details className="card soft small"><summary>前幾個月</summary>
              {g.months.slice(0, -1).map((l) => (
                <p key={l.month}>Month {l.month}：{ACT4_EVENTS[(l.event || 1) - 1].title}，需求 {r1(l.need + l.debtDue)}，收入 {r1(l.income)}{l.unmet > 0 ? `，缺口 ${r1(l.unmet)}` : ''}</p>
              ))}
            </details>
          )}
          <Waiting text={room.month < 3 ? '本月已撐過，等待主持人推進下個月。' : '撐過 90 天了，等待主持人進入下一幕。'} />
        </>
      )}
    </>
  );
}

// ─── 第五幕：世界重新開機 ─────────────────────────────
function Act5(p: P) {
  const { me, role, room } = p;
  const ready = room.world != null && (me.d.rolls || []).filter((x) => x != null).length === 3;
  useMarkDone(p, 'act5', ready);
  if (room.world == null) return <Waiting text="等待主持人揭曉重新開機後的世界……" />;
  if (!ready) return <p className="card">你還有第四幕的月份尚未完成，請主持人協助。</p>;
  const g = runGame(role, me.d, p.ctx, { finish: true });
  const w = WORLDS[room.world];
  const l = g.summary456!;
  const fh = g.finalHoldings!;
  return (
    <>
      <div className="card center"><div className="kicker">180 天後</div><p style={{ margin: 0 }}>金融系統逐漸恢復，市場重新交易，工作開始恢復。<br />但是世界已經不是原來的樣子。</p></div>
      <EventCardView kicker="重新開機後的世界" title={`🌐 ${w.name}`} story={w.story} />
      <div className="card">
        <h3>第 4–6 個月濃縮結算</h3>
        <table className="ledger"><tbody>
          <tr><td>三個月生活需求（物價仍高）</td><td>−{r1(l.need)}</td></tr>
          <tr><td>三個月債務還款</td><td>−{r1(l.debtDue)}</td></tr>
          <tr><td>三個月收入（逐步恢復）</td><td>+{r1(l.income)}</td></tr>
          {l.unmet > 0 && <tr><td style={{ color: 'var(--danger)' }}>資源缺口</td><td style={{ color: 'var(--danger)' }}>{r1(l.unmet)}</td></tr>}
        </tbody></table>
      </div>
      <div className="card">
        <h3>資產解凍</h3>
        <p className="small muted">剩餘持有 → 在這個世界的實質價值</p>
        <table className="ledger"><tbody>
          {ASSET_KEYS.filter((k) => fh[k] > 0.05).map((k) => (
            <tr key={k}><td>{ASSETS[k].icon} {ASSETS[k].name}</td><td>{r1(fh[k])} → <b style={{ color: w.real[k] >= 1 ? 'var(--ok)' : 'var(--danger)' }}>{r1(fh[k] * w.real[k])}</b></td></tr>
          ))}
          {g.principal > 0.05 && <tr><td>💳 剩餘債務</td><td style={{ color: 'var(--danger)' }}>−{r1(g.principal * w.debtReal)}</td></tr>}
          <tr><td><b>重新開機後的淨資源</b></td><td><b>{r1(g.finalNet!)}</b></td></tr>
        </tbody></table>
        <p className="small muted">起點是 100。</p>
      </div>
      <Waiting />
    </>
  );
}

// ─── 韌性報告 ────────────────────────────────────────
const DIM_EXPLAIN: Record<string, string> = {
  survival: '危機中有沒有足夠資源撐過每個月',
  liquidity: '冰封時，金融資產有多少能真正動用',
  purchasing: '資產面對通膨與貶值的抵抗力',
  debt: '固定債務對你生活的壓力',
  recovery: '世界重新開機後，你重新開始的能力',
};

function Report(p: P) {
  const { me, role } = p;
  const done = (me.d.rolls || []).filter((x) => x != null).length === 3 && p.room.world != null;
  useMarkDone(p, 'report', done);
  if (!done) return <p className="card">資料不完整，無法產生報告。</p>;
  const g = runGame(role, me.d, p.ctx, { finish: true });
  const s = g.scores!; const e = g.ending!;
  return (
    <>
      <div className="card center" style={{ borderColor: 'var(--accent)' }}>
        <div style={{ fontSize: 56 }}>{e.icon}</div>
        <div className="kicker">你的結局</div>
        <h1 style={{ margin: 0 }}>{e.name}</h1>
        <p>{e.desc}</p>
      </div>
      <div className="card"><Radar scores={s} /></div>
      <div className="card">
        {DIMENSIONS.map((d) => (
          <div key={d.key} style={{ margin: '8px 0' }}>
            <div className="row between"><b>{d.name}</b><span>{s[d.key]}</span></div>
            <div className="small muted">{DIM_EXPLAIN[d.key]}</div>
          </div>
        ))}
      </div>
      <div className="card soft small">
        <table className="ledger"><tbody>
          <tr><td>冰封時：擁有 → 可動用</td><td>{r1(g.owned)} → {r1(g.accessible)}</td></tr>
          <tr><td>財務生存期</td><td>{r1(g.survivalMonths)} 個月</td></tr>
          <tr><td>被迫借款</td><td>{r1(g.forcedLoan)}</td></tr>
          <tr><td>重新開機後淨資源</td><td>{r1(g.finalNet!)}</td></tr>
        </tbody></table>
      </div>
      <Waiting text="等待主持人帶領最後的討論。" />
    </>
  );
}

// ─── 個人行動（只在本機計算，不上傳） ───────────────
const WEAK = ['現金不足', '債務壓力', '資產過度集中', '高度依賴數位金融系統', '家庭準備不足', '其他'];

function Personal(p: P) {
  useMarkDone(p, 'personal'); // 只記錄「已進入」，不含任何內容
  const [need, setNeed] = useState('');
  const [cash, setCash] = useState('');
  const [debt, setDebt] = useState('');
  const [weak, setWeak] = useState<string[]>([]);
  const [act, setAct] = useState('');
  const [when, setWhen] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = parseFloat(need) || 0; const c = parseFloat(cash) || 0; const dd = parseFloat(debt) || 0;
  const months = n + dd > 0 ? c / (n + dd) : null;

  const download = () => {
    const cv = canvasRef.current; if (!cv) return;
    const W = 720, H = 960; cv.width = W; cv.height = H;
    const x = cv.getContext('2d')!;
    x.fillStyle = '#0f1419'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#f2b544'; x.lineWidth = 6; x.strokeRect(30, 30, W - 60, H - 60);
    x.fillStyle = '#f2b544'; x.font = 'bold 30px sans-serif'; x.fillText('我的行動卡', 70, 110);
    x.fillStyle = '#8d9aa8'; x.font = '22px sans-serif'; x.fillText('地緣風險理財課｜財務韌性生存模擬', 70, 150);
    x.fillStyle = '#e8edf2'; x.font = 'bold 28px sans-serif';
    let y = 230;
    if (months != null) { x.fillText(`我的生存期：約 ${r1(months)} 個月`, 70, y); y += 60; }
    x.font = '24px sans-serif'; x.fillStyle = '#8d9aa8';
    if (weak.length) { x.fillText(`最大弱點：${weak.join('、')}`, 70, y); y += 70; }
    x.fillStyle = '#e8edf2'; x.font = 'bold 28px sans-serif'; x.fillText('如果只能改善一件事，我會……', 70, y); y += 50;
    x.font = '30px sans-serif'; x.fillStyle = '#4fb3a9';
    const chars = [...(act || '＿＿＿＿＿＿')]; let line = '';
    for (const ch of chars) { if (x.measureText(line + ch).width > W - 140) { x.fillText(line, 70, y); y += 46; line = ''; } line += ch; }
    x.fillText(line, 70, y); y += 70;
    x.fillStyle = '#e8edf2'; x.font = '26px sans-serif'; x.fillText(`預計完成：${when || '＿＿＿＿'}`, 70, y);
    x.fillStyle = '#8d9aa8'; x.font = 'italic 22px sans-serif';
    x.fillText('真正的韌性，是危機發生後仍然保有選擇。', 70, H - 80);
    const a = document.createElement('a'); a.download = '我的行動卡.png'; a.href = cv.toDataURL('image/png'); a.click();
  };

  return (
    <>
      <div className="card" style={{ borderColor: 'var(--accent2)' }}>
        🔒 <b>這一頁只存在你的手機上。</b>
        <div className="small muted">你輸入的真實數字只在本機計算，不會上傳、不會儲存，主持人也看不到。關掉頁面就會消失。</div>
      </div>
      <div className="card">
        <h3>私人壓力測試</h3>
        <p className="small muted">可用萬元或任何你習慣的單位，前後一致即可。</p>
        <label className="small">每月最低必要支出</label>
        <input className="input" inputMode="decimal" value={need} onChange={(e) => setNeed(e.target.value)} />
        <div style={{ height: 8 }} />
        <label className="small">每月固定債務還款</label>
        <input className="input" inputMode="decimal" value={debt} onChange={(e) => setDebt(e.target.value)} />
        <div style={{ height: 8 }} />
        <label className="small">真正可立即動用的現金／資源（不含股票、房產、定存）</label>
        <input className="input" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        {months != null && (
          <div className="center" style={{ marginTop: 14 }}>
            <div className="muted small">我的個人生存期</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: months < 3 ? 'var(--danger)' : 'var(--accent)' }}>{r1(months)} 個月</div>
            <Fuel months={months} />
          </div>
        )}
      </div>
      <div className="card">
        <h3>我的最大弱點</h3>
        <div className="row wrapflex">
          {WEAK.map((w) => (
            <button key={w} className={`btn sm ${weak.includes(w) ? 'primary' : ''}`} onClick={() => setWeak(weak.includes(w) ? weak.filter((x) => x !== w) : [...weak, w])}>{w}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>我的行動卡</h3>
        <label className="small">如果只能改善一件事，我會……</label>
        <textarea className="input" rows={3} value={act} onChange={(e) => setAct(e.target.value)} placeholder="例：把三個月生活費放在可立即動用的地方" />
        <div style={{ height: 8 }} />
        <label className="small">我預計何時完成</label>
        <input className="input" type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        <div style={{ height: 12 }} />
        <button className="btn teal block" onClick={download} disabled={!act.trim()}>下載行動卡圖片</button>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <p className="center muted small">資產淨值，不等於生存能力。擁有權，不等於動用權。<br />避險，不等於押注某一種資產。真正的韌性，是危機發生後仍然保有選擇。</p>
    </>
  );
}

// ─── 迷思快問快答 ─────────────────────────────────────
function QuizOverlay({ room, me, save }: { room: RoomDoc; me: PlayerDoc; save: (p: PlayerPatch) => Promise<void> }) {
  const q = room.quiz!; const item = QUIZ[q.idx];
  const mine = me.quiz[String(q.idx)];
  return (
    <div className="alert" style={{ background: 'rgba(5,10,15,.96)' }}>
      <div className="box" style={{ borderColor: 'var(--accent)', background: 'var(--panel)' }}>
        <div className="kicker">迷思快問快答 {q.idx + 1}/{QUIZ.length}（匿名）</div>
        <h2>{item.q}</h2>
        {!mine && !q.reveal && (
          <div className="grid2">
            <button className="btn primary" onClick={() => save({ quiz: { [String(q.idx)]: 'Y' } })}>YES</button>
            <button className="btn teal" onClick={() => save({ quiz: { [String(q.idx)]: 'N' } })}>NO</button>
          </div>
        )}
        {mine && !q.reveal && <p className="muted">你選了 {mine === 'Y' ? 'YES' : 'NO'}，等待揭曉…</p>}
        {q.reveal && <><p><b>答案：NO</b></p><p className="small">{item.a}</p></>}
      </div>
    </div>
  );
}
