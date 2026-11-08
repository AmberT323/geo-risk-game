import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '地緣風險理財課｜財務韌性生存模擬',
  description: '5–7 人讀書會用的財務韌性生存模擬遊戲',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f1419' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
