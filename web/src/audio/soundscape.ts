// Ambience from the public-domain recordings embedded in sounds/, looped
// seamlessly in memory; pink noise is synthesized. Nothing is downloaded from
// the internet.

type StatusCallback = (message: string, error?: boolean) => void;

// Seams that must fall between beats or after a piece ends: start and loop are
// seconds into the decoded file, fade is the crossfade length.
const seams: Record<string, { start: number; loop?: number; fade: number; random?: boolean }> = {
  clock: { start: 0.25, loop: 30.001, fade: 0.15 },
  knock: { start: 0.25, loop: 29.7, fade: 0.15 },
  // The whole Canon, then about two seconds of silence before it starts again.
  musicbox: { start: 0.1, loop: 226.9, fade: 0.2, random: false },
};

interface LoopResult {
  buffer: AudioBuffer;
  random: boolean;
  loopStart: number;
  loopEnd: number;
}

interface SeamMarkers {
  loopStart: number;
  loopEnd: number;
}

// Crossfades the fade seconds after the loop into its first fade seconds, in
// place and at equal power, so playback runs from loopEnd into loopStart
// without a seam. The default start skips the encoder's leading padding.
export function seam(buffer: AudioBuffer, { start = 0.25, loop, fade = 3 }: { start?: number; loop?: number; fade?: number } = {}): SeamMarkers {
  const rate = buffer.sampleRate;
  const a = Math.round(start * rate);
  const f = Math.round(fade * rate);
  const n = loop ? Math.round(loop * rate) : buffer.length - a - f - Math.round(0.25 * rate);
  if (n <= f || a + n + f > buffer.length) throw new Error(`循环超出录音长度：${buffer.duration.toFixed(2)} 秒`);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < f; i++) {
      const angle = (Math.PI / 2) * (i / f);
      data[a + n + i] = data[a + n + i] * Math.cos(angle) + data[a + i] * Math.sin(angle);
    }
  }
  return { loopStart: (a + f) / rate, loopEnd: (a + n + f) / rate };
}

// Pink noise (Paul Kellet's filter) from a fixed seed: 18 s, seamed like the recordings.
function pink(context: BaseAudioContext): LoopResult {
  const rate = context.sampleRate;
  const length = Math.round(rate * 18);
  const buffer = context.createBuffer(2, length, rate);
  let seed = 211;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const noise = random() * 2 - 1;
      b0 = 0.99886 * b0 + noise * 0.0555179;
      b1 = 0.99332 * b1 + noise * 0.0750759;
      b2 = 0.96900 * b2 + noise * 0.153852;
      b3 = 0.8665 * b3 + noise * 0.3104856;
      b4 = 0.55 * b4 + noise * 0.5329522;
      b5 = -0.7616 * b5 - noise * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + noise * 0.5362) * 0.052;
      b6 = noise * 0.115926;
    }
  }
  return { buffer, random: true, ...seam(buffer, { start: 0, loop: 17.65, fade: 0.35 }) };
}

interface CurrentSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  kind: string;
}

const STATUS_TEXT: Record<string, string> = {
  waves: "海浪正轻轻陪着你", rain: "窗外仿佛下着细雨", bubbles: "像在安静的水族箱旁", wind: "风从远处轻轻吹来",
  fire: "篝火噼啪，安静又暖", stream: "溪水在不远处流过", pink: "平稳的底噪替你盖住杂音", clock: "滴答之间，时间在走",
  boil: "水在咕嘟，慢慢开着", knock: "一声一声，稳稳地", thunder: "远处有雷，雨声更重了", cafe: "像坐在安静的咖啡馆角落",
  musicbox: "一首卡农，慢慢流淌", morning: "清晨的风和鸟鸣", summer: "蝉鸣阵阵，夏天正盛", night: "夏夜虫鸣，风也安静",
  forest: "林子里，风穿过树叶", deepsea: "很深很深的海底", desert: "风卷细沙，安静辽阔", traffic: "远处有车流经过",
};

export class Soundscape {
  private onStatus: StatusCallback;
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private current: CurrentSource | null = null;
  private loops = new Map<string, Promise<LoopResult>>();
  private sequence = 0;
  private requested = false;
  private started = false;
  private lastError = "";
  private onChanged: (() => void) | null = null;
  sound = "waves";
  volume = 0.35;

  constructor(onStatus: StatusCallback) {
    this.onStatus = onStatus;
  }

  setOnChanged(cb: (() => void) | null): void {
    this.onChanged = cb;
  }
  /** Abort any in-flight source load so a late decode cannot silently start. */
  cancel(): void {
    this.sequence += 1;
    this.started = false;
    this.fadeOut(this.current);
    this.current = null;
    this.notify();
  }
  private notify(): void { this.onChanged?.(); }

