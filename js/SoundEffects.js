export class SoundEffects {
	constructor() {
		this._ctx = null;
		this._muted = false;
		this._failTickIdx = 0;
		this._winTickIdx = 0;
	}

	get ctx() {
		if (!this._ctx) this._ctx = new AudioContext();
		return this._ctx;
	}

	get muted() { return this._muted; }
	set muted(val) { this._muted = val; }

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

	flip() {
		if (this._muted) return;
		new Audio('/sound/gentle_click.mp3').play().catch(() => {});
	}

	match() {
		// Two ascending tones: E5 → B5
		this._tone({ freq: 659, type: 'sine', vol: 0.15, duration: 0.12 });
		this._tone({ freq: 988, type: 'sine', vol: 0.15, duration: 0.14, delay: 0.1 });
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

	scoreTick() {
		this._tone({ freq: 1200, freqEnd: 1100, type: 'sine', vol: 0.04, duration: 0.04 });
	}
	scoreTickEnd() {
		this._tone({ freq: 1500, freqEnd: 1600, type: 'sine', vol: 0.06, duration: 0.15 });
	}

	bells() {
		if (this._muted) return;
		new Audio('/sound/bells.mp3').play().catch(() => {});
	}
	click() {
		this._tone({ freq: 1200, freqEnd: 1100, type: 'triangle', vol: 0.04, duration: 0.04 });
	}
	whistle() {
		if (this._muted) return;
		new Audio('/sound/whistle.mp3').play().catch(() => {});
	}
	chatter() {
		if (this._muted) return;
		new Audio('/sound/chatter.mp3').play().catch(() => {});
	}
}

export const soundEffects = new SoundEffects();
