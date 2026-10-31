export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.enabled = localStorage.getItem('ns_music_enabled') !== 'off';
  }

  unlock() {
    if (typeof window === 'undefined') return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!this.ctx) {
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.enabled) this.startMusic();
  }

  tone(frequency, duration = .16, type = 'sine', volume = .12, endFrequency = frequency, when = 0) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + .025);
  }

  noise(duration = .12, volume = .1, filterFrequency = 2600) {
    if (!this.ctx || !this.master) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, this.ctx.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  play(kind) {
    this.unlock();
    if (!this.ctx) return;
    if (kind === 'slash') {
      this.noise(.16, .13, 4200);
      this.tone(520, .13, 'sawtooth', .055, 150);
    } else if (kind === 'iaido') {
      this.noise(.28, .2, 5600);
      this.tone(880, .24, 'triangle', .1, 95);
      this.tone(440, .2, 'sine', .055, 70, .035);
    } else if (kind === 'hit') {
      this.noise(.075, .11, 1500);
      this.tone(115, .1, 'square', .045, 48);
    } else if (kind === 'dodge') {
      this.noise(.2, .075, 1900);
      this.tone(300, .18, 'sine', .045, 760);
    } else if (kind === 'kill') {
      this.tone(660, .12, 'triangle', .065, 990);
      this.tone(990, .2, 'sine', .045, 1320, .08);
    }
  }

  startMusic() {
    if (!this.ctx || !this.enabled || this.timer) return;
    const melody = [293.66, 0, 349.23, 440, 0, 523.25, 440, 349.23, 293.66, 0, 392, 440, 0, 587.33, 523.25, 440];
    const bass = [73.42, 73.42, 87.31, 87.31, 65.41, 65.41, 98, 98];
    this.timer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.enabled) return;
      const beat = this.step % 16;
      const note = melody[beat];
      if (note) this.tone(note, .22, 'triangle', .027, note * .995);
      if (beat % 2 === 0) this.tone(bass[(this.step >> 1) % bass.length], .34, 'sine', .055, bass[(this.step >> 1) % bass.length] * .98);
      if (beat === 0 || beat === 8) this.tone(146.83, .42, 'sine', .025, 110);
      this.step++;
    }, 250);
  }

  toggleMusic() {
    this.enabled = !this.enabled;
    localStorage.setItem('ns_music_enabled', this.enabled ? 'on' : 'off');
    if (this.enabled) {
      this.unlock();
      this.startMusic();
    } else if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    return this.enabled;
  }

  get musicEnabled() { return this.enabled; }
}
