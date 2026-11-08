// 遊戲數學層（Draft 0.2 暫定數值）
// 純函式、無外部相依：玩家端、主持人端與模擬腳本共用同一套計算。
// 所有數值單位皆為 WP（Wealth Points）＝角色整體財務資源比例，不是新台幣金額。

export type AssetKey =
  | 'cash' | 'deposit' | 'usd' | 'twstock' | 'global' | 'gold' | 'property' | 'supplies';

export const ASSET_KEYS: AssetKey[] = [
  'cash', 'deposit', 'usd', 'twstock', 'global', 'gold', 'property', 'supplies',
];

export const ASSETS: Record<AssetKey, { name: string; icon: string; note: string }> = {
  cash: { name: '台幣現鈔', icon: '💵', note: '即時、小額支付' },
  deposit: { name: '銀行存款', icon: '🏦', note: '平時方便、安全' },
  usd: { name: '美元現鈔', icon: '💲', note: '跨幣別分散、實體持有' },
  twstock: { name: '台灣股票', icon: '📈', note: '長期成長' },
  global: { name: '全球／海外資產', icon: '🌍', note: '地域與市場分散' },
  gold: { name: '黃金', icon: '🥇', note: '保值、實體資產' },
  property: { name: '房地產', icon: '🏠', note: '實質資產' },
  supplies: { name: '生存物資', icon: '🎒', note: '危機期間直接使用' },
};

export type NonFin = 'firstaid' | 'vehicle' | 'network' | 'meds' | 'power' | 'docs' | 'plan';

export const NONFIN: Record<NonFin, { name: string; icon: string; effect: string }> = {
  firstaid: { name: '急救能力', icon: '🩹', effect: '醫療事件損失減半' },
  vehicle: { name: '交通工具', icon: '🚗', effect: '撤離成本減半' },
  network: { name: '互助網絡', icon: '🤝', effect: '資源不足時親友支援一次；互助事件獲得物資' },
  meds: { name: '必要藥物準備', icon: '💊', effect: '抵銷家人慢性用藥的支出增加' },
  power: { name: '備援電源', icon: '🔋', effect: '停電斷網時仍保有部分數位金融' },
  docs: { name: '重要文件', icon: '📁', effect: '撤離或復原時更快重建生活' },
  plan: { name: '家庭聯絡計畫', icon: '📞', effect: '危機中減少混亂成本（每月需求 −5%）' },
};

export const NONFIN_COST = 2;

export interface Role {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  story: string;
  assets: Record<AssetKey, number>; // 既有人生：合計 80，另 20 為調整權（未使用則留在銀行存款）
  L: number; // 每月最低生存支出（WP/月）
  income: number; // 正常月收入（WP/月）
  incomeFactors: [number, number, number]; // 第四幕 Month1-3 收入比例
  debt: { name: string; principal: number; payment: number } | null;
  nonfin: NonFin[];
}

const A = (p: Partial<Record<AssetKey, number>>): Record<AssetKey, number> => ({
  cash: 0, deposit: 0, usd: 0, twstock: 0, global: 0, gold: 0, property: 0, supplies: 0, ...p,
});

