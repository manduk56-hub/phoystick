import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw Error('연결 서버를 사용할 수 없습니다.');
  return env.DB;
}
