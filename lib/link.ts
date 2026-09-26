export type Packet = {
  calibration?: number | null;
  x: number;
  y: number;
  events: { id: number; action: string; x: number; y: number }[];
  time: number;
};
export async function api(action: string, data: object = {}) {
  let res: Response;
  try {
    res = await fetch('/api/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new Error(
      '연결을 확인하고 있어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    );
  }
  const r: any = await res.json().catch(() => {
    throw new Error('서버 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');
  });
  if (!res.ok)
    throw Object.assign(Error(r.error || '연결 오류'), { status: res.status });
  return r;
}
export class Link {
  room: { code: string; token: string; version?: number; relayOnly?: boolean };
  role: string;
  rtc: RTCPeerConnection | null = null;
  channel: RTCDataChannel | null = null;
  timer: any;
  stopped = false;
  pending = false;
  remote = false;
  latest: any;
  lastSend = 0;
  lastReceive = Date.now();
  onInput: (p: Packet) => void = () => {};
  onStatus: (p: any) => void = () => {};
  onConnection: (s: string) => void = () => {};
  constructor(
    room: {
      code: string;
      token: string;
      version?: number;
      relayOnly?: boolean;
    },
    role: string,
  ) {
    this.room = room;
    this.role = role;
    this.loop();
  }
  async setup(offer?: any) {
    if (this.rtc) return;
    const pc = (this.rtc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    }));
    const bind = (ch: RTCDataChannel) => {
      this.channel = ch;
      ch.onopen = () => this.onConnection('직접 연결');
      ch.onmessage = (e) => {
        this.lastReceive = Date.now();
        try {
          const p = JSON.parse(e.data);
          this.role === 'host' ? this.onInput(p) : this.onStatus(p);
        } catch {}
      };
      ch.onclose = () => this.onConnection('중계 연결');
    };
    if (this.role === 'host')
      bind(pc.createDataChannel('controls', { ordered: true }));
    else pc.ondatachannel = (e) => bind(e.channel);
    if (offer) await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(
      this.role === 'host' ? await pc.createOffer() : await pc.createAnswer(),
    );
    await Promise.race([
      new Promise<void>((r) => {
        if (pc.iceGatheringState === 'complete') r();
        else
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') r();
          };
      }),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    if (!this.stopped)
      await api(this.role === 'host' ? 'offer' : 'answer', {
        ...this.room,
        data: pc.localDescription,
      });
  }
  send(p: any) {
    this.latest = p;
    if (this.channel?.readyState === 'open')
      this.channel.send(JSON.stringify(p));
  }
  async loop() {
    if (this.stopped) return;
    try {
      if (this.latest && this.channel?.readyState !== 'open')
        await api(this.role === 'host' ? 'status' : 'input', {
          ...this.room,
          data: this.latest,
        });
      const r = await api('read', this.room);
      if (r.version !== (this.room.version || 0)) {
        this.close();
        return;
      }
      if (r.paired && this.room.relayOnly) this.onConnection('중계 연결');
      if (r.paired && !this.rtc && !this.room.relayOnly) {
        this.onConnection('중계 연결');
        if (this.role === 'host') await this.setup();
        else if (r.offer) await this.setup(JSON.parse(r.offer));
      }
      if (this.role === 'host' && r.answer && this.rtc && !this.remote) {
        await this.rtc.setRemoteDescription(JSON.parse(r.answer));
        this.remote = true;
      }
      const raw = this.role === 'host' ? r.input : r.status;
      if (raw && this.channel?.readyState !== 'open') {
        const p = JSON.parse(raw);
        this.lastReceive = p.time || Date.now();
        this.role === 'host' ? this.onInput(p) : this.onStatus(p);
      }
      if (r.paired && Date.now() - this.lastReceive > 6000)
        this.onConnection('연결 확인 중');
    } catch (e) {
      this.onConnection((e as Error).message);
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => this.loop(),
        this.channel?.readyState === 'open' ? 1800 : 140,
      );
  }
  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.channel?.close();
    this.rtc?.close();
  }
}