export const ROLES: Role[] = [
  {
    id: 'salary', name: '月光上班族', emoji: '🧑‍💼', tagline: '收入穩定，每個月剛好花完',
    story: '你在科技業擔任行政，薪水準時入帳。手機裡有三個購物 App、一筆還在繳的信貸。存款不多，但你總覺得「下個月再存就好」。',
    assets: A({ cash: 5, deposit: 45, twstock: 20, global: 8, supplies: 2 }),
    L: 12, income: 20, incomeFactors: [0.4, 0.4, 0.8],
    debt: { name: '信用貸款', principal: 60, payment: 3 },
    nonfin: ['network'],
  },
  {
    id: 'homeowner', name: '高槓桿屋主', emoji: '🏠', tagline: '在蛋黃區買下夢想的家',
    story: '五年前你咬牙買下市區的房子，房價漲了不少，親友都說你眼光好。每個月第一件事就是繳房貸，剩下的錢慢慢存、偶爾買點股票。',
    assets: A({ cash: 2, deposit: 13, twstock: 10, global: 5, property: 50 }),
    L: 2.5, income: 4, incomeFactors: [0.5, 0.5, 0.8],
    debt: { name: '房屋貸款', principal: 45, payment: 1.6 },
    nonfin: ['vehicle'],
  },
  {
    id: 'family', name: '雙薪育兒家庭', emoji: '👨‍👩‍👧', tagline: '兩份薪水，三張嘴，一隻貓',
    story: '你和伴侶都有不錯的工作，孩子剛上小學，長輩偶爾需要照顧。家裡有車、有房貸，行事曆永遠排得滿滿的。',
    assets: A({ cash: 3, deposit: 20, twstock: 12, global: 5, gold: 2, property: 35, supplies: 3 }),
    L: 3.5, income: 6, incomeFactors: [0.5, 0.6, 0.9],
    debt: { name: '房屋貸款', principal: 30, payment: 1.4 },
    nonfin: ['vehicle', 'docs'],
  },
  {
    id: 'saver', name: '穩健存款族', emoji: '🏦', tagline: '定存是最好的安眠藥',
    story: '你在公家機關服務多年，習慣把錢放在銀行定存，覺得股票像賭博。沒有負債，存摺數字讓你很安心。',
    assets: A({ cash: 5, deposit: 65, usd: 2, twstock: 3, gold: 2, supplies: 3 }),
    L: 2.5, income: 4.5, incomeFactors: [0.6, 0.6, 0.9],
    debt: null,
    nonfin: ['meds'],
  },
  {
    id: 'investor', name: '積極投資族', emoji: '📈', tagline: '錢要去工作，不能睡覺',
    story: '你每天開盤前看財經新聞，持股橫跨半導體與 ETF，報酬率一直領先同事。現金？放著只會被通膨吃掉。',
    assets: A({ cash: 2, deposit: 12, usd: 3, twstock: 45, global: 15, gold: 3 }),
    L: 3.5, income: 8, incomeFactors: [0.5, 0.5, 0.8],
    debt: { name: '信用貸款', principal: 20, payment: 0.8 },
    nonfin: ['firstaid'],
  },
  {
    id: 'globalist', name: '全球配置族', emoji: '🌍', tagline: '雞蛋放在世界各地的籃子',
    story: '你在外商工作，透過海外券商配置美股與全球 ETF。手機一滑就能跨國下單，你相信分散就是最好的保護。',
    assets: A({ cash: 2, deposit: 15, usd: 3, twstock: 10, global: 45, gold: 3, supplies: 2 }),
    L: 2.5, income: 4.4, incomeFactors: [0.3, 0.3, 0.7],
    debt: null,
    nonfin: ['docs'],
  },
  {
    id: 'freelancer', name: '自由工作者', emoji: '🎨', tagline: '收入像天氣，所以習慣帶傘',
    story: '你接案設計與教學，好的月份收入翻倍，差的月份幾乎掛零。多年下來你習慣手邊放現金、家裡備著電源和物資。',
    assets: A({ cash: 10, deposit: 35, usd: 5, twstock: 10, global: 10, gold: 5, supplies: 5 }),
    L: 4, income: 7, incomeFactors: [0.2, 0.4, 0.7],
    debt: null,
    nonfin: ['power', 'plan'],
  },
];

export const roleById = (id?: string | null) => ROLES.find((r) => r.id === id);

// ─── 第一幕：20 點調整 ───────────────────────────────
export type AllocKey = 'cash' | 'deposit' | 'usd' | 'twstock' | 'global' | 'gold' | 'supplies' | 'prepay';
export const ALLOC_KEYS: AllocKey[] = ['cash', 'deposit', 'usd', 'twstock', 'global', 'gold', 'supplies', 'prepay'];
export const ALLOC_LABEL: Record<AllocKey, string> = {
  cash: '提領台幣現鈔', deposit: '增加銀行存款', usd: '換美元現鈔', twstock: '加碼台股',
  global: '增加全球資產', gold: '購買黃金', supplies: '準備緊急物資', prepay: '提前償還債務',
};
export const ADJUST_POINTS = 20;

// ─── 第二幕：擇一行動 ─────────────────────────────────
export type Act2Key = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const ACT2_OPTIONS: Record<Act2Key, { title: string; desc: string }> = {
  A: { title: '提款增加現鈔', desc: '從存款提領 8 點放在身邊' },
  B: { title: '增加美元／海外配置', desc: '存款 8 點：美元現鈔 4、海外資產 4' },
  C: { title: '降低投資曝險', desc: '賣出 8 點股票（市場已跌 10%）轉回存款' },
  D: { title: '提前償還部分債務', desc: '用存款 8 點提前還款' },
  E: { title: '補充家庭物資', desc: '存款 8 點買物資（搶購潮，只買到 6 點）' },
  F: { title: '保持原配置', desc: '不做任何改變' },
  G: { title: '趁市場下跌增加投資', desc: '存款 8 點以九折價格加碼台股' },
};
export const ACT2_KEYS = Object.keys(ACT2_OPTIONS) as Act2Key[];

export interface EventCard {
  title: string;
  story: string;
  choice?: { yes: string; no: string };
}

export const ACT2_EVENTS: EventCard[] = [
  { title: '公司宣布暫停獎金', story: '景氣不明，公司凍結年終與績效獎金。危機期間你的收入會再少一成。' },
  { title: '家人生病，需要固定藥物', story: '家人確診慢性病，之後每個月都要固定用藥。危機期間每月支出增加 15%。' },
  { title: '收到意外獎金', story: '之前的專案獎金入帳了！銀行存款 +4。' },
  { title: '投資市場短暫反彈', story: '股市一週內反彈，你的台股部位上漲 10%。' },
  { title: '出現海外投資機會', story: '朋友推薦一檔海外基金，要你從存款撥 5 點進去。', choice: { yes: '投資 5 點', no: '先觀望' } },
  { title: '沒有特殊事件', story: '這段時間你的生活很平靜。平靜本身，有時候也是一種運氣。' },
];

