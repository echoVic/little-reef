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
    let seed = { waves: 173, rain: 907, bubbles: 431, wind: 383, fire: 599, stream: 757, pink: 211, clock: 131, boil: 449, knock: 673, thunder: 811, cafe: 947, musicbox: 1039, morning: 1163, summer: 1223, night: 1297, forest: 1361, deepsea: 1429, desert: 1487, traffic: 1543 }[kind];
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let brown = 0, low = 0, mid = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
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
        } else if (kind === "wind") {
          const gust = .32 + .24 * (1 - Math.cos(2 * Math.PI * t / 9)) + .08 * Math.sin(2 * Math.PI * t / 3.6);
          data[i] = (brown * 2.2 + low * .32 + noise * .035) * gust;
        } else if (kind === "stream") {
          const flow = .82 + .09 * (1 - Math.cos(2 * Math.PI * t / 4.5));
          data[i] = (noise * .15 + low * .16 + brown * .07) * flow;
        } else if (kind === "fire") {
          data[i] = brown * 1.0 + low * .21;
        } else if (kind === "pink") {
          b0 = .99886 * b0 + noise * .0555179;
          b1 = .99332 * b1 + noise * .0750759;
          b2 = .96900 * b2 + noise * .1538520;
          b3 = .86650 * b3 + noise * .3104856;
          b4 = .55000 * b4 + noise * .5329522;
          b5 = -.7616 * b5 - noise * .0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + noise * .5362) * .052;
          b6 = noise * .115926;
        } else if (kind === "clock") {
          data[i] = brown * .30 + low * .06;
        } else if (kind === "boil") {
          data[i] = low * .42 + brown * .95 + noise * .038;
        } else if (kind === "knock") {
          data[i] = brown * .12;
        } else if (kind === "thunder") {
          data[i] = noise * .085 + low * .30 + brown * .40;
        } else if (kind === "cafe") {
          mid += .16 * (noise - mid);
          const bab = .55 + .45 * Math.sin(2 * Math.PI * t * 3.4);
          const gate = .60 + .40 * Math.sin(2 * Math.PI * t / 5.7 + .8);
          data[i] = brown * .35 + low * .30 + mid * .55 * bab * bab * gate;
        } else if (kind === "musicbox") {
          data[i] = 0;
        } else if (kind === "morning") {
          const dawn = .75 + .25 * (1 - Math.cos(2 * Math.PI * t / 18));
          data[i] = (low * .16 + brown * .22 + noise * .012) * dawn;
        } else if (kind === "summer") {
          mid += .45 * (noise - mid);
          const chirp = .5 + .3 * Math.sin(2 * Math.PI * t * 68) + .2 * Math.sin(2 * Math.PI * t * 81 + 1.7);
          const swell = .55 + .45 * Math.sin(2 * Math.PI * t / 6 + 2);
          data[i] = low * .20 + brown * .28 + noise * .02 + (mid - low) * .22 * chirp * swell;
        } else if (kind === "night") {
          data[i] = low * .12 + brown * .16 + noise * .008;
        } else if (kind === "forest") {
          mid += .45 * (noise - mid);
          const gust = .45 + .55 * (1 - Math.cos(2 * Math.PI * t / 4.5)) / 2;
          data[i] = low * .30 + brown * .45 + (mid - low) * .12 * gust;
        } else if (kind === "deepsea") {
          b0 += .012 * (noise - b0);
          const swell = .7 + .3 * Math.sin(2 * Math.PI * t / 9);
          data[i] = b0 * 2.6 * swell + low * .18 + brown * .30;
        } else if (kind === "desert") {
          const gust = .30 + .45 * (1 - Math.cos(2 * Math.PI * t / 7)) / 2 + .08 * Math.sin(2 * Math.PI * t / 2.8);
          data[i] = (brown * 2.4 + low * .22) * gust + noise * .05 * gust * gust;
        } else if (kind === "traffic") {
          data[i] = low * .55 + brown * .90;
        } else {
          data[i] = brown * .65 + low * .035;
        }
      }
      if (kind === "stream") {
        for (let n = 0; n < 26; n++) {
          const start = Math.floor((.3 + random() * 17.4) * rate);
          const duration = .05 + random() * .12;
          const f = 380 + random() * 420;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const t = j / rate;
            const envelope = Math.sin(Math.PI * t / duration) ** 2;
            data[start + j] += .02 * envelope * Math.sin(2 * Math.PI * (f * t + 60 * t * t));
          }
        }
      }
      if (kind === "fire") {
        for (let n = 0; n < 130; n++) {
          const start = Math.floor((.2 + random() * 17.6) * rate);
          const duration = .012 + random() * .034;
          const amp = .03 + random() * .27;
          let pop = 0;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const t = j / rate;
            pop = pop * .42 + (random() * 2 - 1) * .58;
            data[start + j] += amp * pop * Math.exp(-t / (duration * .35));
          }
        }
      }
      if (kind === "clock") {
        for (let n = 0; n < 18; n++) {
          const start = Math.floor((n + .12) * rate);
          const tick = n % 2 === 0;
          const f = tick ? 2010 : 1430;
          const amp = tick ? .34 : .30;
          for (let j = 0; j < .03 * rate && start + j < length; j++) {
            const t = j / rate;
            data[start + j] += amp * Math.exp(-t / .0042) * Math.sin(2 * Math.PI * f * t);
          }
        }
      }
      if (kind === "boil") {
        for (let n = 0; n < 90; n++) {
          const start = Math.floor((.2 + random() * 17.6) * rate);
          const duration = .04 + random() * .09;
          const f = 300 + random() * 520;
          const amp = .012 + random() * .014;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const t = j / rate;
            const envelope = Math.sin(Math.PI * t / duration) ** 2;
            data[start + j] += amp * envelope * Math.sin(2 * Math.PI * (f * t + 110 * t * t));
          }
        }
      }
      if (kind === "knock") {
        for (let n = 0; n < 13; n++) {
          const start = Math.floor((.5 + n * 1.35 + random() * .12) * rate);
          const f = 430 * (1 + (random() - .5) * .08);
          const amp = .36 * (1 + (random() - .5) * .35);
          for (let j = 0; j < .25 * rate && start + j < length; j++) {
            const t = j / rate;
            data[start + j] += amp * Math.exp(-t / .02) * Math.sin(2 * Math.PI * f * t)
              + .05 * Math.exp(-t / .0015) * (random() * 2 - 1);
          }
        }
      }
      if (kind === "thunder") {
        for (let n = 0; n < 3; n++) {
          const start = Math.floor((2.2 + n * 5.9 + random() * .8) * rate);
          const duration = 2.6 + random() * 1.6;
          const amp = .30 + random() * .08;
          const crack = random() < .5 ? .22 : 0;
          let rumble = 0;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const t = j / rate;
            const nz = random() * 2 - 1;
            rumble += .022 * (nz - rumble);
            const envelope = (1 - Math.exp(-t / .22)) * Math.exp(-t / 1.35);
            data[start + j] += amp * envelope * rumble * 5 + crack * Math.exp(-t / .06) * nz;
          }
        }
      }
      if (kind === "cafe") {
        for (let n = 0; n < 12; n++) {
          const start = Math.floor((.4 + random() * 17.2) * rate);
          const f = 2100 + random() * 1600;
          const amp = .04 + random() * .08;
          const tau = .02 + random() * .05;
          for (let j = 0; j < .2 * rate && start + j < length; j++) {
            const t = j / rate;
            data[start + j] += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t);
          }
        }
      }
      if (kind === "musicbox") {
        const notes = [[.45, 440], [1.55, 523.25], [2.65, 659.25], [3.75, 587.33], [4.85, 523.25], [6.05, 440], [7.15, 392], [8.25, 440], [9.45, 523.25], [10.65, 659.25], [11.85, 783.99], [13.05, 659.25], [14.25, 587.33], [15.45, 523.25], [16.65, 440]];
        const shift = c === 0 ? 0 : .008;
        for (const [when, f] of notes) {
          const start = Math.floor((when + shift) * rate);
          for (let j = 0; j < 1.4 * rate && start + j < length; j++) {
            const t = j / rate;
            data[start + j] += .16 * Math.exp(-t / .55) * Math.sin(2 * Math.PI * f * t)
              + .05 * Math.exp(-t / .35) * Math.sin(2 * Math.PI * 2 * f * t)
              + .025 * Math.exp(-t / .22) * Math.sin(2 * Math.PI * 3.01 * f * t);
          }
        }
      }
      if (kind === "morning") {
        for (let n = 0; n < 24; n++) {
          let at = Math.floor((.4 + random() * 16.8) * rate);
          const syllables = 2 + Math.floor(random() * 3);
          const f = 1700 + random() * 1500;
          const amp = .06 + random() * .10;
          for (let s = 0; s < syllables; s++) {
            const duration = .05 + random() * .05;
            for (let j = 0; j < duration * rate && at + j < length; j++) {
              const u = j / (duration * rate);
              const envelope = Math.sin(Math.PI * u) ** 2;
              data[at + j] += amp * envelope * Math.sin(2 * Math.PI * f * (1 - .18 * u) * (j / rate));
            }
            at += Math.floor((duration + .04 + random() * .05) * rate);
          }
        }
      }
      if (kind === "night") {
        for (let n = 0; n < 14; n++) {
          const period = .55 + random() * .5;
          const f = 3800 + random() * 1200;
          const amp = .02 + random() * .03;
          for (let at = .3 + random() * period; at < 17.8; at += period) {
            let t0 = at;
            const pulses = 3 + Math.floor(random() * 3);
            for (let s = 0; s < pulses; s++) {
              const duration = .016 + random() * .008;
              const start = Math.floor(t0 * rate);
              for (let j = 0; j < duration * rate && start + j < length; j++) {
                const u = j / (duration * rate);
                const envelope = Math.sin(Math.PI * u) ** 2;
                data[start + j] += amp * envelope * Math.sin(2 * Math.PI * f * (j / rate));
              }
              t0 += .045 + random() * .02;
            }
          }
        }
      }
      if (kind === "forest") {
        for (let n = 0; n < 14; n++) {
          let at = Math.floor((.4 + random() * 16.8) * rate);
          const syllables = 2 + Math.floor(random() * 3);
          const f = 1200 + random() * 1200;
          const amp = .04 + random() * .08;
          for (let s = 0; s < syllables; s++) {
            const duration = .06 + random() * .06;
            for (let j = 0; j < duration * rate && at + j < length; j++) {
              const u = j / (duration * rate);
              const envelope = Math.sin(Math.PI * u) ** 2;
              data[at + j] += amp * envelope * Math.sin(2 * Math.PI * f * (1 - .12 * u) * (j / rate));
            }
            at += Math.floor((duration + .05 + random() * .06) * rate);
          }
        }
      }
      if (kind === "deepsea") {
        for (let n = 0; n < 5; n++) {
          const start = Math.floor((1 + random() * 15.5) * rate);
          const duration = .3 + random() * .25;
          const f = 120 + random() * 100;
          const amp = .05 + random() * .05;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const u = j / (duration * rate);
            const envelope = Math.sin(Math.PI * u) ** 2;
            data[start + j] += amp * envelope * Math.sin(2 * Math.PI * f * (1 - .35 * u) * (j / rate));
          }
        }
      }
      if (kind === "traffic") {
        for (let n = 0; n < 10; n++) {
          const start = Math.floor((.5 + n * 1.7 + random() * .9) * rate);
          const duration = 2.5 + random() * 2.5;
          const amp = .5 + random() * .4;
          let pass = 0;
          for (let j = 0; j < duration * rate && start + j < length; j++) {
            const u = j / (duration * rate);
            const nz = random() * 2 - 1;
            pass += .04 * (nz - pass);
            const envelope = Math.sin(Math.PI * u) ** 2;
            data[start + j] += amp * envelope * (pass * .7 + (nz - pass) * .04);
          }
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
    // Keep only the most recent kinds: each buffer is ~7 MB, and a kind
    // regenerates from its fixed seed in well under a second.
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
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
      this.onStatus({ waves: "海浪正轻轻陪着你", rain: "窗外仿佛下着细雨", bubbles: "像在安静的水族箱旁", wind: "风从远处轻轻吹来", fire: "篝火噼啪，安静又暖", stream: "溪水在不远处流过", pink: "平稳的底噪替你盖住杂音", clock: "滴答之间，时间在走", boil: "水在咕嘟，慢慢开着", knock: "一声一声，稳稳地", thunder: "远处有雷，雨声更重了", cafe: "像坐在安静的咖啡馆角落", musicbox: "一段很慢的小旋律", morning: "清晨的风和鸟鸣", summer: "蝉鸣阵阵，夏天正盛", night: "夏夜虫鸣，风也安静", forest: "林子里，风穿过树叶", deepsea: "很深很深的海底", desert: "风卷细沙，安静辽阔", traffic: "远处有车流经过" }[sound]);
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
