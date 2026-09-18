import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DEAD SIGNAL | 모션 생존 슈팅',
  description: '스마트폰을 컨트롤러로 사용하는 몬스터 생존 슈팅 게임',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