export const ACT4_EVENTS: EventCard[] = [
  { title: '醫療事件', story: '家人在混亂中跌傷，需要就醫與照護。本月需求增加半個月生活費。' },
  { title: '債務事件', story: '銀行寄來通知：利率上調、寬限期即將結束。之後每月還款增加 20%。' },
  { title: '通膨事件', story: '物流中斷，超市貨架半空，價格又漲了一輪。本月生活費再 ×1.25。' },
  { title: '停電／斷網', story: '整區停電、行動網路中斷。本月無法使用網銀、ATM 與海外帳戶。' },
  { title: '撤離機會', story: '外縣市的親戚願意收留你一家人，但要花一筆交通與安置費用（1 個月生活費）。', choice: { yes: '撤離', no: '留下' } },
  { title: '互助網絡事件', story: '社區開始組織互助。', choice: { yes: '分出半個月物資幫助鄰居', no: '先顧好自己' } },
];

// ─── 迷思快問快答 ───────────────────────────────────
export const QUIZ = [
  { q: '戰爭發生後，房貸可能就不用還了？', a: '不會。債務契約不會因危機自動消失，金融系統恢復時繳款通知會一起回來。' },
  { q: '銀行有 NT$300 萬，就等於有 NT$300 萬緊急預備金？', a: '不等於。若提款與網銀受限，帳上的錢不等於當下能用的錢。' },
  { q: '美元銀行存款與美元現鈔在極端情境下具有相同功能？', a: '不同。美元存款仍依賴銀行系統，現鈔則是實體持有，但也有保管與兌換問題。' },
  { q: '黃金可以抗通膨，所以也很適合日常小額支付？', a: '不適合。黃金能保值，但切割、鑑價與找到買家都需要成本。' },
  { q: '房地產是實質資產，所以任何危機中都安全？', a: '不一定。房產流動性低、可能受物理損害，危機中也很難快速變現。' },
  { q: '海外資產位於不同市場，所以一定能立即動用？', a: '不一定。跨境資產依賴網路、券商與匯款通道，任何一環中斷都可能動不了。' },
];

// ─── 玩家決策（存於後端的唯一遊戲資料） ─────────────
export interface Decisions {
  alloc?: Partial<Record<AllocKey, number>>;
  buyNonfin?: NonFin[];
  act2?: Act2Key;
  act2Roll?: number; // 1-6
  act2Opt?: boolean;
  rolls?: (number | null)[]; // 第四幕 Month 1-3
  opts?: (boolean | null)[];
}

export interface Ctx {
  bankRun: boolean;
  world?: number; // 第五幕世界情境 0-2
}

// ─── 規則參數 ───────────────────────────────────────
// 第三幕與第四幕每月「可動用率」及「變現率」
const MONTH_COST = [1.0, 1.5, 1.3];
const DEPOSIT_ACCESS = [0.2, 0.3, 0.7]; // 每月可提領存款比例（擠兌時前兩期減半）
const GLOBAL_ACCESS = [0, 0.2, 0.5];
const STOCK_ACCESS = [0, 0, 0.5];
const STOCK_PRICE = [0.7, 0.7, 0.75];
const USD_RATE = 0.75; // 美元現鈔用於日常支付的折損（找不到地方換、匯差大）
// 家中實體財物（台幣現鈔＋美元現鈔＋黃金）超過此值的部分，第三幕損失 STASH_LOSS（竊盜、詐騙、保管）
export const STASH_SAFE = 20;
const STASH_LOSS = 0.3;
const GOLD_RATE = [0.75, 0.75, 0.85];
// 第五幕：主持人抽出「重新開機後的世界」。沒有人事先知道是哪一種，
// 因此押注單一資產在某些世界會失利——避險不等於押注。
export interface World { id: number; name: string; story: string; real: Record<AssetKey, number>; debtReal: number }
export const WORLDS: World[] = [
  {
    id: 0, name: '台幣大幅貶值', story: '危機過後台幣大幅走貶，進口物價高漲。外幣與實體資產相對保值，台幣存款的購買力明顯縮水。',
    real: { cash: 0.75, deposit: 0.75, usd: 1.12, twstock: 0.95, global: 1.12, gold: 1.12, property: 0.9, supplies: 0.4 }, debtReal: 0.75,
  },
  {
    id: 1, name: '快速復甦', story: '市場迅速反彈，企業恢復獲利，股市率先回到危機前水準。避險資產回落，美元與黃金溢價消失。',
    real: { cash: 0.92, deposit: 0.92, usd: 0.85, twstock: 1.25, global: 1.15, gold: 0.8, property: 1.0, supplies: 0.3 }, debtReal: 0.92,
  },
  {
    id: 2, name: '長期停滯', story: '經濟陷入漫長低迷，房市成交冷清、股市盤整。物價維持高檔，黃金與保守資產相對穩定。',
    real: { cash: 0.85, deposit: 0.85, usd: 1.0, twstock: 0.8, global: 0.95, gold: 1.1, property: 0.75, supplies: 0.5 }, debtReal: 0.85,
  },
];

export type Holdings = Record<AssetKey, number>;

export interface AccessRow { key: AssetKey; held: number; access: number; reason: string }

