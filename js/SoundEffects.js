export class SoundEffects {
	constructor() {
		this._ctx = null;
		this._muted = false;
		this._failTickIdx = 0;
		this._winTickIdx = 0;
		this._buffers = {};
		this._unlocked = false;
	}

	get ctx() {
		if (!this._ctx) this._ctx = new AudioContext();
		return this._ctx;
	}

	get muted() { return this._muted; }
	set muted(val) { this._muted = val; }

	// Call once inside a user gesture (e.g. the Play button tap).
	// Resumes the AudioContext and pre-decodes all MP3s so they can
	// be played and overlapped freely without triggering mobile autoplay blocks.
	async unlock() {
		if (this._unlocked) return;
		this._unlocked = true;
		const ctx = this.ctx;
		if (ctx.state === 'suspended') await ctx.resume();
		await Promise.all([
			this._loadBuffer('flip',    './sound/gentle_click.mp3'),
			this._loadBuffer('bells',   './sound/bells.mp3'),
			this._loadBuffer('whistle', './sound/whistle.mp3'),
			this._loadBuffer('chatter', './sound/chatter.mp3'),
			this._loadBuffer('snap',    './sound/snap.mp3'),
			this._loadBuffer('marimba', './sound/marimba.mp3'),
		]);
	}

	async _loadBuffer(name, url) {
		try {
			const res = await fetch(url);
			const raw = await res.arrayBuffer();
			this._buffers[name] = await this.ctx.decodeAudioData(raw);
		} catch {}
	}

	_playBuffer(name) {
		if (this._muted) return;
		const buf = this._buffers[name];
		if (!buf) return;
		try {
			const src = this.ctx.createBufferSource();
			src.buffer = buf;
			src.connect(this.ctx.destination);
			src.start();
		} catch {}
	}

	_play(fn) {
		if (this._muted) return;
		try {
			if (this.ctx.state === 'suspended') this.ctx.resume();
			fn(this.ctx, this.ctx.currentTime);
		} catch {}
	}

	_tone({ freq, freqEnd, type = 'sine', vol = 0.15, duration = 0.1, delay = 0 } = {}) {
		this._play((ctx, now) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq, now + delay);
			if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + duration);
			gain.gain.setValueAtTime(vol, now + delay);
			gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + delay);
			osc.stop(now + delay + duration);
		});
	}

	flip()    { this._playBuffer('flip'); }
	bells()   { this._playBuffer('bells'); }
	whistle() { this._playBuffer('whistle'); }
	chatter() { this._playBuffer('chatter'); }
	marimba() { this._playBuffer('marimba'); }

	match() {
		this._tone({ freq: 659, type: 'sine', vol: 0.15, duration: 0.12 });
		this._tone({ freq: 988, type: 'sine', vol: 0.15, duration: 0.14, delay: 0.1 });
	}
	matchWin() {
		this._playBuffer('snap');
	}

	// Called once per frame during the lose pixel-dissolve. Descends one octave
	// over ~120 calls (0.1 semitones/call), with a per-tick downward sweep.
	// Call resetFailTick() before starting the transition.
	failTick() {
		const i = this._failTickIdx++;
		const freq = 1000 * Math.pow(2, -(i * 0.2) / 12);
		this._tone({ freq, freqEnd: freq * 0.8, type: 'sine', vol: 0.05, duration: 0.08 });
	}

	resetFailTick() {
		this._failTickIdx = 0;
	}

	// Mirror of failTick: ascends one octave over ~120 calls, per-tick upward sweep.
	// Call resetWinTick() before starting the transition.
	winTick() {
		const i = this._winTickIdx++;
		const freq = 500 * Math.pow(2, (i * 0.1) / 12);
		this._tone({ freq, freqEnd: freq * 1.2, type: 'sine', vol: 0.05, duration: 0.08 });
	}

	resetWinTick() {
		this._winTickIdx = 0;
	}

	scoreTick()    { this._tone({ freq: 1200, freqEnd: 1100, type: 'sine',     vol: 0.04, duration: 0.04 }); }
	scoreTickEnd() { this._tone({ freq: 1500, freqEnd: 1600, type: 'sine',     vol: 0.06, duration: 0.15 }); }
	click()        { this._tone({ freq: 1200, freqEnd: 1100, type: 'triangle', vol: 0.04, duration: 0.04 }); }
}

export const soundEffects = new SoundEffects();
