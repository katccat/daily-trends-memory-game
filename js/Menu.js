import { percentScoreFloat, fitFontSize, shuffle } from "./utils.js";
import { soundEffects } from "./main.js";
import { Graphics } from "./graphics.js";

const PREF_THEME = 'pref_theme';
const PREF_CHALLENGE = 'pref_challenge';
const PREF_SOUND = 'pref_sound';
const PREF_DATE = 'pref_date';
const TITLE_SPLASH_COUNT = 1;

export class Menu {
	// index: { 'YYYY/MM/DD': 'image-index-filename.json', ... }
	constructor(index) {
		this.index = index;
		this.availableDates = Object.keys(index).sort().reverse(); // newest first
		this.dateIndex = 0;
		this._restoreDatePref();
		this.challengeMode = localStorage.getItem(PREF_CHALLENGE) === 'true';
		this.soundMuted = localStorage.getItem(PREF_SOUND) === 'true';
		this.darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
		this.container = document.getElementById('menu-container');
		this._callback = null;
		this._pickerMonthIndex = 0;
		this._build();
	}

	get selectedDate() {
		return this.availableDates[this.dateIndex] ?? null;
	}

	get selectedEndpoint() {
		const date = this.selectedDate;
		return date ? this.index[date] : null;
	}

	_hasSave() {
		const date = this.selectedDate;
		if (!date) return { hasSave: false, percentScore: 0 };
		const entry = JSON.parse(localStorage.getItem(date) || '{}');
		const modeKey = this.challengeMode ? 'challenge' : 'normal';
		// check new-format slot, or old flat-format keys for backward compat
		let saveData;
		let percentScore = 0;
		if (entry[modeKey]) saveData = entry[modeKey];
		else if (!this.challengeMode && entry.score) saveData = entry;

		if (saveData) percentScore = percentScoreFloat(saveData.score);
		const hasSave = !!saveData && (percentScore > 0);
		return { hasSave, percentScore };
	}

	_getSaveScores(date) {
		if (!date) return { normalPct: 0, challengePct: 0 };
		const entry = JSON.parse(localStorage.getItem(date) || '{}');
		const normalSave = entry.normal ?? (entry.score !== undefined ? entry : null);
		const challengeSave = entry.challenge ?? null;
		return {
			normalPct: normalSave ? percentScoreFloat(normalSave.score) : 0,
			challengePct: challengeSave ? percentScoreFloat(challengeSave.score) : 0,
		};
	}

	_formatDate(dateStr) {
		if (!dateStr) return 'Today';
		const [y, m, d] = dateStr.split('/').map(Number);
		const date = new Date(y, m - 1, d);
		const today = new Date();
		const isToday =
			date.getFullYear() === today.getFullYear() &&
			date.getMonth() === today.getMonth() &&
			date.getDate() === today.getDate();
		const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
		return isToday ? `Today · ${formatted}` : formatted;
	}

	get availableMonths() {
		const months = [...new Set(this.availableDates.map(d => d.slice(0, 7)))];
		return months.sort().reverse(); // newest first
	}