export interface MonthLedger {
  month: number; // 1-6
  need: number;
  income: number;
  debtDue: number;
  paidFrom: Partial<Record<AssetKey | 'network', number>>;
  unmet: number;
  notes: string[];
  event?: number; // 1-6
  holdingsAfter: Holdings;
}

export interface Scores {
  survival: number; liquidity: number; purchasing: number; debt: number; recovery: number;
}

export const DIMENSIONS: { key: keyof Scores; name: string }[] = [
  { key: 'survival', name: '生存力' },
  { key: 'liquidity', name: '流動性' },
  { key: 'purchasing', name: '購買力' },
  { key: 'debt', name: '債務安全' },
  { key: 'recovery', name: '復原力' },
];

export interface GameResult {
  role: Role;
  afterAct1: Holdings;
  afterAct2: Holdings;
  nonfin: NonFin[];
  principal: number;
  payment: number;
  initialPayment: number;
  hadDebt: boolean;
  act2Notes: string[];
  stashLoss: number;
  incomeMod: number;
  needMod: number;
  access: AccessRow[];
  owned: number;
  accessible: number;
  survivalMonths: number;
  months: MonthLedger[]; // 第四幕已擲骰的月份
  summary456?: MonthLedger; // 第五幕：第 4-6 個月濃縮結算
  finalHoldings?: Holdings;
  finalNet?: number;
  refNet?: number;
  forcedLoan: number;
  recoveryBonus: number;
  scores?: Scores;
  ending?: Ending;
}

const sum = (h: Partial<Record<string, number>>) => Object.values(h).reduce((a: number, b) => a + (b || 0), 0);
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
export const r1 = (x: number) => Math.round(x * 10) / 10;

function take(h: Holdings, key: AssetKey, amt: number) {
  const t = Math.min(h[key], Math.max(0, amt));
  h[key] -= t;
  return t;
}

export function allocUsed(d: Decisions) {
  return sum(d.alloc || {}) + (d.buyNonfin?.length || 0) * NONFIN_COST;
}

