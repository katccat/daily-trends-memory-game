import { Config } from './config.js';
import { Elements } from './graphics.js';
import { Graphics } from './graphics.js';
import { GridLayout } from './gridlayout.js';
import { Cell } from './cell.js';
import { Board } from './board.js';
import { BoardCreator } from './board.js';
import { ImageValidator, randomItem, waitForFlag, shuffle } from './utils.js';
import { CellLoopScheduler } from './CellSolvedLoop.js';

class Game {
	constructor() {
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
			challengeMode: false,
		};

		this.boards = [
			new Board(4, Config.trendData.trends),
			new Board(8, Config.trendData.trends, 2, true),
		];
	}
	createCells = function (numCells) {
		const fragment = document.createDocumentFragment();
		const introMessage = Config.getIntroMessage();
		for (let i = 0; i < numCells; i++) {
			const cell = new Cell(this);
			if (Math.random() < Config.funColorChance) {
				cell.setFrontColor(randomItem(Config.colors));
			}
			if (this.state.level === 0 && numCells === 4) {
				cell.writeOnFront(introMessage[i]);
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
		let activatedCells = [];
		// pick all of the pictures that will be given to cells
		const randomTrendKeys = await this.trendSelector.getRandomTrendKeys(this.state.cells.length / 2);
		// assign images to cells
		for (let i = 0; i < randomTrendKeys.length; i++) {
			const {key, usedTrend} = randomTrendKeys[i];
			const trendObject = Config.trendData.trends[key];
			if (!this.memory.challengeMode) shuffle(trendObject.url);
			const images = [...trendObject.url];
			const cellPair = [];
			for (let j = 0; j < 2; j++) {
				const index = Math.floor(Math.random() * cellsCopy.length);
				const cell = cellsCopy.splice(index, 1)[0];
				if (this.memory.challengeMode && images.length > 0) {
					const imageIndex = Math.floor(Math.random() * images.length);
					const url = images.splice(imageIndex, 1);
					cell.activate(key, {...trendObject, url: url});
				}
				else cell.activate(key, trendObject);
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

		const numCells = cells.length;

		let totalDuration; // ms — tune this one variable
		let delayStep = 1.2;

		if (!victory) totalDuration = 1000;
		else if (numCells <= 8) totalDuration = 2000;
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
				game.cellLoopScheduler.newLoop(cell1, cell2);
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
				if (this.state.avoidableMistakes > 0) {
					this.faceChanger.changeFace();
					// if (this.state.remainingMistakes <= 3 && this.state.remainingMistakes >= 0) Graphics.flashMessage(this.state.remainingMistakes);
				}
				if (this.state.remainingMistakes < 0) {
					this.loseGame();
					return;
				}
				this.state.cellsFading = true;
				const fadeDelay = new Promise(resolve => setTimeout(resolve, Config.delay.fade));
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
		this.faceChanger.resetFace(true, true);
		this.state.level++;
		await this.cellLoopScheduler.endScreen();
		this.state.awaitPlayer = true;
		const showDelay = Config.delay.showContinuePrompt;
		await new Promise(r => setTimeout(r, showDelay));
		if (this.state.awaitPlayer) {
			Graphics.showPrompt();
			const fadeDelay = Config.delay.changeCellLabel - showDelay;
			await new Promise(r => setTimeout(r, fadeDelay));
			Graphics.hidePrompt();
		}
	};
	loseGame = async function() {
		this.state.lost = true;
		this.state.coolDown = true;
		this.removeLife();
		this.trendSelector.addTrends(this.state.pendingTrends, false);
		const gameOver = this.state.lives <= 0;
		if (!this.memory.score.won) {
			const removeNum = gameOver ? Config.removeAmountWhenGameOver : Config.removeAmountWhenLose;
			this.trendSelector.removeTrends(removeNum);
			await this.updateScore(this.trendSelector.getScore(), true);
		}
		await new Promise(resolve => setTimeout(resolve, Config.delay.loseTransition));

		if (gameOver) this.restartGame();
		else this.newGame(false);
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
			: BoardCreator.createBoard(this.state.level, this.memory.challengeMode);
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
		this.cellLoopScheduler.stop();
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
		this.state.coolDown = false;
		this.state.firstRun = false;
		this.memory.previousLevel = this.state.level;
	};
	restartGame = function () {
		this.state.reset();
		this.newGame(false);
	};
	
	toggleChallengeMode = function (state) {
		this.memory.challengeMode = state;
		if (state === true) Elements.tooltip.classList.add('red');
		else Elements.tooltip.classList.remove('red');
	}
	updateScore = async function(score, animate) {
		const prev = this.memory.score.num;
		this.memory.score = score;

		if (this.memory.score.num >= this.memory.score.denominator) {
			this.memory.score.won = true;
		}
		if (animate) {
			await game.percentScorer.interpolateScore(game.memory.score);
			let crossed = false;
			if (this.memory.score.won) {
				crossed = prev < this.memory.score.num;
			}
			else crossed = Config.milestones.find(m => prev < m && this.memory.score.num >= m);
			this.state.announceMilestone = crossed;
		}
		if (this.memory.saveProgress) localStorage.setItem('score', JSON.stringify(this.memory.score));
	};
	getPercentScore = function() {
		return parseFloat((this.memory.score.num / this.memory.score.denominator * 100).toFixed(Config.scoreRounding));
	}
	addLife = function () {
		this.state.lives = Math.min(this.state.lives + 1, Config.maxLives);
	};
	removeLife = function () {
		this.state.lives = Math.max(this.state.lives - 1, 0);
	};
}

const TrendSelector = function (trendData, game) {
	const trends = trendData.trends;
	const keys = {
		unused: new Set(Object.keys(trends)),
		used: new Set(),
		deferred: new Set(),
		unusable: new Set(),
	};
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
		moveKey(key, keys.unused, keys.deferred);
	};
	this.addTrends = function (trendSet, victory) {
		if (trendSet.size < 1) return;
		if (victory) {
			for (const trend of trendSet) this.markUsed(trend);
		}
		else if (Config.deferViewedTrends) {
			for (const trend of trendSet) this.markViewed(trend);
		}
		if (game.memory.saveProgress) this.saveData();
	};
	this.removeTrends = function (amount) {
		const usedKeys = [...keys.used];
		amount = Math.min(amount, usedKeys.length);
		const destinationSet = Config.deferViewedTrends ? keys.deferred : keys.unused;
		for (let i = 0; i < amount; i++) {
			const index = Math.floor(Math.random() * usedKeys.length);
			const key = usedKeys.splice(index, 1)[0];
			moveKey(key, keys.used, destinationSet);
		}
		if (game.memory.saveProgress) this.saveData();
	}
	this.getRandomTrendKeys = async function (amount) {
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
			let validKeyFound = false;

			while (!validKeyFound && tries < MAX_TRIES) {
				tries++;
				let pool;
				if (unusedKeys.length > 0) pool = unusedKeys;
				else if (deferredKeys.length > 0) pool = deferredKeys;
				else { pool = usedKeys; usedTrend = true; }

				if (pool.length === 0) break;

				const index = Math.floor(Math.random() * pool.length);
				key = pool.splice(index, 1)[0];
				const trendObject = trends[key];
				// 1. Normalize URLs into an array
				let urlList = Array.isArray(trendObject.url) ? trendObject.url : [trendObject.url];
				
				if (urlList.length === 0 || urlList[0] === undefined) {
					markUnusable(key);
					continue;
				}

				// 2. Filter out images already used in this specific selection batch
				urlList = urlList.filter(img => !usedImages.includes(img));

				// 3. Validate URLs and remove the bad ones from the master data
				const validationResults = await Promise.all(
					urlList.map(async (img) => ({
						url: img,
						isValid: await game.imageValidator.isValid(img)
					}))
				);

				const validUrls = validationResults.filter(r => r.isValid).map(r => r.url);

				// 4. Update the actual trendData reference to remove broken links permanently
				trendObject.url = validUrls;

				if ((validUrls.length > 0 && !game.memory.challengeMode) || (validUrls.length >= 2)) {
					validKeyFound = true;
					usedImages.push(...validUrls);
				} else {
					// If no URLs remain valid, mark the whole trend as unusable
					markUnusable(key);
				}
			}

			if (!validKeyFound) {
				console.error("No word with picture found.");
				continue;
			}
			randomTrendKeys.push({ key, usedTrend });
		}
		return randomTrendKeys;
	};
	this.getScore = function() {
		return { num: keys.used.size, denominator: Object.keys(trends).length - keys.unusable.size};
	};
	this.saveData = function () {
		const data = {
			unused: [...keys.unused],
			used: [...keys.used],
			deferred: [...keys.deferred],
			unusable: [...keys.unusable],
		};
		localStorage.setItem('trendKeys', JSON.stringify(data));
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
	game.imageValidator = new ImageValidator();
	game.trendSelector = new TrendSelector(Config.trendData, game);
	game.percentScorer = new Graphics.PercentScorer(game.memory.score);
	game.cellLoopScheduler = new CellLoopScheduler();
	game.colorSequencerDark = new Graphics.colorSequencer(Config.darkColors);
	game.colorSequencerLight = new Graphics.colorSequencer(Config.colors);
	
	//
	const localDate = localStorage.getItem('fetchedDate');
	const newDate = Config.trendData.fetchedDate;
	const dateMatch = newDate && (localDate === newDate);
	
	if (newDate) {
		game.memory.saveProgress = true;
		if (dateMatch) {
			try {
				const saved = JSON.parse(localStorage.getItem('trendKeys'));
				game.trendSelector.restoreKeys(saved);
			} catch {}
			try {
				const saved = JSON.parse(localStorage.getItem('images'));
				if (saved) game.imageValidator.restore(saved);
			} catch {}
			try {
				const saved = JSON.parse(localStorage.getItem('score'));
				// if (saved) game.memory.score.won = !!saved.won;
			} catch {}
		} else {
			localStorage.removeItem('trendKeys');
			localStorage.removeItem('images');
			localStorage.removeItem('score');
		}
		localStorage.setItem('fetchedDate', newDate);
	} else {
		game.memory.saveProgress = false;
		localStorage.removeItem('fetchedDate');
	};
	game.updateScore(game.trendSelector.getScore(), false);
	Graphics.resetToolTip(game, true);
	globalThis.game = game;
	game.newGame(true);
	window.addEventListener('resize', () => game.gridLayout.resizeGrid());
	Elements.grid.addEventListener('click', () => game.handleClick());
	Elements.faceDisplay.addEventListener('click', () => {
		game.toggleChallengeMode(!game.memory.challengeMode);
	});
}
init();
// document.addEventListener('click', () => {
// 	// Graphics.splashText("I'm feeling lucky");
// 	Graphics.flashImage("images/faces/7a.png");
// })