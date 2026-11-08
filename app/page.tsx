'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBackend, firebaseConfigured } from '@/lib/backend';

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = new URLSearchParams(location.search).get('room');
    if (c) setCode(c.toUpperCase());
    try { setName(localStorage.getItem('rg-name') || ''); } catch {}
  }, []);

  const join = async () => {
    setErr(''); setBusy(true);
    try {
      const c = code.trim().toUpperCase();
      const be = getBackend();
      if (!(await be.roomExists(c))) throw new Error('找不到這個房間，請確認房間碼。');
      await be.join(c, name.trim());
      try { localStorage.setItem('rg-name', name.trim()); } catch {}
      router.push(`/play/${c}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  const host = async () => {
    setBusy(true);
    try { const c = await getBackend().createRoom(); router.push(`/host/${c}`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="wrap">
      <div style={{ paddingTop: 28 }} className="center">
        <div style={{ fontSize: 48 }}>🧭</div>
        <div className="kicker">讀書會遊戲</div>
        <h1>地緣風險理財課</h1>
        <p className="muted">財務韌性生存模擬</p>
      </div>

      <div className="card">
        <h3>加入房間</h3>
        <label className="small muted">房間碼</label>
        <input className="input code" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" />
        <div style={{ height: 10 }} />
        <label className="small muted">暱稱</label>
        <input className="input" maxLength={12} value={name} onChange={(e) => setName(e.target.value)} placeholder="你的暱稱" />
        <div style={{ height: 14 }} />
        <button className="btn primary block" disabled={busy || code.length !== 4 || !name.trim()} onClick={join}>加入</button>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      </div>

      <div className="card soft">
        <h3>我是主持人</h3>
        <p className="small muted">在電腦上建立房間並投影到大螢幕。</p>
        <button className="btn block" disabled={busy} onClick={host}>建立房間</button>
      </div>

      <blockquote className="small muted center" style={{ margin: '24px 8px' }}>
        如果原本習以為常的金融系統突然不能使用，<br />我還剩下多少選擇權？
      </blockquote>
      {!firebaseConfigured && (
        <p className="small muted center">
          本機示範模式：尚未設定 Firebase，房間只在這個瀏覽器內同步。<br />可開多個分頁模擬多位玩家。
        </p>
      )}
    </div>
  );
}
