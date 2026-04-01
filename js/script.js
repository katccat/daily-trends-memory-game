import { Config } from './config.js';
import { Elements } from './graphics.js';
import { Graphics } from './graphics.js';
import { GridLayout } from './gridlayout.js';
import { Cell, CellSolvedLoop } from './cell.js';
import { Board } from './board.js';
import { BoardCreator } from './board.js';
import { randomItem, validateImage } from './utils.js';
import { waitForFlag } from './utils.js';

class Game {
	constructor(boards) {
		this.state = {
			coolDown: false,
			cellsFading: false,
			firstRun: true,
			refresh() {
				this.cells = [];
				this.solvedCells = [];
				this.revealedCells = [];
				this.viewedCells = []; // for keeping track of avoidable mistakes
				this.usedGlyphs = [];
				this.unsolvedCells = 0;
				this.remainingMistakes = 0;
				this.avoidableMistakes = 0;
				this.pendingTrends = new Set();
				this.won = false;
				this.lost = false;
				this.announceMilestone = false;
			},
			reset() {
				this.level = 0;
				this.lives = 3;
			}
		};
		this.state.refresh();
		this.state.reset();
		this.memory = {
			previousLevel: -1,
			score: {num: 0, denominator: 1},
			saveProgress: true,
		};

		this.boards = boards;
	}
	createCells = function (numCells) {
		const fragment = document.createDocumentFragment();
		for (let i = 0; i < numCells; i++) {
			const cell = new Cell(this);
			if (Math.random() < Config.funColorChance) {
				cell.setFrontColor(randomItem(Config.colors));
			}
			if (this.state.level === 0 && numCells === Config.introMessage.length) {
				cell.writeOnFront(Config.introMessage[i]);
				cell.setFontColor(this.colorSequencerLight.nextColor());
			}
			else if (Math.random() < Config.funGlyphChance && this.state.usedGlyphs.length < Config.glyphs.length) {
				let glyph;
				do {
					glyph = randomItem(Config.glyphs);
				} while (this.state.usedGlyphs.includes(glyph));
				cell.setFrontGlyph(glyph);
				this.state.usedGlyphs.push(glyph);
			}
			fragment.appendChild(cell.getElement());
			this.state.cells.push(cell);
		}
		Elements.grid.appendChild(fragment);
	};
	activateCells = async function (board) {
		let cellsCopy = [...this.state.cells];
		let activeCellCount = 0;
		let activatedCells = [];
		// pick all of the pictures that will be given to cells
		const randomTrendKeys = await this.trendSelector.getRandomTrendKeys(this.state.cells.length / 2);
		// assign images to cells
		for (let i = 0; i < randomTrendKeys.length; i++) {
			const {key, usedTrend} = randomTrendKeys[i];
			const cellPair = [];
			for (let j = 0; j < 2; j++) {
				const index = Math.floor(Math.random() * cellsCopy.length);
				const cell = cellsCopy.splice(index, 1)[0];
				cell.activate(key, Config.trendData.trends[key]);
				cell.usedTrend = usedTrend;
				cellPair.push(cell);
				activatedCells.push(cell);
			}
			const color = this.colorSequencerDark.nextColor();
			cellPair[0].setBackColor(color);
			cellPair[1].setBackColor(color);
		}
		//
		this.state.unsolvedCells = activatedCells.length;
		this.state.remainingMistakes = activatedCells.length / 2 - 1 + board.additionalMistakes;
		// reveals the cells in random order
		cellsCopy = [...this.state.cells];
		let delay = 300;
		while (activatedCells.length > 0) {
			const index = Math.floor(Math.random() * activatedCells.length);
			const cell = activatedCells.splice(index, 1)[0];
			cell.reveal();
			if (delay > 0) {
				await new Promise(resolve => setTimeout(resolve, delay));
				delay = Math.floor(delay * 0.8);
			}
		}
	};
	deleteCells = async function (victory) {
		let cells;
		if (victory) {
			cells = [...this.state.solvedCells];
			cells.reverse();
		}
		else cells = this.state.cells;

		for (const cell of cells) cell.stopLoop();

		const numCells = cells.length;

		let totalDuration; // ms — tune this one variable
		let delayStep = 1.2;

		if (numCells <= 8) totalDuration = 2000;
		else if (numCells <= 12) totalDuration = 3000;
		else totalDuration = 4000;

		// Solve for initialDelay so the sequence sums to totalDuration
		const initialDelay = totalDuration * (delayStep - 1) / (Math.pow(delayStep, numCells) - 1);
		let currentDelay = initialDelay;
		for (const cell of cells) {
			cell.fade();
			await new Promise(resolve => setTimeout(resolve, currentDelay));
			currentDelay *= delayStep;
		}
		await new Promise(resolve => setTimeout(resolve, 500));
		for (const cell of this.state.cells) cell.remove();
		this.state.cells.length = 0;
	};
	handleClick = async function () {
		if (this.state.awaitPlayer) {
			this.state.awaitPlayer = false;
			Graphics.hidePrompt();
			this.newGame(this.state.won);
			return;
		}
		if (this.state.revealedCells.length > 1) {
			const [cell1, cell2] = this.state.revealedCells;
			if (!cell1.usedTrend) this.state.pendingTrends.add(cell1.getName());
			if (!cell2.usedTrend) this.state.pendingTrends.add(cell2.getName());
			this.state.revealedCells.length = 0;

			if (cell1.getName() === cell2.getName()) {
				cell1.solve();
				cell2.solve();
				const solvedLoop = new CellSolvedLoop(game, cell1, cell2);
				cell1.solvedLoop = solvedLoop;
				cell2.solvedLoop = solvedLoop;
				solvedLoop.start();
				this.state.unsolvedCells -= 2;
				this.state.solvedCells.push(cell1, cell2);
				if (this.state.unsolvedCells <= 0) {
					this.winGame();
				}
			}
			else {
				this.state.remainingMistakes--;
				// if either of these cells have already been viewed, this could have been avoided
				
				const promises = [];

				if (this.state.viewedCells.includes(cell1) || this.state.viewedCells.includes(cell2)) {
					this.state.avoidableMistakes++;
					const shakePromise = Promise.all([cell1.transitioning, cell2.transitioning]).then(() => {
						cell1.shake();
						cell2.shake();
						return Promise.all([cell1.transitioning, cell2.transitioning]);
					});
					promises.push(shakePromise);
				}
				else {
					// if the player turned over the first cell which they have previously seen a match to but didn't make the match
					const word1 = cell1.getName();
					for (const cell of this.state.viewedCells) {
						if (cell.getName() == word1) {
							this.state.avoidableMistakes++;
							break;
						}
					}
				}
				if (this.state.avoidableMistakes > 0) this.faceChanger.changeFace(this.state.remainingMistakes);
				if (this.state.remainingMistakes < 0) {
					this.loseGame();
					return;
				}
				this.state.cellsFading = true;
				const fadeDelay = new Promise(resolve => setTimeout(resolve, Config.fadeDelay));
				const interrupt = waitForFlag(() => this.state.cellsFading, false);
				promises.push(fadeDelay, interrupt);
				await Promise.race(promises);

				this.state.cellsFading = false;
				cell1.hide();
				cell2.hide();
			}
			for (const cell of [cell1, cell2]) {
				if (!this.state.viewedCells.includes(cell)) {
					this.state.viewedCells.push(cell);
				}
			}
		}
	};
	winGame = async function () {
		document.body.classList.remove('active');
		this.state.won = true;
		this.state.coolDown = true;
		if (this.board.giveLife) this.addLife();
		
		this.trendSelector.addTrends(this.state.pendingTrends, true);
		this.updateScore(this.trendSelector.getScore(), true);
		this.faceChanger.resetFace(true);
		this.state.level++;
		await Promise.all(this.state.solvedCells.map(cell => cell.typingDone));
		await Promise.all(this.state.solvedCells.map(cell => cell.solvedLoop.end()));
		this.state.awaitPlayer = true;
		await new Promise(r => setTimeout(r, 800));
		if (this.state.awaitPlayer) Graphics.showPrompt();
		//this.newGame(true);
	};
	loseGame = async function() {
		this.state.lost = true;
		this.state.coolDown = true;
		this.removeLife();
		this.trendSelector.addTrends(this.state.pendingTrends, false);
		await new Promise(resolve => setTimeout(resolve, 1000));
		if (this.state.lives <= 0) {
			this.restartGame();
		}
		else {
			this.newGame(false);
		}
	};
	selectMessage = function (victory) {
		if (this.state.firstRun) return null;
		if (victory) {
			if (this.memory.score.won && this.state.announceMilestone) return Config.messages.end;
			if (this.state.level <= 1) return Config.messages.intro;
			if (this.state.announceMilestone) return [`${this.memory.score.num} trends collected!`];
			if (this.state.avoidableMistakes === 0) return Config.messages.perfect;
			if (this.state.remainingMistakes === 0) return Config.messages.nearmiss;
			return Config.messages.victory;
		}
		if (this.state.level < this.memory.previousLevel) return Config.messages.gameover;
		return Config.messages.failure;
	};
	selectBoard = function () {
		const board = this.state.level <= this.boards.length - 1
			? this.boards[this.state.level]
			: BoardCreator.createBoard(this.state.level);
		if (board.cellCount < 4 || board.cellCount % 2 !== 0) {
			console.error("Please provide an even cell count greater than or equal to 4.");
			return;
		}
		return board;
	};
	newGame = async function (victory) {
		// ── Message selection (before state resets) ──────────────────
		let messageList = this.selectMessage(victory);
		// ── Board selection ──────────────────────────────────────────
		this.board = this.selectBoard();
		if (!this.board) return;
		const newCellCount = this.board.cellCount !== this.state.cells.length;
		// ── Begin teardown ───────────────────────────────────────────
		//this.state.coolDown = true;

		// Fade out grid and tooltip simultaneously, reset tooltip once faded
		Elements.grid.classList.remove('active');
		Elements.tooltip.classList.remove('active');
		Elements.tooltip.addEventListener('transitionend', () => {
			Graphics.resetToolTip(this, victory);
		}, { once: true });
		await new Promise(r => setTimeout(r, 320));
		// Wait for cells to finish fading out before removing them
		await this.deleteCells(victory);
		// ── Splash message (blocks until animation completes) ────────
		if (messageList) await Graphics.splashText(randomItem(messageList));
		
		// ── State reset ──────────────────────────────────────────────
		if (newCellCount || this.state.firstRun) await this.gridLayout.update(this.board.cellCount);
		this.state.refresh();

		// ── Build new board ──────────────────────────────────────────
		
		this.createCells(this.board.cellCount);

		

		// ── Fade grid back in ────────────────────────────────────────
		Elements.tooltip.classList.add('active');
		Elements.grid.classList.add('active');
		document.body.classList.add('active');

		// ── Activate cells (animates in one by one) ──────────────────
		await this.activateCells(this.board);

		// ── Finalise ─────────────────────────────────────────────────
		this.faceChanger.setMaxMistakes(this.state.remainingMistakes);
		this.state.coolDown = false;
		this.state.firstRun = false;
		this.memory.previousLevel = this.state.level;
	};
	restartGame = function () {
		this.state.reset();
		this.newGame(false);
	};
	addLife = function () {
		this.state.lives = Math.min(this.state.lives + 1, Config.maxLives);
		Graphics.lifeDisplay.addLife(this.state.lives);
	};
	initScore = function (score) {
		this.memory.score.num = score.num;
		this.memory.score.denominator = score.denominator;
	};
	updateScore = function(score, animate) {
		const prev = this.memory.score.num;
		this.memory.score = score;
		if (animate) game.percentScorer.interpolateScore(game.memory.score);
		let crossed = false;
		if (this.memory.score.num >= this.memory.score.denominator) {
			this.memory.score.won = true;
			crossed = prev < this.memory.score.num;
		}
		else crossed = Config.milestones.find(m => prev < m && this.memory.score.num >= m);
		this.state.announceMilestone = crossed;
		if (this.memory.saveProgress) localStorage.setItem('score', JSON.stringify(this.memory.score));
	};
	getPercentScore = function() {
		return parseFloat((this.memory.score.num / this.memory.score.denominator * 100).toFixed(Config.scoreRounding));
	}