export function runGame(role: Role, d: Decisions, ctx: Ctx, opts: { act4Months?: number; finish?: boolean; ref?: number } = {}): GameResult {
  // ── 第一幕
  const h: Holdings = { ...role.assets };
  const alloc = d.alloc || {};
  const used = allocUsed(d);
  const leftover = Math.max(0, ADJUST_POINTS - used);
  h.deposit += leftover;
  let principal = role.debt?.principal || 0;
  const basePrincipal = principal;
  for (const k of ALLOC_KEYS) {
    const v = alloc[k] || 0;
    if (k === 'prepay') principal = Math.max(0, principal - v);
    else h[k] += v;
  }
  const nonfin = Array.from(new Set([...role.nonfin, ...(d.buyNonfin || [])]));
  const payFor = (p: number) => (role.debt && basePrincipal > 0 ? role.debt.payment * (p / basePrincipal) : 0);
  const afterAct1 = { ...h };

  // ── 第二幕
  const act2Notes: string[] = [];
  let incomeMod = 0;
  let needMod = 0;
  switch (d.act2) {
    case 'A': h.cash += take(h, 'deposit', 8); break;
    case 'B': { const t = take(h, 'deposit', 8); h.usd += t / 2; h.global += t / 2; break; }
    case 'C': {
      let t = take(h, 'twstock', 8);
      if (t < 8) t += take(h, 'global', 8 - t);
      h.deposit += t * 0.9;
      break;
    }
    case 'D': { const t = Math.min(principal, h.deposit, 8); h.deposit -= t; principal -= t; break; }
    case 'E': h.supplies += take(h, 'deposit', 8) * 0.75; break;
    case 'G': h.twstock += take(h, 'deposit', 8) / 0.9; break;
  }
  switch (d.act2Roll) {
    case 1: incomeMod -= 0.1; break;
    case 2:
      if (nonfin.includes('meds')) act2Notes.push('你已有必要藥物準備，用藥支出沒有增加。');
      else needMod += 0.15;
      break;
    case 3: h.deposit += 4; break;
    case 4: h.twstock *= 1.1; break;
    case 5: if (d.act2Opt) h.global += take(h, 'deposit', 5); break;
  }
  const payment0 = payFor(principal);
  const afterAct2 = { ...h };

  // ── 第三幕：資產翻牌
  // 保管風險：大量實體財物放在家中，成為竊盜與詐騙目標
  const stash = h.cash + h.usd + h.gold;
  let stashLoss = 0;
  if (stash > STASH_SAFE) {
    stashLoss = (stash - STASH_SAFE) * STASH_LOSS;
    const f = 1 - stashLoss / stash;
    h.cash *= f; h.usd *= f; h.gold *= f;
  }
  const depAccess = ctx.bankRun ? DEPOSIT_ACCESS[0] / 2 : DEPOSIT_ACCESS[0];
  const access: AccessRow[] = ASSET_KEYS.map((key) => {
    const held = h[key];
    let a = 0; let reason = '';
    switch (key) {
      case 'cash': a = held; reason = '實體現金，立即可用'; break;
      case 'deposit': a = held * depAccess; reason = ctx.bankRun ? 'ATM 限額＋擠兌，只能領出 10%' : 'ATM 限額，只能領出 20%'; break;
      case 'usd': a = held * USD_RATE; reason = '可用，但日常支付要折價兌換'; break;
      case 'twstock': a = 0; reason = '市場暫停交易'; break;
      case 'global': a = 0; reason = '跨境交易與網路中斷'; break;
      case 'gold': a = held * GOLD_RATE[0]; reason = '可變現，但小額支付要折價'; break;
      case 'property': a = 0; reason = '無法快速出售'; break;
      case 'supplies': a = held; reason = '直接使用'; break;
    }
    return { key, held, access: a, reason };
  });
  const owned = sum(h);
  const accessible = sum(Object.fromEntries(access.map((r) => [r.key, r.access])));
  const survivalMonths = accessible / role.L;

  const res: GameResult = {
    role, afterAct1, afterAct2, nonfin, principal, payment: payment0, initialPayment: payFor(basePrincipal),
    hadDebt: !!role.debt, stashLoss, act2Notes, incomeMod, needMod, access, owned, accessible, survivalMonths,
    months: [], forcedLoan: 0, recoveryBonus: 0,
  };

  // ── 第四幕：撐過 90 天
  let payment = payment0;
  let deferred = 0;
  let networkUsed = false;
  let anyMissed = false;
  const planMod = nonfin.includes('plan') ? -0.05 : 0;
  const rolls = d.rolls || [];
  const optsArr = d.opts || [];
  const months = Math.min(opts.act4Months ?? 3, 3);

  const payNeed = (
    need: number, costMult: number, rates: Record<AssetKey, { cap: number; rate: number }>, ledger: MonthLedger,
  ) => {
    let remaining = need;
    // 物資以和平時期價格購入，危機中依物價倍數抵用
    for (const key of ['supplies', 'cash', 'usd', 'deposit', 'gold', 'global', 'twstock'] as AssetKey[]) {
      if (remaining <= 0.0001) break;
      const { cap, rate } = rates[key];
      const mult = key === 'supplies' ? costMult : rate;
      if (mult <= 0) continue;
      const maxUnits = Math.min(h[key], cap);
      const units = Math.min(maxUnits, remaining / mult);
      if (units <= 0) continue;
      h[key] -= units;
      remaining -= units * mult;
      ledger.paidFrom[key] = (ledger.paidFrom[key] || 0) + units * mult;
    }
    return Math.max(0, remaining);
  };

  for (let m = 0; m < months; m++) {
    const roll = rolls[m] ?? null;
    if (roll == null) break;
    const opt = optsArr[m] ?? false;
    const costMult = MONTH_COST[m];
    const ledger: MonthLedger = {
      month: m + 1, need: 0, income: 0, debtDue: 0, paidFrom: {}, unmet: 0, notes: [], event: roll, holdingsAfter: h,
    };
    let need = role.L * costMult * (1 + needMod + planMod);
    let income = role.income * Math.max(0, role.incomeFactors[m] + incomeMod);
    let dep = ctx.bankRun && m === 0 ? DEPOSIT_ACCESS[0] / 2 : DEPOSIT_ACCESS[m];
    let glob = GLOBAL_ACCESS[m];
    let stock = STOCK_ACCESS[m];
    let extraNeed = 0;

    switch (roll) {
      case 1: {
        const c = role.L * 0.5 * (nonfin.includes('firstaid') ? 0.5 : 1);
        extraNeed += c;
        ledger.notes.push(nonfin.includes('firstaid') ? `你的急救能力讓醫療支出減半（+${r1(c)}）。` : `醫療支出 +${r1(c)}。`);
        break;
      }
      case 2:
        if (principal > 0) { payment *= 1.2; ledger.notes.push('之後每月還款增加 20%。'); }
        else ledger.notes.push('你沒有負債，這張卡對你沒有影響。');
        break;
      case 3: need *= 1.25; ledger.notes.push('本月生活費再 ×1.25。'); break;
      case 4:
        if (nonfin.includes('power')) { dep /= 2; glob /= 2; stock /= 2; ledger.notes.push('備援電源讓你保有一半的數位金融能力。'); }
        else { dep = 0; glob = 0; stock = 0; ledger.notes.push('本月網銀、ATM 與海外帳戶全部無法使用。'); }
        break;
      case 5:
        if (opt) {
          const c = role.L * (nonfin.includes('vehicle') ? 0.5 : 1);
          extraNeed += c;
          res.recoveryBonus += 8 + (nonfin.includes('docs') ? 4 : 0);
          ledger.notes.push(`你決定撤離（花費 ${r1(c)}），之後重建生活會更順利。`);
        } else if (h.property > 0) {
          h.property *= 0.9;
          ledger.notes.push('你選擇留下，房屋在混亂中受損，價值 −10%。');
        } else ledger.notes.push('你選擇留下。');
        break;
      case 6:
        if (nonfin.includes('network')) { h.supplies += role.L; ledger.notes.push(`互助網絡送來物資 +${r1(role.L)}。`); }
        if (opt) {
          extraNeed += role.L * 0.5;
          if (!nonfin.includes('network')) nonfin.push('network');
          res.recoveryBonus += 3;
          ledger.notes.push('你幫助了鄰居，也建立了新的互助網絡。');
        }
        break;
    }

    // 債務：前兩個月因金融凍結暫緩扣款，第三個月一次回來
    let debtDue = 0;
    if (m < 2) deferred += payment;
    else { debtDue = deferred + payment; deferred = 0; if (principal > 0) ledger.notes.push('📬 貸款繳款通知：前兩個月暫緩的款項一次到期。'); }

    need += extraNeed;
    ledger.need = need; ledger.income = income; ledger.debtDue = debtDue;
    const rates: Record<AssetKey, { cap: number; rate: number }> = {
      supplies: { cap: Infinity, rate: 1 },
      cash: { cap: Infinity, rate: 1 },
      usd: { cap: Infinity, rate: USD_RATE },
      deposit: { cap: h.deposit * dep, rate: 1 },
      gold: { cap: Infinity, rate: GOLD_RATE[m] },
      global: { cap: h.global * glob, rate: 1 },
      twstock: { cap: h.twstock * stock, rate: STOCK_PRICE[m] },
      property: { cap: 0, rate: 0 },
    };
    // 收入先抵生活費與債務，剩餘轉為現金
    let total = need + debtDue - income;
    if (total < 0) { h.cash += -total; total = 0; }
    let unmet = payNeed(total, costMult, rates, ledger);
    if (unmet > 0 && nonfin.includes('network') && !networkUsed) {
      const help = Math.min(unmet, role.L);
      unmet -= help; networkUsed = true;
      ledger.paidFrom.network = help;
      ledger.notes.push(`親友支援你 ${r1(help)}。`);
    }
    if (unmet > 0) {
      anyMissed = true;
      res.forcedLoan += unmet;
      principal += unmet * 1.3;
      payment += unmet * 0.12;
      ledger.notes.push(`資源不足 ${r1(unmet)}，只能借高利貸撐過去。`);
    }
    ledger.unmet = unmet;
    ledger.holdingsAfter = { ...h };
    res.months.push(ledger);
  }
  res.principal = principal; res.payment = payment;

  // ── 第五幕：第 4-6 個月濃縮結算＋世界重新開機
  if (opts.finish && res.months.length === 3) {
    const ledger: MonthLedger = {
      month: 4, need: 0, income: 0, debtDue: 0, paidFrom: {}, unmet: 0, notes: [], holdingsAfter: h,
    };
    const need = role.L * 1.2 * (1 + needMod + planMod) * 3;
    const income = role.income * Math.min(1, role.incomeFactors[2] + 0.15 + incomeMod) * 3;
    const debtDue = payment * 3;
    ledger.need = need; ledger.income = income; ledger.debtDue = debtDue;
    let total = need + debtDue - income;
    if (total < 0) { h.cash += -total; total = 0; }
    const rates: Record<AssetKey, { cap: number; rate: number }> = {
      supplies: { cap: Infinity, rate: 1 }, cash: { cap: Infinity, rate: 1 },
      deposit: { cap: Infinity, rate: 1 }, usd: { cap: Infinity, rate: 0.97 },
      global: { cap: Infinity, rate: 1 }, gold: { cap: Infinity, rate: 0.95 },
      twstock: { cap: Infinity, rate: 0.9 }, property: { cap: 0, rate: 0 },
    };
    // 系統恢復後依「現金→存款→美元→海外→黃金→股票」順序支付
    let remaining = total;
    for (const key of ['supplies', 'cash', 'deposit', 'usd', 'global', 'gold', 'twstock'] as AssetKey[]) {
      if (remaining <= 0.0001) break;
      const mult = key === 'supplies' ? 1.2 : rates[key].rate;
      const units = Math.min(h[key], remaining / mult);
      h[key] -= units; remaining -= units * mult;
      if (units > 0) ledger.paidFrom[key] = (ledger.paidFrom[key] || 0) + units * mult;
    }
    if (remaining > 0) {
      anyMissed = true;
      res.forcedLoan += remaining;
      principal += remaining * 1.3;
      ledger.notes.push(`資源不足 ${r1(remaining)}，只能再借款。`);
    }
    ledger.unmet = Math.max(0, remaining);
    ledger.holdingsAfter = { ...h };
    res.summary456 = ledger;
    res.principal = principal;

    const finalHoldings = { ...h };
    res.finalHoldings = finalHoldings;
    const world = WORLDS[ctx.world ?? 2];
    const realAssets = ASSET_KEYS.reduce((s, k) => s + finalHoldings[k] * world.real[k], 0);
    res.finalNet = realAssets - principal * world.debtReal;

    // ── 五維韌性
    const allLedgers = [...res.months, ledger];
    const totalNeed = allLedgers.reduce((s, l) => s + l.need + l.debtDue, 0);
    const totalUnmet = allLedgers.reduce((s, l) => s + l.unmet, 0);
    const coverage = 1 - totalUnmet / Math.max(1, totalNeed);
    const survival = clamp(55 * coverage * (totalUnmet > 0 ? 0.75 : 1) + 45 * Math.min(survivalMonths / 6, 1));
    // 流動性只看金融資源（物資算在生存力）
    const finAccess = accessible - (access.find((x) => x.key === 'supplies')?.access || 0);
    const finOwned = owned - afterAct2.supplies;
    const liquidity = clamp((100 * (finAccess / Math.max(1, finOwned))) / 0.4);
    const a2 = afterAct2;
    const resistant = a2.usd * 0.7 + a2.gold + a2.global + a2.supplies * 0.5 + a2.property * 0.5 + a2.twstock * 0.6;
    const purchasing = clamp((100 * (resistant / sum(a2))) / 0.55);
    let debt = 100;
    if (res.hadDebt || res.forcedLoan > 0) {
      const ratio = payment / role.income;
      debt = clamp(100 - ratio * 220 - (anyMissed ? 25 : 0) - Math.min(20, (principal / 100) * 30));
    }
    // 復原力：與「同角色、什麼都不做、沒有意外」的基準比較
    const ref = opts.ref ?? runGame(role, { rolls: [0, 0, 0] }, { ...ctx, bankRun: false }, { finish: true, ref: -1 }).finalNet!;
    res.refNet = ref;
    const recovery = clamp(60 + (res.finalNet - ref) * 2.5 + res.recoveryBonus + (nonfin.includes('docs') ? 3 : 0));
    res.scores = {
      survival: Math.round(survival), liquidity: Math.round(liquidity), purchasing: Math.round(purchasing),
      debt: Math.round(debt), recovery: Math.round(recovery),
    };
    res.ending = pickEnding(res.scores, afterAct2);
  }
  return res;
}

