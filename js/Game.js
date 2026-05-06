import { Config } from './config.js';
import { Elements } from './Graphics.js';
import { Graphics } from './Graphics.js';
import { GridLayout } from './gridlayout.js';
import { Cell } from './Cell.js';
import { Board } from './board.js';
import { BoardCreator } from './board.js';
import { randomItem, shuffle } from './utils.js';
import { CellLoopScheduler } from './CellSolvedLoop.js';
import { TrendSelector } from './TrendSelector.js';
import { handleClick } from './handleClick.js';
import { PixelTransition } from './PixelTransition.js';
import { TrendHistogram } from './TrendHistogram.js';
import { soundEffects } from './SoundEffects.js';

export class Game {
	constructor(trendData, challengeMode = false) {
		this.trendData = trendData;
		this.gameDate = trendData.fetchedDate;
		this.saveProgress = true;
		this.challengeMode = challengeMode;
		if (this.challengeMode) Elements.tooltip.classList.add('red');
		else Elements.tooltip.classList.remove('red');
		this.state = {
			coolDown: false,
			cellsFading: false,
			firstRun: true,
			previousLevel: -1,
			score: { num: 0, denominator: 1 },
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
		this.boards = [];
		
		if (this.challengeMode) this.boards.push(new Board(4, 1));
		else this.boards.push(new Board(4, 0), new Board(8, 0));
		
		this.gridLayout = new GridLayout(Elements);
		this.faceChanger = new Graphics.faceChanger(this);
		this.trendSelector = new TrendSelector(trendData, this);
		this.trendHistogram = new TrendHistogram(trendData, Elements.histogramContainer);
		this.percentScorer = new Graphics.PercentScorer(this.state.score);
		this.cellLoopScheduler = new CellLoopScheduler();
		this.pixelTransition = new PixelTransition();
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
			this.saveProgress = false;
			return;
		}
		const dateEntry = JSON.parse(localStorage.getItem(this.gameDate));
		let savedData;
		if (dateEntry) {
			if (this.challengeMode) {
				savedData = dateEntry.challenge;
			} else {
				// fall back to top-level dateEntry if normal sub-object doesn't exist (backward compat)
				savedData = dateEntry.normal ?? dateEntry;
			}
		}
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
				if (saved) this.state.score = saved;
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
		this.trendHistogram.updateTrends(this.trendSelector.getAllUsedTrends());
		this.trendHistogram.rescale();
		this.saveProgress = true;
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
	activateCells = async function (board, animate = true) {
		let cellsCopy = [...this.state.cells];
		let activatedCells = [];
		// pick all of the pictures that will be given to cells
		const randomTrendKeys = await this.trendSelector.getRandomTrendKeys(this.state.cells.length / 2);
		// assign images to cells
		for (let i = 0; i < randomTrendKeys.length; i++) {
			const {key, usedTrend} = randomTrendKeys[i];
			const trendObject = this.trendData.trends[key];
			if (!this.challengeMode) shuffle(trendObject.url);
			const images = [...trendObject.url];
			const cellPair = [];
			for (let j = 0; j < 2; j++) {
				const index = Math.floor(Math.random() * cellsCopy.length);
				const cell = cellsCopy.splice(index, 1)[0];
				if (this.challengeMode && images.length > 0) {
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
			cellPair.forEach(cell => {
				cell.setBackColor(color);
				if (!animate) cell.reveal();
			});
		}
		//
		this.state.unsolvedCells = activatedCells.length;
		this.state.remainingMistakes = activatedCells.length / 2 - 1 + board.additionalMistakes;
		if (!animate) return;
		// reveals the cells in random order
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

		if (victory) {
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
		}
		for (const cell of this.state.cells) cell.remove();
		this.state.cells.length = 0;
	};
	
	winGame = async function () {
		this.state.victory = true;
		this.state.coolDown = true;
		if (this.board.giveLife) this.addLife();
		
		this.trendSelector.addTrends(this.state.pendingTrends, true);
		this.trendHistogram.updateTrends(this.trendSelector.getAllUsedTrends());
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
		if (!this.state.score.won) {
			const removeNum = gameOver ? Config.removeAmountWhenGameOver : Config.removeAmountWhenLose;
			if (removeNum > 0) {
				this.trendSelector.removeTrends(removeNum);
				await this.updateScore(this.trendSelector.getScore(), true);
			}
		}
		this.trendHistogram.updateTrends(this.trendSelector.getAllUsedTrends());
		await new Promise(resolve => setTimeout(resolve, Config.delay.loseTransition));

		if (gameOver) this.restartGame();
		else this.newGame(false);
	};
	showPostGame = async function(text, showTrendHistogram = true) {
		const typeSpeed = 90;
		Elements.splashContainer.classList.add('fade-in');
		if (showTrendHistogram) {
			soundEffects.marimba();
			await Promise.all([
				Graphics.typeText(text, typeSpeed, true, Elements.splashText), 
				this.trendHistogram.rescale()
			]);
		} else {
			this.trendHistogram.hide();
			await Graphics.typeText(text, typeSpeed, true, Elements.splashText);
		}
		Elements.splashContainer.classList.remove('fade-in');
	};
	selectMessage = function (victory) {
		if (victory) {
			if (this.state.score.won && this.state.announceMilestone) return Config.messages.end;
			if (this.state.level <= 0) {
				const messages = Config.messages.intro;
				return this.challengeMode ? messages.challenge : messages.normal;
			}
			if (this.state.announceMilestone) return [`${this.state.score.num} trends collected!`];
			if (this.state.avoidableMistakes === 0) return Config.messages.perfect;
			if (this.state.remainingMistakes === 0) return Config.messages.nearmiss;
			return Config.messages.victory;
		}
		if (this.state.level < this.state.previousLevel) return Config.messages.gameover;
		return Config.messages.failure;
	};
	selectBoard = function () {
		const board = this.state.level <= this.boards.length - 1
			? this.boards[this.state.level]
			: BoardCreator.createBoard(this.state.level, this.state.lives, this.challengeMode);
		if (board.cellCount < 4 || board.cellCount % 2 !== 0) {
			console.error("Please provide an even cell count greater than or equal to 4.");
			return;
		}
		return board;
	};
	newGame = async function (victory) {
		this.cellLoopScheduler.stop();
		// ── Message selection (before state resets) ──────────────────
		let messageList;
		if (!this.state.firstRun) {
			messageList = this.selectMessage(!!victory || this.state.firstRun);
		}
		// ── Board selection ──────────────────────────────────────────
		if (!(this.board && this.state.firstRun)) this.board = this.selectBoard();
		if (!this.board) return;
		const newCellCount = (this.board.cellCount !== this.state.cells.length) || this.state.firstRun;
		// ── Begin teardown ───────────────────────────────────────────
		//this.state.coolDown = true;
		// On a loss, fill the pixel mosaic in simultaneously so it covers the grid as cells disappear
		const useMosaic = (!victory && !this.state.firstRun);
		if (useMosaic) {
			Elements.gameContainer.classList.remove('shadow');
			await this.pixelTransition.fillIn();
		}

		// Fade out grid and tooltip simultaneously, reset tooltip once faded
		if (!this.state.firstRun && !!victory) {
			Elements.grid.classList.remove('active');
			Elements.tooltip.classList.remove('active');
			Elements.tooltip.addEventListener('transitionend', () => {
				Graphics.resetToolTip(this, !!victory);
			}, { once: true });
		}
		else Graphics.resetToolTip(this, this.state.firstRun);
		if (!useMosaic) await new Promise(r => setTimeout(r, 320));
		// Wait for cells to finish fading out before removing them
		
		await this.deleteCells(!!victory);
		
		// ── Splash message (blocks until animation completes) ────────

		if (messageList) await this.showPostGame(randomItem(messageList), (!!victory && !this.state.firstRun));
		
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
		await this.activateCells(this.board, !!victory);

		// ── Undo pixel mosaic, revealing the new cells ───────────────
		if (useMosaic) await this.pixelTransition.fillOut();
		Elements.gameContainer.classList.add('shadow');

		// ── Finalise ─────────────────────────────────────────────────
		this.state.coolDown = false;
		this.state.firstRun = false;
		this.state.previousLevel = this.state.level;
		this.saveData('session', {
			board: this.board,
			level: this.state.level,
			lives: this.state.lives,
		});
	};
	destroy = function () {
		Elements.grid.classList.remove('active');
		Elements.tooltip.classList.remove('active');
		window.removeEventListener('resize', this._resizeHandler);
		Elements.grid.removeEventListener('click', this._gridClickHandler);
		this.pixelTransition.destroy();

		this.cellLoopScheduler.stop();
		Graphics.hidePrompt();
		for (const cell of this.state.cells) cell.remove();
		this.state.cells.length = 0;

		this.state.coolDown = true;
	};
	restartGame = function () {
		this.state.reset();
		this.newGame(false);
	};
	
	updateScore = async function(score, animate) {
		const prev = {num: this.state.score.num, denominator: this.state.score.denominator};
		this.state.score.num = score.num;
		this.state.score.denominator = score.denominator;

		if (this.state.score.num >= this.state.score.denominator) {
			this.state.score.won = true;
		}
		if (animate) {
			await this.percentScorer.interpolateScore(prev, this.state.score);
			let crossed = false;
			if (this.state.score.won) {
				crossed = prev.num < this.state.score.num;
			}
			else crossed = Config.milestones.find(m => prev.num < m && this.state.score.num >= m);
			this.state.announceMilestone = crossed;
		}
		this.saveData('score', this.state.score);
	};
	saveData = function(property, data) {
		if (!this.saveProgress) return;
		const dateEntry = JSON.parse(localStorage.getItem(this.gameDate) || '{}');
		const modeKey = this.challengeMode ? 'challenge' : 'normal';
		if (!dateEntry[modeKey]) dateEntry[modeKey] = {};
		dateEntry[modeKey][property] = data;
		localStorage.setItem(this.gameDate, JSON.stringify(dateEntry));
	}
	addLife = function () {
		this.state.lives = Math.min(this.state.lives + 1, Config.maxLives);
	};
	removeLife = function () {
		this.state.lives = Math.max(this.state.lives - 1, 0);
	};
}