	_formatMonth(monthKey) {
		const [y, m] = monthKey.split('/').map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	_isToday(dateStr) {
		const [y, m, d] = dateStr.split('/').map(Number);
		const t = new Date();
		return y === t.getFullYear() && m === t.getMonth() + 1 && d === t.getDate();
	}

	_restoreDatePref() {
		const raw = localStorage.getItem(PREF_DATE);
		if (!raw) return;
		let saved;
		try { saved = JSON.parse(raw); } catch { localStorage.removeItem(PREF_DATE); return; }
		const { date, latestAtPick } = saved;
		const currentLatest = this.availableDates[0];
		// A genuinely new most-recent date has arrived since the user picked — clear pref
		if (currentLatest && latestAtPick && currentLatest > latestAtPick) {
			localStorage.removeItem(PREF_DATE);
			return;
		}
		const idx = this.availableDates.indexOf(date);
		if (idx >= 0) {
			this.dateIndex = idx;
		} else {
			localStorage.removeItem(PREF_DATE);
		}
	}

	_build() {
		this.container.innerHTML = `
			<div id="menu-main">
				<div class="menu-card" id="menu-card">

				<!-- Search bar header -->
				<div class="menu-title"><div class="menu-title-text"></div></div>

				<!-- Date cell — green (opens picker) -->
				<div class="menu-cell menu-cell--green">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-date-open">
							<span class="material-icons-outlined">calendar_today</span>
							<span id="menu-date-label" class="menu-date-label"></span>
							<span class="material-icons-outlined menu-date-chevron">chevron_right</span>
						</button>
					</div>
				</div>

				<!-- Actions cell — blue -->
				<div class="menu-cell menu-cell--blue">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<div class="menu-cell-front menu-actions">
							<button class="menu-btn menu-btn-primary" id="menu-continue">
								<span class="material-icons-outlined">play_arrow</span>
								<span id="menu-continue-label">Play</span>
							</button>
							<button class="menu-btn menu-btn-secondary menu-btn-icon" id="menu-restart">
								<span class="material-icons-outlined">restart_alt</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Challenge toggle cell — red -->
				<div class="menu-cell menu-cell--red">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-challenge">
							<span class="material-icons-outlined">sports_esports</span>
							<span class="menu-toggle-label">Game mode</span>
							<span class="menu-toggle-status"></span>
						</button>
					</div>
				</div>

				<!-- Options cell — yellow (opens options panel) -->
				<div class="menu-cell menu-cell--yellow">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-options-open">
							<span class="material-icons-outlined">settings</span>
							<span class="menu-date-label">Options</span>
							<span class="material-icons-outlined menu-date-chevron">chevron_right</span>
						</button>
					</div>
				</div>

				</div>
			</div>

			<!-- Options panel -->
			<div class="date-picker-panel options-panel" id="options-panel">
				<div class="options-panel-header menu-header">Options</div>
				<div class="menu-cell">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-sound">
							<span class="material-icons-outlined">volume_up</span>
							<span class="menu-toggle-label">Sound</span>
							<span class="menu-toggle-status"></span>
						</button>
					</div>
				</div>
				<div class="menu-cell">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-theme">
							<span class="material-icons-outlined">dark_mode</span>
							<span class="menu-toggle-label">Theme</span>
							<span class="menu-toggle-status"></span>
						</button>
					</div>
				</div>
				<div class="date-picker-footer">
					<button class="menu-btn menu-btn-secondary" id="options-back">
						Back
					</button>
				</div>
			</div>

			<!-- Date picker panel -->
			<div class="date-picker-panel" id="date-picker-panel">
				<div class="date-picker-header menu-header">
					<button class="menu-arrow-btn date-picker-nav-btn" id="picker-month-back">
						<span class="material-icons-outlined">chevron_left</span>
					</button>
					<span class="date-picker-month-label" id="picker-month-label"></span>
					<button class="menu-arrow-btn date-picker-nav-btn" id="picker-month-fwd">
						<span class="material-icons-outlined">chevron_right</span>
					</button>
				</div>
				<div class="date-picker-grid" id="date-picker-grid"></div>
				<div class="date-picker-footer">
					<button class="menu-btn menu-btn-secondary date-picker-back-btn" id="picker-back">
						Back
					</button>
				</div>
			</div>
		`;

		this.container.querySelector('#menu-date-open').addEventListener('click', () => {
			this._showDatePicker();
		});
		this.container.querySelector('#menu-options-open').addEventListener('click', () => {
			this._showOptions();
		});
		this.container.querySelector('#options-back').addEventListener('click', () => {
			this._hideOptions();
		});
		this.container.querySelector('#picker-month-back').addEventListener('click', () => {
			if (this._pickerMonthIndex < this.availableMonths.length - 1) {
				this._pickerMonthIndex++;
				this._renderPickerMonth();
			}
		});
		this.container.querySelector('#picker-month-fwd').addEventListener('click', () => {
			if (this._pickerMonthIndex > 0) {
				this._pickerMonthIndex--;
				this._renderPickerMonth();
			}
		});
		this.container.querySelector('#picker-back').addEventListener('click', () => {
			this._hideDatePicker();
		});
		this.container.querySelector('#menu-continue').addEventListener('click', () => {
			this._start(false);
		});
		this.container.querySelector('#menu-restart').addEventListener('click', () => {
			this._start(true);
		});
		this.container.querySelector('#menu-challenge').addEventListener('click', () => {
			this.challengeMode = !this.challengeMode;
			localStorage.setItem(PREF_CHALLENGE, this.challengeMode);
			this._refreshToggles();
			this._refreshDateUI(); // Continue enabled-state depends on mode
		});
		this.container.querySelector('#menu-sound').addEventListener('click', () => {
			this.soundMuted = !this.soundMuted;
			localStorage.setItem(PREF_SOUND, this.soundMuted);
			soundEffects.muted = this.soundMuted;
			this._refreshToggles();
		});
		this.container.querySelector('#menu-theme').addEventListener('click', () => {
			this.darkMode = !this.darkMode;
			localStorage.setItem(PREF_THEME, this.darkMode ? 'dark' : 'light');
			if (this.darkMode) {
				document.documentElement.setAttribute('data-theme', 'dark');
			} else {
				document.documentElement.removeAttribute('data-theme');
			}
			this._refreshToggles();
		});
	}

	_refreshDateUI() {
		this.container.querySelector('#menu-date-label').textContent = this._formatDate(this.selectedDate);
		this.container.querySelector('#menu-date-open').disabled = this.availableDates.length === 0;
		this._refreshActionBtns();
	}

	_showDatePicker() {
		if (this.availableMonths.length === 0) return;
		this._titleGen = (this._titleGen ?? 0) + 1;
		const selectedMonth = this.selectedDate?.slice(0, 7);
		const idx = this.availableMonths.indexOf(selectedMonth);
		this._pickerMonthIndex = idx >= 0 ? idx : 0;

		const card = this.container.querySelector('#menu-main');
		card.style.display = 'none';
		this._animateOnNextRender = true;
		this._renderPickerMonth(); // also adds .active to the picker panel
	}

	_showOptions() {
		this._titleGen = (this._titleGen ?? 0) + 1;
		this.container.querySelector('#menu-main').style.display = 'none';
		const panel = this.container.querySelector('#options-panel');
		panel.classList.remove('flip-anim');
		panel.classList.add('active');
		panel.offsetHeight; // force reflow so animation restarts
		panel.classList.add('flip-anim');
	}

	_hideOptions() {
		const panel = this.container.querySelector('#options-panel');
		panel.classList.remove('active', 'flip-anim');
		this.container.querySelector('#menu-main').style.display = '';
		this._animateTitle();
	}

	_hideDatePicker() {
		const main = this.container.querySelector('#menu-main');
		const picker = this.container.querySelector('#date-picker-panel');
		picker.classList.remove('active');
		main.style.display = '';
		this._animateTitle();
	}

	_animateTitle() {
		this._titleGen = (this._titleGen ?? 0) + 1;
		this._runTitleLoop(this._titleGen);
	}

	async _runTitleLoop(gen) {
		const outerEl = this.container.querySelector('.menu-title');
		const titleEl = this.container.querySelector('.menu-title-text');
		const googleColors = ['var(--google-blue)', 'var(--google-red)', 'var(--google-green)', 'var(--google-yellow)'];

		const fetchPromise = fetch('https://backend.clayrobot.net/memorygame/splash')
			.then(r => r.json())
			.catch(e => (console.error('splash fetch failed:', e), null));

		const typeOne = async text => {
			const dummy = document.createElement('div');
			dummy.className = 'menu-title menu-title-buffer';
			dummy.style.width = titleEl.offsetWidth + 'px';
			document.body.appendChild(dummy);
			titleEl.style.fontSize = fitFontSize(dummy, text, outerEl.offsetHeight);
			dummy.remove();
			await Graphics.typeTextColored(text, googleColors, 150, titleEl);
		};
		titleEl.innerHTML = '';
		const data = await fetchPromise;
		const entries = (data?.entries?.length > 0) ? data.entries : null;
		if (this._titleGen !== gen) return;

		await typeOne("I'm not a Robot");
		if (this._titleGen !== gen) return;
		await new Promise(r => setTimeout(r, 3000));
		if (this._titleGen !== gen) return;

		if (!entries) return;

		const queue = shuffle([...entries]);

		while (this._titleGen === gen) {
			for (let i = 0; i < TITLE_SPLASH_COUNT; i++) {
				if (queue.length === 0) queue.push(...shuffle([...entries]));

				await Graphics.deleteText(60, titleEl);
				if (this._titleGen !== gen) return;
				await new Promise(r => setTimeout(r, 300));
				if (this._titleGen !== gen) return;

				shuffle(googleColors);
				await typeOne(queue.pop());
				if (this._titleGen !== gen) return;
				await new Promise(r => setTimeout(r, 3000));
				if (this._titleGen !== gen) return;
			}

			await Graphics.deleteText(60, titleEl);
			if (this._titleGen !== gen) return;
			await new Promise(r => setTimeout(r, 300));
			if (this._titleGen !== gen) return;

			await typeOne("I'm not a Robot");
			if (this._titleGen !== gen) return;
			await new Promise(r => setTimeout(r, 3000));
		}
	}

	_renderPickerMonth() {
		const months = this.availableMonths;
		if (months.length === 0) return;
		const monthKey = months[this._pickerMonthIndex];
		const monthDates = this.availableDates.filter(d => d.startsWith(monthKey)).sort();

		const picker = this.container.querySelector('#date-picker-panel');
		const grid = this.container.querySelector('#date-picker-grid');
		picker.classList.remove('flip-anim');
		grid.innerHTML = '';

		monthDates.forEach((date, i) => {
			const [, , d] = date.split('/').map(Number);
			const isSelected = date === this.selectedDate;
			const isToday = this._isToday(date);
			const { normalPct, challengePct } = this._getSaveScores(date);

			const cell = document.createElement('div');
			cell.className = `date-cell${isSelected ? ' date-cell--selected' : ''}`;
			cell.style.setProperty('--flip-delay', `${i * 50}ms`);
			cell.innerHTML = `
				<div class="date-cell-inner">
					<div class="date-cell-back"></div>
					<div class="date-cell-front">
						${normalPct > 0 ? `<div class="date-cell-fill date-cell-fill--normal" style="--fill-pct:${normalPct.toFixed(1)}%"></div>` : ''}
						${challengePct > 0 ? `<div class="date-cell-fill date-cell-fill--challenge" style="--fill-pct:${challengePct.toFixed(1)}%"></div>` : ''}
						<span class="date-cell-day${isToday ? ' date-cell-day--today' : ''}">${d}</span>
					</div>
				</div>
			`;
			cell.addEventListener('click', () => {
				const newIdx = this.availableDates.indexOf(date);
				if (newIdx >= 0) {
					this.dateIndex = newIdx;
					localStorage.setItem(PREF_DATE, JSON.stringify({ date, latestAtPick: this.availableDates[0] }));
					this._refreshDateUI();
					this._hideDatePicker();
				}
			});
			grid.appendChild(cell);
		});

		this.container.querySelector('#picker-month-label').textContent = this._formatMonth(monthKey);
		this.container.querySelector('#picker-month-back').disabled = this._pickerMonthIndex >= months.length - 1;
		this.container.querySelector('#picker-month-fwd').disabled = this._pickerMonthIndex <= 0;
		if (this._animateOnNextRender) {
			this._animateOnNextRender = false;
			picker.offsetHeight; // force reflow so animation restarts on new cells
			picker.classList.add('active');
			picker.classList.add('flip-anim');
		} else {
			picker.classList.add('active');
		}
	}

	_refreshActionBtns() {
		const {hasSave, percentScore} = this._hasSave();
		this.container.querySelector('#menu-continue-label').textContent = hasSave ? `Continue (${Math.floor(percentScore)}%)` : 'Play';
		this.container.querySelector('#menu-restart').disabled = !hasSave;
	}

	_refreshToggles() {
		const challengeBtn = this.container.querySelector('#menu-challenge');
		challengeBtn.classList.toggle('active', this.challengeMode);
		challengeBtn.querySelector('.menu-toggle-status').textContent = this.challengeMode ? 'Challenge' : 'Normal';

		const soundBtn = this.container.querySelector('#menu-sound');
		soundBtn.classList.toggle('active', !this.soundMuted);
		soundBtn.querySelector('.material-icons-outlined').textContent = this.soundMuted ? 'volume_off' : 'volume_up';
		soundBtn.querySelector('.menu-toggle-status').textContent = this.soundMuted ? 'Off' : 'On';

		const themeBtn = this.container.querySelector('#menu-theme');
		// themeBtn.classList.toggle('active', this.darkMode);
		themeBtn.querySelector('.material-icons-outlined').textContent = this.darkMode ? 'dark_mode' : 'light_mode';
		themeBtn.querySelector('.menu-toggle-status').textContent = this.darkMode ? 'Dark' : 'Light';

		// action buttons also depend on challenge mode (different save slot)
		// this._refreshActionBtns();
	}

	_start(restart) {
		this._setLoading(true);
		if (this._callback) {
			this._callback({
				date: this.selectedDate,
				endpoint: this.selectedEndpoint,
				challengeMode: this.challengeMode,
				restart,
			});
		}
	}

	_setLoading(loading) {
		this.container.querySelectorAll('button').forEach(btn => {
			btn.disabled = loading;
		});
	}

	async show() {
		this._setLoading(false);
		soundEffects.muted = this.soundMuted;
		this._refreshToggles();
		this._refreshDateUI();
		// Hide the game container now so it doesn't show through while we wait.
		document.getElementById('game-container').style.display = 'none';

		// Wait for all fonts (including Material Icons) to finish loading,
		// then yield one animation frame so the browser can measure and lay out
		// the updated text before we make the menu visible.
		await document.fonts.ready;
		await new Promise(r => requestAnimationFrame(r));

		this.container.classList.add('fade-in');
		this.container.classList.add('active');
		document.getElementById('background').classList.remove('active');

		this._animateTitle();
	}

	async hide() {
		this._titleGen = (this._titleGen ?? 0) + 1;
		// Reveal the game container immediately so the game can lay out
		// while the flip animation plays on top.
		document.getElementById('game-container').style.display = '';
		this.container.classList.remove('fade-in');
		await new Promise(r => setTimeout(r, 250));
		this.container.classList.remove('active');
	}

	onStart(cb) {
		this._callback = cb;
	}
}
