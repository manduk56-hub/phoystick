import type { Metadata, Viewport } from 'next';
import './globals.css';
import GameMenu from '@/components/game-menu';
export const metadata: Metadata = {
  title: 'DEAD SIGNAL | 모션 생존 슈팅',
  description: '스마트폰을 컨트롤러로 사용하는 몬스터 생존 슈팅 게임',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090d10',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <GameMenu />
        <footer className="site-footer">
          <span>PHOYSTICK</span>
          <a href="/credits">크레딧</a>
        </footer>
      </body>
    </html>
  );
}