// ─── 結局 ───────────────────────────────────────────
export interface Ending { id: string; icon: string; name: string; desc: string }
export const ENDINGS: Record<string, Ending> = {
  fortress: { id: 'fortress', icon: '🛡️', name: '韌性堡壘', desc: '沒有最高報酬，但沒有單一事件能輕易擊垮你的基本生活。' },
  trapped: { id: 'trapped', icon: '💰', name: '富有但受困', desc: '資產很多，但危機期間因流動性不足失去選擇。' },
  frozen: { id: 'frozen', icon: '🧊', name: '冰封富翁', desc: '帳面資產漂亮，但需要資源時大部分無法即時動用。' },
  tightrope: { id: 'tightrope', icon: '⚖️', name: '債務走鋼索', desc: '你撐過了危機，但固定債務讓收入中斷變得非常危險。' },
  globalist: { id: 'globalist', icon: '🌍', name: '全球分散者', desc: '你沒有集中在單一市場，但發現跨境資產不等於隨時可使用。' },
  survivor: { id: 'survivor', icon: '🎒', name: '生存玩家', desc: '投資績效普通，但混亂期間你擁有很高的自主性。' },
  rebounder: { id: 'rebounder', icon: '🔄', name: '復原高手', desc: '危機期間不一定最舒服，但系統恢復後你保有較多重新開始的能力。' },
};

