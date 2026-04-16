import { percentScoreFloat } from "./utils.js";

const PREF_THEME = 'pref_theme';
const PREF_CHALLENGE = 'pref_challenge';

export class Menu {
	// index: { 'YYYY/MM/DD': 'image-index-filename.json', ... }
	constructor(index) {
		this.index = index;
		this.availableDates = Object.keys(index).sort().reverse(); // newest first
		this.dateIndex = 0;
		this.challengeMode = localStorage.getItem(PREF_CHALLENGE) === 'true';
		this.darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
		this.container = document.getElementById('menu-container');
		this._callback = null;
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
		if (!date) return false;
		const entry = JSON.parse(localStorage.getItem(date) || '{}');
		const modeKey = this.challengeMode ? 'challenge' : 'normal';
		// check new-format slot, or old flat-format keys for backward compat
		let saveData;
		let percentScore = 0;
		if (entry[modeKey]) saveData = entry[modeKey];
		else if (!this.challengeMode && entry.score) saveData = entry; 

		if (saveData) percentScore = percentScoreFloat(saveData.score);
		const hasSave = !!saveData && (percentScore > 0);
		console.log(`${hasSave}, ${percentScore}`);
		return { hasSave, percentScore };
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

	_build() {
		this.container.innerHTML = `
			<div class="menu-card">

				<div class="menu-header">
					<span class="menu-title">I'm not a Robot</span>
				</div>

				<!-- Date cell — green -->
				<div class="menu-cell menu-cell--green">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<div class="menu-cell-front menu-date-row">
							<button class="menu-arrow-btn" id="menu-date-back">
								<span class="material-symbols-rounded">chevron_left</span>
							</button>
							<span id="menu-date-label" class="menu-date-label"></span>
							<button class="menu-arrow-btn" id="menu-date-fwd">
								<span class="material-symbols-rounded">chevron_right</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Actions cell — blue -->
				<div class="menu-cell menu-cell--blue">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<div class="menu-cell-front menu-actions">
							<button class="menu-btn menu-btn-primary" id="menu-continue">
								<span class="material-symbols-rounded">play_arrow</span>
								<span id="menu-continue-label">Play</span>
							</button>
							<button class="menu-btn menu-btn-secondary menu-btn-icon" id="menu-restart">
								<span class="material-symbols-rounded">restart_alt</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Challenge toggle cell — red -->
				<div class="menu-cell menu-cell--red">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-challenge">
							<span class="material-symbols-rounded">emoji_events</span>
							<span class="menu-toggle-label">Game mode</span>
							<span class="menu-toggle-status"></span>
						</button>
					</div>
				</div>

				<!-- Theme toggle cell — yellow -->
				<div class="menu-cell menu-cell--yellow">
					<div class="menu-cell-inner">
						<div class="menu-cell-back"></div>
						<button class="menu-cell-front menu-toggle" id="menu-theme">
							<span class="material-symbols-rounded">dark_mode</span>
							<span class="menu-toggle-label">Theme</span>
							<span class="menu-toggle-status"></span>
						</button>
					</div>
				</div>

			</div>
		`;

		this.container.querySelector('#menu-date-back').addEventListener('click', () => {
			// back = older date = increase index into newest-first array
			if (this.dateIndex < this.availableDates.length - 1) {
				this.dateIndex++;
				this._refreshDateUI();
			}
		});
		this.container.querySelector('#menu-date-fwd').addEventListener('click', () => {
			// fwd = newer date = decrease index
			if (this.dateIndex > 0) {
				this.dateIndex--;
				this._refreshDateUI();
			}
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
		this.container.querySelector('#menu-date-back').disabled = this.dateIndex >= this.availableDates.length - 1;
		this.container.querySelector('#menu-date-fwd').disabled = this.dateIndex <= 0;
		this._refreshActionBtns();
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

		const themeBtn = this.container.querySelector('#menu-theme');
		themeBtn.classList.toggle('active', this.darkMode);
		themeBtn.querySelector('.material-symbols-rounded').textContent = this.darkMode ? 'dark_mode' : 'light_mode';
		themeBtn.querySelector('.menu-toggle-status').textContent = this.darkMode ? 'Dark' : 'Default';

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
		this._refreshToggles();
		this._refreshDateUI();
		// Hide the game container now so it doesn't show through while we wait.
		document.getElementById('game-container').style.display = 'none';

		// Wait for all fonts (including Material Symbols) to finish loading,
		// then yield one animation frame so the browser can measure and lay out
		// the updated text before we make the menu visible.
		await document.fonts.ready;
		await new Promise(r => requestAnimationFrame(r));

		this.container.classList.add('fade-in');
		this.container.classList.add('active');
	}

	async hide() {
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