	removeLife = function () {
		Graphics.lifeDisplay.removeLife(this.state.lives--);
	};
}

const TrendSelector = function (trendData, game) {
	const trends = trendData.trends;
	const fetchedDate = trendData.fetchedDate;
	const keys = {
		unused: new Set(Object.keys(trends)),
		used: new Set(),
		deferred: new Set(),
		unusable: new Set(),
	};
	let validatedImages = new Set();
	this.restoreKeys = function (restoredKeys) {
		if (restoredKeys) {
			keys.unused = new Set((restoredKeys.unused ?? []).filter(k => trends[k]));
			keys.deferred = new Set((restoredKeys.deferred ?? []).filter(k => trends[k]));
			keys.used = new Set((restoredKeys.used ?? []).filter(k => trends[k]));
			keys.unusable = new Set((restoredKeys.unusable ?? []).filter(k => trends[k]));

			// add any new keys not seen in localStorage
			const allRestored = [keys.unused, keys.deferred, keys.used, keys.unusable];
			for (const key of Object.keys(trends)) {
				if (!allRestored.some(set => set.has(key))) {
					keys.unused.add(key);
				}
			}

			if (!Config.deferViewedTrends) {
				keys.deferred.forEach(k => keys.unused.add(k));
				keys.deferred.clear();
			}
		}
	};
	this.restoreValidated = function(saved) {
		if (saved) validatedImages = new Set(saved.filter(url => {
			// only keep validated URLs that still exist in current trend data
			return Object.values(trends).some(t => t.url === url);
		}));
	};
	async function isImageValid(url) {
		if (validatedImages.has(url)) return true;
		const valid = await validateImage(url);
		if (valid) validatedImages.add(url);
		return valid;
	}

	function moveKey(key, from, to) {
		if (!from.has(key)) return false;
		from.delete(key);
		to.add(key);
		return true;
	}
	this.deferUsed = function () {
		keys.used.forEach(k => keys.deferred.add(k));
		keys.used.clear();
	};
	this.markUsed = function (key) {
		if (!moveKey(key, keys.unused, keys.used))
			moveKey(key, keys.deferred, keys.used);
	};
	function markUnusable (key) {
		if (!moveKey(key, keys.unused, keys.unusable))
			if (!moveKey(key, keys.deferred, keys.unusable))
				moveKey(key, keys.used, keys.unusable);
	};
	this.markViewed = function(key) {
		if (Config.deferViewedTrends) {
			moveKey(key, keys.unused, keys.deferred);
		}
	};
	this.addTrends = function (trendSet, victory) {
		if (trendSet.size < 1) return;
		if (victory) {
			for (const trend of trendSet) this.markUsed(trend);
		}
		else {
			for (const trend of trendSet) this.markViewed(trend);
		}
		if (game.memory.saveProgress) this.saveData();
	};
	this.getRandomTrendKeys = async function(amount) {
		const MAX_TRIES = 10;
		const usedImages = [];
		const randomTrendKeys = [];

		const unusedKeys = [...keys.unused];
		const deferredKeys = [...keys.deferred];
		const usedKeys = [...keys.used];
		for (let i = 0; i < amount; i++) {
			let key;
			let usedTrend = false;

			let tries = 0;
			let imageValid = false;
			while (!imageValid && tries < MAX_TRIES) {
				tries++;

				let pool;
				if (unusedKeys.length > 0) pool = unusedKeys;
				else if (deferredKeys.length > 0) pool = deferredKeys;
				else { pool = usedKeys; usedTrend = true; }
				if (pool.length === 0) break;
				const index = Math.floor(Math.random() * pool.length);
				key = pool.splice(index, 1)[0];
				const image = trends[key]?.url?.[0];
				if (usedImages.includes(image)) continue;
				imageValid = (await isImageValid(image));
				if (!imageValid) markUnusable(key);
				usedImages.push(image);	
			}
			if (!imageValid) {
				console.error("No word with picture found.");
				continue;
			}
			randomTrendKeys.push({key, usedTrend});
		}
		return randomTrendKeys;
	};
	this.getScore = function() {
		return { num: keys.used.size, denominator: trendData.count - keys.unusable.size};
	};
	this.saveData = function () {
		const data = {
			unused: [...keys.unused],
			used: [...keys.used],
			deferred: [...keys.deferred],
			unusable: [...keys.unusable],
		};
		localStorage.setItem('trendKeys', JSON.stringify(data));
		localStorage.setItem('validatedImages', JSON.stringify([...validatedImages]));
		localStorage.setItem('fetchedDate', fetchedDate);
	};
};