  async unlock(): Promise<void> {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) throw new Error("当前系统暂不支持背景音，计时仍可正常使用。");
    if (!this.context) {
      this.context = new AudioCtor({ latencyHint: "playback" });
      this.output = this.context.createGain();
      this.output.gain.value = 0.55;
      this.output.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.requested && this.context && this.context.state !== "running") this.onStatus("声音已暂停，点击声音按钮恢复");
        this.notify();
      };
    }
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("声音未能启动，请再次点击开启声音。");
  }

  // Keeps the two most recent sounds decoded; a failed load is forgotten so
  // the next attempt fetches again.
  private load(kind: string): Promise<LoopResult> {
    let loop = this.loops.get(kind);
    if (loop) this.loops.delete(kind);
    else {
      loop = kind === "pink" ? Promise.resolve().then(() => pink(this.context as AudioContext)) : this.decode(kind);
      loop.catch(() => { if (this.loops.get(kind) === loop) this.loops.delete(kind); });
    }
    this.loops.set(kind, loop);
    if (this.loops.size > 2) {
      const first = this.loops.keys().next().value;
      if (first) this.loops.delete(first);
    }
    return loop;
  }

  private async decode(kind: string): Promise<LoopResult> {
    try {
      // Root-relative: sounds are copied to dist/ by the Vite build and served
      // by the same embedded server as /themes, /rpc and /events.
      const response = await fetch(`/sounds/${kind}.mp3`);
      if (!response.ok) throw new Error(response.statusText);
      const buffer = await (this.context as AudioContext).decodeAudioData(await response.arrayBuffer());
      const hint = seams[kind];
      return { buffer, random: hint?.random ?? true, ...seam(buffer, hint) };
    } catch (error) {
      console.warn(`sound "${kind}" failed to load:`, error);
      throw new Error("这段声音暂时无法播放，计时不受影响");
    }
  }

  private fadeOut(node: CurrentSource | null): void {
    if (!node || !this.context) return;
    this.started = false;
    const now = this.context.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, now + 0.45);
    node.source.stop(now + 0.5);
    node.source.onended = () => {
      node.source.disconnect();
      node.gain.disconnect();
    };
  }

  async set(playing: boolean, sound: string, volume: number): Promise<void> {
    const seq = ++this.sequence;
    this.requested = playing;
    this.sound = sound;
    this.volume = volume;
    if (!playing) {
      this.fadeOut(this.current);
      this.current = null;
      this.started = false;
      this.onStatus("声音已关闭");
      return;
    }
    try {
      await this.unlock();
      if (seq !== this.sequence || !this.requested) return;
      if (this.current?.kind === sound) {
        this.current.gain.gain.setTargetAtTime(volume, (this.context as AudioContext).currentTime, 0.08);
      } else {
        const loop = await this.load(sound);
        if (seq !== this.sequence || !this.requested) return;
        const source = (this.context as AudioContext).createBufferSource();
        source.buffer = loop.buffer;
        source.loop = true;
        source.loopStart = loop.loopStart;
        source.loopEnd = loop.loopEnd;
        const gain = (this.context as AudioContext).createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.output as GainNode);
        // A random entry point keeps each session from opening the same way.
        source.start(0, loop.loopStart + (loop.random ? Math.random() * (loop.loopEnd - loop.loopStart) : 0));
        this.started = true;
        gain.gain.linearRampToValueAtTime(volume, (this.context as AudioContext).currentTime + 0.6);
        this.fadeOut(this.current);
        this.current = { source, gain, kind: sound };
        this.notify();
      }
      this.onStatus(STATUS_TEXT[sound] || "");
    } catch (error) {
      if (seq !== this.sequence) return;
      this.fadeOut(this.current);
      this.current = null;
      this.started = false;
      this.lastError = (error as Error).message;
      this.onStatus(this.lastError, true);
      this.notify();
    }
  }

  // Observed runtime state for the native mini panel. actual playing requires a
  // running AudioContext AND an explicitly requested, started source — not the
  // preferences flag.
  audioState(): { contextRunning: boolean; requested: boolean; sound: string; volume: number; started: boolean; error: string } {
    return {
      contextRunning: !!this.context && this.context.state === "running",
      requested: this.requested,
      sound: this.sound,
      volume: this.volume,
      started: this.started,
      error: this.lastError,
    };
  }

  chime(): void {
    if (!this.context || this.context.state !== "running") return;
    for (const [i, frequency] of [523.25, 659.25, 783.99].entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime + i * 0.16;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.65);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  }

  dispose(): void {
    this.sequence++;
    this.requested = false;
    void this.context?.close();
  }
}
