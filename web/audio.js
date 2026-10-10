// Offline procedural ambience: no downloads, microphones, or external audio.
export class Soundscape {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.context = null;
    this.output = null;
    this.current = null;
    this.cache = new Map();
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

  buffer(kind) {
    if (this.cache.has(kind)) return this.cache.get(kind);
    const rate = this.context.sampleRate;
    const length = Math.round(rate * 18);
    const buffer = this.context.createBuffer(2, length, rate);
    let seed = { waves: 173, rain: 907, bubbles: 431 }[kind];
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let brown = 0, low = 0;
      for (let i = 0; i < length; i++) {
        const noise = random() * 2 - 1;
        const t = i / rate;
        brown = (brown + noise * .025) / 1.025;
        low += .07 * (noise - low);
        if (kind === "waves") {
          const tide = .26 + .22 * (1 - Math.cos(2 * Math.PI * t / 9));
          data[i] = (brown * 3.4 + low * .4) * tide;
        } else if (kind === "rain") {
          data[i] = noise * .10 + low * .40 + brown * .22;
        } else {
          data[i] = brown * .65 + low * .035;
        }
      }
      if (kind === "bubbles") {
        for (let n = 0; n < 18; n++) {
          const start = Math.floor((.5 + random() * 16) * rate);
          const duration = .13 + random() * .18;
          const f = 250 + random() * 390;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const t = j / rate;
            const envelope = Math.sin(Math.PI * t / duration) ** 2;
            data[start + j] += .035 * envelope * Math.sin(2 * Math.PI * (f * t + 140 * t * t));
          }
        }
      }
      // Blend the seam then rotate it to the middle: no start/stop discontinuity.
      const seam = Math.min(Math.floor(rate * .35), Math.floor(length / 4));
      for (let i = 0; i < seam; i++) {
        const u = i / seam;
        const tail = data[length - seam + i], head = data[i];
        data[length - seam + i] = tail * (1 - u) + head * u;
      }
      data.copyWithin(0, seam);
      data.fill(0, length - seam);
      // Use the non-zero part of the buffer below as the loop region.
    }
    buffer.loopEnd = (length - Math.floor(rate * .35)) / rate;
    this.cache.set(kind, buffer);
    return buffer;
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
        const source = this.context.createBufferSource();
        source.buffer = this.buffer(sound);
        source.loop = true;
        source.loopEnd = source.buffer.loopEnd;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain); gain.connect(this.output);
        source.start();
        gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + .6);
        this.fadeOut(this.current);
        this.current = { source, gain, kind: sound };
      }
      this.onStatus({ waves: "海浪正轻轻陪着你", rain: "窗外仿佛下着细雨", bubbles: "像在安静的水族箱旁" }[sound]);
    } catch (error) {
      if (seq === this.sequence) this.onStatus(error.message, true);
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