async function init() {
	await Config.getCategories();
	const boards = [
		new Board(4, Config.trendData.trends),
		new Board(8, Config.trendData.trends, 2, true),
	];
	const game = new Game(boards);
	game.gridLayout = new GridLayout(Elements);
	game.faceChanger = new Graphics.faceChanger(game);
	game.trendSelector = new TrendSelector(Config.trendData, game);
	game.percentScorer = new Graphics.PercentScorer(game.memory.score);
	game.colorSequencerDark = new Graphics.colorSequencer(Config.darkColors);
	game.colorSequencerLight = new Graphics.colorSequencer(Config.colors);
	
	//
	const localDate = localStorage.getItem('fetchedDate');
	const newDate = Config.trendData.fetchedDate;
	const dateMatch = newDate && (localDate === newDate);
	
	let restoredScore = 0;
	if (newDate) {
		game.memory.saveProgress = true;
		if (dateMatch) {
			try {
				const savedKeys = JSON.parse(localStorage.getItem('trendKeys'));
				game.trendSelector.restoreKeys(savedKeys);
			} catch {}
			try {
				const saved = JSON.parse(localStorage.getItem('validatedImages'));
				if (saved) game.trendSelector.restoreValidated(saved);
			} catch {}
			try {
				const saved = JSON.parse(localStorage.getItem('score'));
				if (saved) restoredScore = saved.num;
			} catch {}
		} else {
			localStorage.removeItem('trendKeys');
			localStorage.removeItem('fetchedDate');
			localStorage.removeItem('score');
		}
	} else game.memory.saveProgress = false;
	game.initScore(game.trendSelector.getScore());
	Graphics.resetToolTip(game, true);
	globalThis.game = game;
	game.newGame(true);
	window.addEventListener('resize', () => game.gridLayout.resizeGrid());
	window.addEventListener('click', () => game.handleClick());
	Elements.faceDisplay.addEventListener('click', () => {
		game.loseGame();
	});
}
init();