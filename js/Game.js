import { Config } from './config.js';
import { Elements } from './graphics.js';
import { Graphics } from './graphics.js';
import { GridLayout } from './gridlayout.js';
import { Cell } from './cell.js';
import { Board } from './board.js';
import { BoardCreator } from './board.js';
import { randomItem, shuffle } from './utils.js';
import { CellLoopScheduler } from './CellSolvedLoop.js';
import { TrendSelector } from './TrendSelector.js';
import { handleClick } from './handleClick.js';

export class Game {
	constructor(trendData) {
		this.trendData = trendData;
		this.gameDate = trendData.fetchedDate;
		this.state = {
			coolDown: false,
			cellsFading: false,
			firstRun: true,
			refresh() {
				this.cells = [];
				this.solvedCells = [];
				this.revealedCells = [];
				this.viewedCells = []; // for keeping track of avoidable mistakes
				this.unsolvedCells = 0;
				this.remainingMistakes = 0;
				this.avoidableMistakes = 0;
				this.pendingTrends = new Set();
				this.victory = false;
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
			new Board(4, 0),
			new Board(8, 1),
		];
		this.gridLayout = new GridLayout(Elements);
		this.faceChanger = new Graphics.faceChanger(this);
		this.trendSelector = new TrendSelector(trendData, this);
		this.percentScorer = new Graphics.PercentScorer(this.memory.score);
		this.cellLoopScheduler = new CellLoopScheduler();
		this.colorSequencerDark = new Graphics.colorSequencer(Config.darkColors);
		this.colorSequencerLight = new Graphics.colorSequencer(Config.colors);
		this.restore();

		this._resizeHandler = () => this.gridLayout.resizeGrid();
		this._gridClickHandler = () => handleClick(this);

		window.addEventListener('resize', this._resizeHandler);
		Elements.grid.addEventListener('click', this._gridClickHandler);
	}
	restore = function() {
		const date = this.gameDate;
		if (!date) {
			this.memory.saveProgress = false;
			return;
		}
		const savedData = JSON.parse(localStorage.getItem(this.gameDate));
		let trendKeysRestored;
		if (savedData) {
			try {
				const saved = savedData.trendKeys;
				this.trendSelector.restoreKeys(saved);
				trendKeysRestored = true;
			} catch {
				trendKeysRestored = false;
			}
			try {
				const saved = savedData.score;
				if (saved) this.memory.score = saved;
			} catch { }
			if (!trendKeysRestored) return;
			try {
				const saved = savedData.session;
				if (saved) {
					this.board = saved.board
					this.state.level = saved.level;
					this.state.lives = saved.lives;
				}
			} catch { }
		}
		this.updateScore(this.trendSelector.getScore(), false);
		this.memory.saveProgress = true;
	}
	createCells = function (numCells) {
		const fragment = document.createDocumentFragment();
		const introMessage = Config.getIntroMessage();
		const usedGlyphs = [];
		for (let i = 0; i < numCells; i++) {
			const cell = new Cell(this);
			if (Math.random() < Config.funColorChance) {
				cell.setFrontColor(randomItem(Config.colors));
			}
			if (this.state.level === 0 && numCells === 4) {
				cell.writeOnFront(introMessage[i]);
				cell.setFontColor(this.colorSequencerLight.nextColor());
			}
			else if (Math.random() < Config.funGlyphChance && usedGlyphs.length < Config.glyphs.length) {
				let glyph;
				do {
					glyph = randomItem(Config.glyphs);
				} while (usedGlyphs.includes(glyph));
				cell.setFrontGlyph(glyph);
				usedGlyphs.push(glyph);
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
			const trendObject = this.trendData.trends[key];
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

		if (cells.length < 1) return;

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
	
	winGame = async function () {
		this.state.victory = true;
		this.state.coolDown = true;
		if (this.board.giveLife) this.addLife();
		
		this.trendSelector.addTrends(this.state.pendingTrends, true);
		this.updateScore(this.trendSelector.getScore(), true);
		this.faceChanger.resetFace(true, true);
		this.state.level++;
		this.saveData('session', {
			board: null,
			level: this.state.level,
			lives: this.state.lives,
		});
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
		this.state.victory = false;
		this.state.coolDown = true;
		this.removeLife();
		this.trendSelector.addTrends(this.state.pendingTrends, false);
		const gameOver = this.state.lives <= 0;
		this.saveData('session', {
			board: null,
			level: gameOver ? 0 : this.state.level,
			lives: gameOver ? Config.maxLives : this.state.lives,
		});
		if (!this.memory.score.won) {
			const removeNum = gameOver ? Config.removeAmountWhenGameOver : Config.removeAmountWhenLose;
			if (removeNum > 0) {
				this.trendSelector.removeTrends(removeNum);
				await this.updateScore(this.trendSelector.getScore(), true);
			}
		}
		await new Promise(resolve => setTimeout(resolve, Config.delay.loseTransition));

		if (gameOver) this.restartGame();
		else this.newGame(false);
	};
	selectMessage = function (victory) {
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
		let messageList = !this.state.firstRun ? this.selectMessage(victory) : null;
		// ── Board selection ──────────────────────────────────────────
		if (!(this.board && this.state.firstRun)) this.board = this.selectBoard();
		if (!this.board) return;
		const newCellCount = (this.board.cellCount !== this.state.cells.length) || this.state.firstRun;
		// ── Begin teardown ───────────────────────────────────────────
		//this.state.coolDown = true;

		// Fade out grid and tooltip simultaneously, reset tooltip once faded
		Elements.grid.classList.remove('active');
		Elements.tooltip.classList.remove('active');
		Elements.tooltip.addEventListener('transitionend', () => {
			Graphics.resetToolTip(this, victory || this.state.firstRun);
		}, { once: true });
		await new Promise(r => setTimeout(r, 320));
		// Wait for cells to finish fading out before removing them
		await this.deleteCells(victory);
		this.cellLoopScheduler.stop();
		// ── Splash message (blocks until animation completes) ────────
		if (messageList) await Graphics.splashText(randomItem(messageList));
		
		// ── State reset ──────────────────────────────────────────────
		if (newCellCount) await this.gridLayout.update(this.board.cellCount);
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
		this.saveData('session', {
			board: this.board,
			level: this.state.level,
			lives: this.state.lives,
		});
	};
	destroy = function () {
		window.removeEventListener('resize', this._resizeHandler);
		Elements.grid.removeEventListener('click', this._gridClickHandler);

		this.cellLoopScheduler.stop();

		for (const cell of this.state.cells) cell.remove();
		this.state.cells.length = 0;

		this.state.coolDown = true;
	};
	restartGame = function () {
		this.state.reset();
		this.newGame(false);
	};
	
	updateScore = async function(score, animate) {
		const prev = {num: this.memory.score.num, denominator: this.memory.score.denominator};
		this.memory.score.num = score.num;
		this.memory.score.denominator = score.denominator;

		if (this.memory.score.num >= this.memory.score.denominator) {
			this.memory.score.won = true;
		}
		if (animate) {
			await this.percentScorer.interpolateScore(prev, this.memory.score);
			let crossed = false;
			if (this.memory.score.won) {
				crossed = prev.num < this.memory.score.num;
			}
			else crossed = Config.milestones.find(m => prev.num < m && this.memory.score.num >= m);
			this.state.announceMilestone = crossed;
		}
		this.saveData('score', this.memory.score);
	};
	saveData = function(property, data) {
		if (!this.memory.saveProgress) return;
		const dateEntry = JSON.parse(localStorage.getItem(this.gameDate) || '{}');
		dateEntry[property] = data;
		localStorage.setItem(this.gameDate, JSON.stringify(dateEntry));
	}
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