export function pickEnding(s: Scores, h: Holdings): Ending {
  const total = sum(h);
  const overseas = (h.global + h.usd) / total;
  if (s.debt < 45) return ENDINGS.tightrope;
  if (Object.values(s).every((v) => v >= 60)) return ENDINGS.fortress;
  if (overseas >= 0.35 && s.liquidity < 60) return ENDINGS.globalist;
  if (s.liquidity < 35 && s.recovery >= 60) return ENDINGS.frozen;
  if (s.survival < 60 && s.recovery >= 50) return ENDINGS.trapped;
  if (s.survival >= 70 && s.recovery < 55) return ENDINGS.survivor;
  if (s.recovery >= 65) return ENDINGS.rebounder;
  const best = (Object.entries(s) as [keyof Scores, number][]).sort((a, b) => b[1] - a[1])[0][0];
  return best === 'survival' || best === 'liquidity' ? ENDINGS.survivor : best === 'recovery' ? ENDINGS.rebounder : ENDINGS.fortress;
}

// ─── 幕次（狀態機） ─────────────────────────────────
export type Phase =
  | 'lobby' | 'role' | 'act1' | 'act2' | 'act3' | 'survival' | 'act4' | 'act5' | 'report' | 'personal';

export const PHASES: Phase[] = ['lobby', 'role', 'act1', 'act2', 'act3', 'survival', 'act4', 'act5', 'report', 'personal'];

