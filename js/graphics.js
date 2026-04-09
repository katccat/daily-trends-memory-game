import { Config } from "./config.js";

export const Elements = {
	grid: document.getElementById('grid'),
	gridContainer: document.getElementById('grid-container'),
	tooltip: document.getElementById('tooltip'),
	title: document.getElementById('title'),
	levelDisplay: document.getElementById('level-counter'),
	scoreDisplay: document.getElementById('score-counter'),
	splashText: document.getElementById('splash-text'),
	messageContainer: document.getElementById('in-game-message-container'),
	messageText: document.getElementById('in-game-message'),
	splashContainer: document.getElementById('splash-container'),
	faceDisplay: document.getElementById('face'),
	faceOverlay: document.getElementById('glasses'),
	continuePrompt: document.getElementById('continue-prompt'),
};
export class Graphics {};

Graphics.faceChanger = function(game) {
	this.game = game;
	const faceImages = {
		mistake1: [//1 2 
			'images/faces/2.png',
			'images/faces/3a.png',
			//'images/faces/4a.png',
		],
		mistake2: [
			'images/faces/3b.png',
			'images/faces/4b.png',
			'images/faces/4b.gif',
			'images/faces/5b.gif',
		],
		default: 'images/faces/1.png',
		died: 'images/faces/7b.png',
		diedImmediately: 'images/faces/7a.png',
		special1: 'images/faces/special1.png',
		special2: 'images/faces/special2.gif',
		special3: 'images/faces/special3.gif',
		trophy: 'images/faces/trophy_resized.gif',
		brokenGlasses: 'images/faces/break.gif',
	};

	let maxMistakes;
	let doSequence2 = false;
	let special = false
	let dead = false;
	const faceDisplay = Elements.faceDisplay;
	const faceOverlay = Elements.faceOverlay;

	this.setMaxMistakes = function (mistakes) {
		maxMistakes = mistakes;
	}
	this.changeFace = function () {
		if (dead) return;
		if (this.game.state.remainingMistakes < 0) {
			if (this.game.state.avoidableMistakes == 1) {
				if (special) faceOverlay.src = faceImages.brokenGlasses + '?t=' + Date.now();
				faceDisplay.src = faceImages.diedImmediately;
			}
			else {
				faceDisplay.src = faceImages.died;
			}
			dead = true;
			return;
		}
		let length;
		if (this.game.state.avoidableMistakes > 1) {
			doSequence2 = true;
			length = faceImages.mistake2.length;
		}
		else length = faceImages.mistake1.length;

		let progress = maxMistakes - Math.max(this.game.state.remainingMistakes, 0);
		let index = Math.min(Math.round(
			(progress / maxMistakes) * (length - 1)
		), length - 1);

		if (doSequence2) faceDisplay.src = faceImages.mistake2[index];
		else faceDisplay.src = faceImages.mistake1[index];
		if (special) faceOverlay.src = faceImages.brokenGlasses + '?t=' + Date.now();
		special = false;
	}
	this.resetFace = function (victory = false) {
		const score = game.getPercentScore();
		if (victory && score >= 50) {
			special = true;
			if (score >= 100) {
				faceDisplay.src = faceImages.trophy
			}
			else if (score >= 90) {
				faceDisplay.src = faceImages.special3;
			}
			else if (score >= 75) {
				faceDisplay.src = faceImages.special2;
			}
			else {
				faceDisplay.src = faceImages.special1;
			}
		}
		else {
			special = false;
			faceDisplay.src = faceImages.default;
		}
		doSequence2 = false;
		dead = false;
	}
}
Graphics.splashText = async function (text) {
	const splashContainer = Elements.splashContainer;
	Elements.splashContainer.classList.add('fade-in');
	await this.typeText(text, 90, Elements.splashText);
	Elements.splashContainer.classList.remove('fade-in');
};
Graphics.flashMessage = async function (text) {
	Elements.messageText.textContent = text;
	const animation = Config.animation.splash;
	const anim = Elements.messageContainer.animate(animation.keyframes, animation.options);
	return anim.finished;
}
Graphics.resetToolTip = function(game, victory) {
	Elements.levelDisplay.textContent = `Level ${game.state.level}`;
	game.percentScorer.updateScore(game.memory.score);
	game.faceChanger.resetFace(victory);
}
Graphics.PercentScorer = function (score) {
	const scoreDisplay = Elements.scoreDisplay;
	const rounding = Config.scoreRounding;
	const delay = 80;
	let lastScore = score;
	let intervalId = null;

	const percentScore = function (score) {
		return parseFloat((score.num / score.denominator * 100).toFixed(rounding));
	};
	const displayScore = function (formattedScore) {
		scoreDisplay.textContent = formattedScore + "%";
	};

	this.interpolateScore = async function (newScore) {
		const displayStart = percentScore(lastScore);
		const displayEnd = percentScore(newScore);
		lastScore = newScore;
		if (displayStart === displayEnd) {
			scoreDisplay.classList.add('enlarge');
			setTimeout(() => {
				scoreDisplay.classList.remove('enlarge');
			}, 1500);
			return;
		}
		else if (displayEnd < displayStart) scoreDisplay.classList.add('debit');
		scoreDisplay.classList.add('enlarge');
		if (intervalId) clearInterval(intervalId);

		return new Promise(resolve => {
			let current = displayStart;
			const step = displayEnd > current ? 0.1 : -0.1;
			scoreDisplay.classList.add('enlarge');
			intervalId = setInterval(() => {
				current += step;
				displayScore(current.toFixed(rounding));
				const isComplete = step > 0
					? parseFloat(current.toFixed(rounding)) >= displayEnd
					: parseFloat(current.toFixed(rounding)) <= displayEnd;
				if (isComplete) {
					clearInterval(intervalId);
					intervalId = null;
					scoreDisplay.classList.remove('enlarge');
					scoreDisplay.classList.remove('debit');
					resolve();
				}
			}, delay);
		});
	};

	this.updateScore = function (score) {
		if (intervalId) clearInterval(intervalId);
		intervalId = null;
		scoreDisplay.classList.remove('enlarge');
		lastScore = score;
		displayScore(percentScore(score).toFixed(rounding));
	};
};
Graphics.colorSequencer = function(sequence) {
	const colorSequence = sequence;
	
	let index = Math.floor(Math.random() * colorSequence.length);
	this.nextColor = function() {
		let color = colorSequence[index];
		index = (index + 1) % colorSequence.length;
		return color;
	}
}
Graphics.typeText = async function (text, delayMs, ...elements) {
	elements.forEach(element => {
		element.innerHTML = '';
		for (const char of text) {
			const span = document.createElement('span');
			span.textContent = char;
			span.style.opacity = '0';
			span.style.transition = 'opacity 0.15s linear';
			element.appendChild(span);
		}
	});

	const spanSets = elements.map(el => [...el.querySelectorAll('span')]);

	for (let i = 0; i < text.length; i++) {
		const index = i;
		requestAnimationFrame(() => {
			spanSets.forEach(spans => spans[index].style.opacity = '1');
		});
		await new Promise(resolve => setTimeout(resolve, delayMs));
	}
}
Graphics.showPrompt = async function() {
	Elements.continuePrompt.classList.add('fade-in');
	//Elements.continuePrompt.classList.add('breathing');
}
Graphics.hidePrompt = async function () {
	//Elements.continuePrompt.classList.remove('breathing');
	Elements.continuePrompt.classList.remove('fade-in');
}