// Ambience from the CC0 field recordings embedded in sounds/, looped seamlessly
// in memory; pink noise is synthesized. Nothing is downloaded from the internet.

// Seams that must fall between beats or where a tune ends: start and loop are
// seconds into the decoded file, fade is the crossfade length.
const seams = {
  clock: { start: .25, loop: 30.001, fade: .15 },
  knock: { start: .25, loop: 29.7, fade: .15 },
  musicbox: { start: 15.5, loop: 16.94, fade: .5, random: false },
};

// Crossfades the fade seconds after the loop into its first fade seconds, in
// place and at equal power, so playback runs from loopEnd into loopStart
// without a seam. The default start skips the encoder's leading padding.
export function seam(buffer, { start = .25, loop, fade = 3 } = {}) {
  const rate = buffer.sampleRate;
  const a = Math.round(start * rate), f = Math.round(fade * rate);
  const n = loop ? Math.round(loop * rate) : buffer.length - a - f - Math.round(.25 * rate);
  if (n <= f || a + n + f > buffer.length) throw new Error(`循环超出录音长度：${buffer.duration.toFixed(2)} 秒`);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < f; i++) {
      const angle = Math.PI / 2 * i / f;
      data[a + n + i] = data[a + n + i] * Math.cos(angle) + data[a + i] * Math.sin(angle);
    }
  }
  return { loopStart: (a + f) / rate, loopEnd: (a + n + f) / rate };
}

// Pink noise (Paul Kellet's filter) from a fixed seed: 18 s, seamed like the recordings.
function pink(context) {
  const rate = context.sampleRate, length = Math.round(rate * 18);
  const buffer = context.createBuffer(2, length, rate);
  let seed = 211;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const noise = random() * 2 - 1;
      b0 = .99886 * b0 + noise * .0555179;
      b1 = .99332 * b1 + noise * .0750759;
      b2 = .96900 * b2 + noise * .1538520;
      b3 = .86650 * b3 + noise * .3104856;
      b4 = .55000 * b4 + noise * .5329522;
      b5 = -.7616 * b5 - noise * .0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + noise * .5362) * .052;
      b6 = noise * .115926;
    }
  }
  return { buffer, random: true, ...seam(buffer, { start: 0, loop: 17.65, fade: .35 }) };
}

export class Soundscape {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.context = null;
    this.output = null;
    this.current = null;
    this.loops = new Map();
    this.sequence = 0;
    this.requested = false;
    this.sound = "waves";
    this.volume = .35;
  }

  async unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error("当前系统暂不支持背景音，计时仍可正常使用。");
    if (!this.context) {
      this.context = new Audio({ latencyHint: "playback" });
      this.output = this.context.createGain();
      this.output.gain.value = .55;
      this.output.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.requested && this.context.state !== "running") this.onStatus("声音已暂停，点击声音按钮恢复");
      };
    }
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("声音未能启动，请再次点击开启声音。");
  }

  // Keeps the two most recent sounds decoded (20–35 MB each); a failed load is
  // forgotten so the next attempt fetches again.
  load(kind) {
    let loop = this.loops.get(kind);
    if (loop) this.loops.delete(kind);
    else {
      loop = kind === "pink" ? Promise.resolve().then(() => pink(this.context)) : this.decode(kind);
      loop.catch(() => { if (this.loops.get(kind) === loop) this.loops.delete(kind); });
    }
    this.loops.set(kind, loop);
    if (this.loops.size > 2) this.loops.delete(this.loops.keys().next().value);
    return loop;
  }

  async decode(kind) {
    try {
      const response = await fetch(new URL(`sounds/${kind}.mp3`, import.meta.url));
      if (!response.ok) throw new Error(response.statusText);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      const hint = seams[kind];
      return { buffer, random: hint?.random ?? true, ...seam(buffer, hint) };
    } catch (error) {
      // Keep the real cause for the Web Inspector; the page shows only the message.
      console.warn(`sound "${kind}" failed to load:`, error);
      throw new Error("这段声音暂时无法播放，计时不受影响", { cause: error });
    }
  }

  fadeOut(node) {
    if (!node || !this.context) return;
    const now = this.context.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, now + .45);
    node.source.stop(now + .5);
    node.source.onended = () => { node.source.disconnect(); node.gain.disconnect(); };
  }

  async set(playing, sound, volume) {
    const seq = ++this.sequence;
    this.requested = playing;
    this.sound = sound;
    this.volume = volume;
    if (!playing) {
      this.fadeOut(this.current);
      this.current = null;
      this.onStatus("声音已关闭");
      return;
    }
    try {
      await this.unlock();
      if (seq !== this.sequence || !this.requested) return;
      if (this.current?.kind === sound) {
        this.current.gain.gain.setTargetAtTime(volume, this.context.currentTime, .08);
      } else {
        const loop = await this.load(sound);
        if (seq !== this.sequence || !this.requested) return;
        const source = this.context.createBufferSource();
        source.buffer = loop.buffer;
        source.loop = true;
        source.loopStart = loop.loopStart;
        source.loopEnd = loop.loopEnd;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain); gain.connect(this.output);
        // A random entry point keeps each session from opening the same way.
        source.start(0, loop.loopStart + (loop.random ? Math.random() * (loop.loopEnd - loop.loopStart) : 0));
        gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + .6);
        this.fadeOut(this.current);
        this.current = { source, gain, kind: sound };
      }
      this.onStatus({ waves: "海浪正轻轻陪着你", rain: "窗外仿佛下着细雨", bubbles: "像在安静的水族箱旁", wind: "风从远处轻轻吹来", fire: "篝火噼啪，安静又暖", stream: "溪水在不远处流过", pink: "平稳的底噪替你盖住杂音", clock: "滴答之间，时间在走", boil: "水在咕嘟，慢慢开着", knock: "一声一声，稳稳地", thunder: "远处有雷，雨声更重了", cafe: "像坐在安静的咖啡馆角落", musicbox: "一段很慢的小旋律", morning: "清晨的风和鸟鸣", summer: "蝉鸣阵阵，夏天正盛", night: "夏夜虫鸣，风也安静", forest: "林子里，风穿过树叶", deepsea: "很深很深的海底", desert: "风卷细沙，安静辽阔", traffic: "远处有车流经过" }[sound]);
    } catch (error) {
      if (seq !== this.sequence) return;
      // Stop the previous sound too: it no longer matches the selection.
      this.fadeOut(this.current);
      this.current = null;
      this.onStatus(error.message, true);
    }
  }

  chime() {
    if (!this.context || this.context.state !== "running") return;
    for (const [i, frequency] of [523.25, 659.25, 783.99].entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime + i * .16;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.07, start + .025);
      gain.gain.exponentialRampToValueAtTime(.001, start + .6);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(start); oscillator.stop(start + .65);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }

  dispose() { this.sequence++; this.requested = false; this.context?.close(); }
}
