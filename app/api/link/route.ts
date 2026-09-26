import { database } from '@/db/raw';
import { allowedRequestOrigin } from '@/lib/request-origin';
const json = (v: unknown, s = 200) =>
  Response.json(v, { status: s, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req: Request) {
  try {
    if (!allowedRequestOrigin(req))
      return json({ error: '허용되지 않은 요청' }, 403);
    const b: any = await req.json();
    if (!b || typeof b !== 'object') return json({ error: '잘못된 요청' }, 400);
    const db = database();
    if (b.action === 'create') {
      await db
        .prepare('DELETE FROM rooms WHERE expires < ?')
        .bind(Date.now())
        .run();
      for (let i = 0; i < 5; i++) {
        const code = String(
            100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
          ),
          token = crypto.randomUUID();
        const r = await db
          .prepare(
            'INSERT OR IGNORE INTO rooms(code,host,expires,status) VALUES(?,?,?,?)',
          )
          .bind(
            code,
            token,
            Date.now() + 7200000,
            JSON.stringify({
              game: ['fishing', 'racing'].includes(b.game)
                ? b.game
                : 'shooting',
            }),
          )
          .run();
        if (r.meta.changes) return json({ code, token });
      }
      return json({ error: '코드 생성 실패. 다시 시도해 주세요.' }, 503);
    }
    if (!/^\d{6}$/.test(b.code || ''))
      return json({ error: '6자리 코드를 확인하세요.' }, 400);
    const room = await db
      .prepare('SELECT * FROM rooms WHERE code = ? AND expires > ?')
      .bind(b.code, Date.now())
      .first<any>();
    if (!room) return json({ error: '코드가 없거나 만료되었습니다.' }, 404);
    if (b.action === 'join') {
      const roomGame = room.status
        ? JSON.parse(room.status).game || 'shooting'
        : 'shooting';
      if ((b.game || 'shooting') !== roomGame)
        return json(
          {
            error:
              roomGame === 'racing'
                ? '레이싱게임의 코드입니다. 레이싱 컨트롤러에서 연결해 주세요.'
                : roomGame === 'fishing'
                  ? '낚시게임의 코드입니다. 낚시 컨트롤러에서 연결해 주세요.'
                  : '좀비 슈팅의 코드입니다. 슈팅 컨트롤러에서 연결해 주세요.',
          },
          400,
        );
      if (room.phone)
        return json(
          { error: '이미 연결된 폰이 있습니다. PC에서 새 코드를 만드세요.' },
          409,
        );
      const token = crypto.randomUUID();
      const r = await db
        .prepare('UPDATE rooms SET phone=? WHERE code=? AND phone IS NULL')
        .bind(token, b.code)
        .run();
      if (!r.meta.changes) return json({ error: '이미 연결되었습니다.' }, 409);
      return json({
        code: b.code,
        token,
        version: JSON.parse(room.status || '{}')._session?.version || 0,
      });
    }
    const host = b.token === room.host,
      phone = b.token === room.phone && !!room.phone;
    if (!host && !phone) return json({ error: '다시 연결해 주세요.' }, 403);
    const state = JSON.parse(room.status || '{}');
    const session = state._session || {
      game: state.game || 'shooting',
      version: 0,
    };
    if (b.action === 'resume')
      return json({ code: b.code, token: b.token, ...session });
    if (b.action === 'menu') return json(session);
    if (b.action === 'navigate') {
      if (!['shooting', 'fishing', 'racing'].includes(b.game))
        return json({ error: '게임을 선택하세요.' }, 400);
      if (b.version !== session.version)
        return json({ error: '메뉴가 변경되었습니다. 다시 선택하세요.' }, 409);
      if (b.game === session.game) return json(session);
      const next = { game: b.game, version: session.version + 1 };
      const result = await db
        .prepare(
          "UPDATE rooms SET status=?, input=NULL, offer=NULL, answer=NULL WHERE code=? AND COALESCE(json_extract(status, '$._session.version'), 0)=?",
        )
        .bind(
          JSON.stringify({ game: b.game, _session: next }),
          b.code,
          session.version,
        )
        .run();
      if (!result.meta.changes) return json({ error: '다시 선택하세요.' }, 409);
      return json(next);
    }
    if (b.action === 'read')
      return json({
        version: session.version,
        paired: !!room.phone,
        offer: phone ? room.offer : null,
        answer: host ? room.answer : null,
        input: host ? room.input : null,
        status: phone ? room.status : null,
      });
    const column =
      b.action === 'offer' && host
        ? 'offer'
        : b.action === 'answer' && phone
          ? 'answer'
          : b.action === 'input' && phone
            ? 'input'
            : b.action === 'status' && host
              ? 'status'
              : null;
    if (!column) return json({ error: '잘못된 요청' }, 400);
    if ((b.version || 0) !== session.version)
      return json({ error: '게임이 변경되었습니다.' }, 409);
    const value = JSON.stringify(
      b.action === 'status' ? { ...b.data, _session: session } : b.data,
    );
    if (value.length > 20000)
      return json({ error: '요청이 너무 큽니다.' }, 400);
    await db
      .prepare(
        `UPDATE rooms SET ${column}=? WHERE code=? AND COALESCE(json_extract(status, '$._session.version'), 0)=?`,
      )
      .bind(value, b.code, session.version)
      .run();
    return json({ ok: true });
  } catch (error) {
    console.error('link API failure', error);
    return json(
      { error: '연결 서버에 접근하지 못했습니다. 잠시 후 다시 시도하세요.' },
      503,
    );
  }
}
