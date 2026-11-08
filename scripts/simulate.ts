// 平衡測試：7 角色 × 多種策略 × 全部 6^4 種骰子組合
import { ROLES, runGame, DIMENSIONS, type Decisions, type Act2Key } from '../lib/game.ts';

type Strat = { name: string; mk: (hasDebt: boolean) => Decisions };
const S: Strat[] = [
  { name: '不調整', mk: () => ({ alloc: {}, act2: 'F' }) },
  { name: '全現鈔', mk: () => ({ alloc: { cash: 20 }, act2: 'A' }) },
  { name: '全美元', mk: () => ({ alloc: { usd: 20 }, act2: 'B' }) },
  { name: '全黃金', mk: () => ({ alloc: { gold: 20 }, act2: 'F' }) },
  { name: '全海外', mk: () => ({ alloc: { global: 20 }, act2: 'B' }) },
  { name: '全物資', mk: () => ({ alloc: { supplies: 20 }, act2: 'E' }) },
  { name: '全台股', mk: () => ({ alloc: { twstock: 20 }, act2: 'G' }) },
  { name: '全還債', mk: (d) => ({ alloc: d ? { prepay: 20 } : {}, act2: d ? 'D' : 'F' }) },
  { name: '均衡', mk: (d) => ({ alloc: { cash: 4, usd: 3, gold: 3, supplies: 3, global: 3, ...(d ? { prepay: 2 } : { twstock: 2 }) }, buyNonfin: ['power'], act2: 'F' as Act2Key }) },
  { name: '均衡2', mk: (d) => ({ alloc: { cash: 5, usd: 4, gold: 4, global: 4, ...(d ? { prepay: 3 } : { twstock: 3 }) }, act2: 'A' as Act2Key }) },
];
const combos: number[][] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let e = 1; e <= 6; e++) combos.push([a, b, c, e]);

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length * 2 + (s.match(/[ -~]/g)?.length || 0)));
for (const role of ROLES) {
  console.log(`\n== ${role.name} ==   ${DIMENSIONS.map((d) => d.name).join('  ')}  總分  結局分布`);
  const rows: [string, number][] = [];
  for (const st of S) {
    const base = st.mk(!!role.debt);
    const acc = { survival: 0, liquidity: 0, purchasing: 0, debt: 0, recovery: 0 };
    const ends: Record<string, number> = {};
    let surv = 0;
    for (const w of [0, 1, 2]) for (const [r2, m1, m2, m3] of combos) {
      const d: Decisions = { ...base, act2Roll: r2, act2Opt: false, rolls: [m1, m2, m3], opts: [m1 === 5, m2 === 5, m3 === 5] };
      const g = runGame(role, d, { bankRun: false, world: w }, { finish: true });
      for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += g.scores![k];
      ends[g.ending!.name] = (ends[g.ending!.name] || 0) + 1;
      surv += g.survivalMonths;
    }
    const n = combos.length * 3;
    const vals = Object.values(acc).map((v) => Math.round(v / n));
    const tot = vals.reduce((a, b) => a + b, 0);
    rows.push([st.name, tot]);
    const endStr = Object.entries(ends).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}${Math.round((v / n) * 100)}%`).join(' ');
    console.log(`${st.name.padEnd(4, '　')} 生存期${(surv / n).toFixed(1).padStart(5)}月 | ${vals.map((v) => String(v).padStart(4)).join(' ')} | ${String(tot).padStart(4)} | ${endStr}`);
  }
  rows.sort((a, b) => b[1] - a[1]);
  console.log(`  最佳：${rows[0][0]}(${rows[0][1]})  次佳：${rows[1][0]}(${rows[1][1]})  最差：${rows.at(-1)![0]}(${rows.at(-1)![1]})`);
}