export const PHASE_INFO: Record<Phase, {
  label: string; act?: number; title: string; question: string; scene: string[]; ticker: string[];
  learn: string; discuss: string[];
}> = {
  lobby: { label: '等候室', title: '等待玩家加入', question: '掃描 QR Code 加入房間', scene: [], ticker: [], learn: '', discuss: [] },
  role: {
    label: '角色揭曉', title: '你是誰？', question: '閱讀你的角色卡',
    scene: ['每個人都已經有工作、家庭、資產與負債。', '你不能重來一次人生，只能在既有的基礎上做選擇。'],
    ticker: ['今日股市小漲 0.3%', '颱風季結束，菜價回穩', '央行：金融體系穩健'],
    learn: '100 Wealth Points 代表你整體財務資源的結構比例，不是新台幣 100 萬元。',
    discuss: ['你的角色和你自己像嗎？哪裡像？'],
  },
  act1: {
    label: '和平配置', act: 1, title: '第一幕｜平靜日常', question: '我現在怎麼準備？',
    scene: ['工作、股市、ATM、交通一切正常。', '但國際新聞中，關於區域緊張的報導越來越多。'],
    ticker: ['國際智庫：區域衝突風險上升', '台股創今年新高', '週末百貨公司周年慶人潮湧現'],
    learn: '平時理財追求報酬，韌性理財則是用一點成本換取未來的選擇權。兩者不衝突，但需要取捨。',
    discuss: ['為什麼你願意（或不願意）現在付出成本準備？', '「準備」和「浪費」的界線在哪裡？'],
  },
  act2: {
    label: '警訊決策', act: 2, title: '第二幕｜風聲漸起', question: '要不要提前行動？',
    scene: ['區域情勢升溫，周邊展開大規模軍事演訓。', '金融市場波動加劇，社群出現大量提款與換匯討論。', 'ATM、銀行與網銀仍然正常。'],
    ticker: ['台股盤中重挫 4%', '網友熱議：要不要先把錢領出來？', '匯率劇烈波動', '超市衛生紙、泡麵銷量暴增'],
    learn: '提早行動可以保住流動性，但也可能賣在低點、買在高點。風險、報酬與流動性永遠是三角取捨。',
    discuss: ['現在行動，是準備，還是恐慌？', '如果每個人都去提款，會發生什麼事？'],
  },
  act3: {
    label: '金融冰封', act: 3, title: '第三幕｜金融冰封', question: '我的錢真的能用嗎？',
    scene: ['網銀無法正常登入。', 'ATM 提款受限。', '電子支付不穩定。', '部分金融市場暫停交易。'],
    ticker: ['⚠ 金融服務異常', '⚠ ATM 每日提領上限下修', '⚠ 證券市場暫停交易', '⚠ 跨境匯款延遲'],
    learn: '擁有權 ≠ 動用權。銀行存款沒有消失，但危機當下「能不能拿到」才是真正的問題。',
    discuss: ['銀行存款消失了嗎？', '如果沒有，真正發生的問題是什麼？'],
  },
  survival: {
    label: '生存期', title: '我能撐多久？', question: '生存期＝可動用資源 ÷ 每月最低生存需求',
    scene: ['冰封持續中。', '問題從「我有多少資產？」變成「我能撐多久？」'],
    ticker: ['政府呼籲民眾保持冷靜', '部分商店僅收現金'],
    learn: '財務生存期（月）＝真正可動用的資源 ÷ 每月最低生存支出。淨資產高的人，生存期不一定長。',
    discuss: ['你的生存期比你預期的長還是短？', '是什麼讓它變短的？'],
  },
  act4: {
    label: '擲骰支線', act: 4, title: '第四幕｜撐過 90 天', question: '我能撐多久？',
    scene: ['Month 1：收入中斷。', 'Month 2：生活成本上升。', 'Month 3：金融系統部分恢復——以及貸款繳款通知。'],
    ticker: ['多家企業宣布無薪假', '食品物價指數年增 50%', '銀行陸續恢復營業', '📬 各銀行寄發繳款通知'],
    learn: '金融系統恢復，也代表債務義務重新清楚地回到生活中。通膨會悄悄吃掉現金的購買力。',
    discuss: ['哪一個月對你最難熬？為什麼？', '哪一項非金融資本幫了你，或你最希望自己有？'],
  },
  act5: {
    label: '復原', act: 5, title: '第五幕｜世界重新開機', question: '我還剩多少選擇權？',
    scene: ['180 天後。', '金融系統逐漸恢復，市場重新交易，工作開始恢復。', '但是，世界已經不是原來的樣子。'],
    ticker: ['股市恢復交易', '物價維持高檔', '房市成交冷清', '企業陸續復工'],
    learn: '危機結束後，能否重新開始，取決於你留下了什麼：資產結構、債務、技能與人際網絡。',
    discuss: ['重新開機後，誰的處境變好了？誰變差了？', '你會想回到第一幕重新配置嗎？會怎麼改？'],
  },
  report: {
    label: '韌性報告', title: '財務韌性報告', question: '誰在危機結束後仍保有最多選擇權？',
    scene: ['沒有第一名。', '每個人都有自己的強項與弱點。'],
    ticker: [],
    learn: '資產淨值，不等於生存能力。擁有權，不等於動用權。避險，不等於押注某一種資產。真正的韌性，是危機發生後仍然保有選擇。',
    discuss: ['你的結局和你預期的一樣嗎？', '哪一個決定影響最大？'],
  },
  personal: {
    label: '個人行動', title: '回到自己', question: '如果只能改善一件事，我會……',
    scene: ['現在，請放下角色。', '在手機上做一次只有你看得到的壓力測試。'],
    ticker: [],
    learn: '你的真實資料只在你的手機上計算，不會上傳。',
    discuss: ['願意分享你的行動卡嗎？（只分享你想說的部分）'],
  },
};
