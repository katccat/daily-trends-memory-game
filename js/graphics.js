import { Config } from "./config.js";
import { percentScoreFloat, percentScoreString } from "./utils.js";

export const Elements = {
	grid: document.getElementById('grid'),
	gameContainer: document.getElementById('game-container'),
	tooltip: document.getElementById('tooltip'),
	title: document.getElementById('title'),
	levelDisplay: document.getElementById('level-counter'),
	scoreDisplay: document.getElementById('score-counter'),
	splashText: document.getElementById('splash-text'),
	splashContainer: document.getElementById('splash-container'),
	messageText: document.getElementById('in-game-message'),
	splashImage: document.getElementById('splash-image'),
	faceDisplay: document.getElementById('face'),
	faceOverlay: document.getElementById('glasses'),
	continuePrompt: document.getElementById('continue-prompt'),
	histogramContainer: document.getElementById('histogram-container'),
};
export class Graphics {};

Graphics.faceChanger = function(game) {
	this.game = game;
	const faceDisplay = Elements.faceDisplay;
	const faceOverlay = Elements.faceOverlay;

	const fx = {
		brokenGlasses: 'images/faces/break.gif',
	};
	const faceImages = {
		firstTrack: [
			{ src: 'images/faces/2.png' },
			{ src: 'images/faces/3a.png' },
			{ src: 'images/faces/scarf.png' },
		],
		countDown: {
			length: 3,
			threshold: 1,
			strike1: [
				{ src: 'images/faces/4a.gif' },
				{ src: 'images/faces/5a.gif' },
				{ src: 'images/faces/7a.png' },
			],
			strike2: [
				{ src: 'images/faces/4b.gif' },
				{ src: 'images/faces/5b.gif' },
				{ src: 'images/faces/7b.png' },
			],
		},
		default: { src: 'images/faces/1.png', threshold: 0 },
		start: [
			{ src: 'images/faces/trophy_resized.gif', fx: fx.brokenGlasses, threshold: 100 },
			{ src: 'images/faces/special4.gif', fx: fx.brokenGlasses, threshold: 90 },
			{ src: 'images/faces/special3.gif', fx: fx.brokenGlasses, threshold: 75 },
			{ src: 'images/faces/special2.png', fx: fx.brokenGlasses, threshold: 50 },
			{ src: 'images/faces/special1.png', threshold: 25 },
		],
	};
	faceImages.start.push(faceImages.default);
	
	let dead = false;
	let countedMistakes = 0;
	let currentFace;
	
	this.changeFace = function () {
		if (dead) return;

		const remaining = game.state.remainingMistakes;
		const avoidable = game.state.avoidableMistakes;

		if (currentFace?.fx) faceOverlay.src = cacheBust(currentFace.fx);

		if (remaining <= faceImages.countDown.threshold) {
			const strike2 = (avoidable > 1);
			const sequence = strike2 ? faceImages.countDown.strike2 : faceImages.countDown.strike1;
			const index = Math.max(Math.min(faceImages.countDown.threshold - remaining, sequence.length - 1), 0);
			currentFace = sequence[index];
			Graphics.flashImage(currentFace.src);
		}
		else if (avoidable > 0) {
			countedMistakes++;
			const index = Math.max(Math.min(countedMistakes - 1, faceImages.firstTrack.length - 1), 0);
			currentFace = faceImages.firstTrack[index];
		}

		faceDisplay.src = currentFace.src;
		if (remaining < 0) dead = true;
	}
	this.resetFace = function (victory = false, animate = false) {
		const score = percentScoreFloat(game.state.score);
		currentFace = null;
		if (victory) {
			for (const tier of faceImages.start) {
				if (score >= tier.threshold) {
					currentFace = tier;
					break;
				}
			}
		}
		if (!currentFace) currentFace = faceImages.default;
		faceDisplay.src = currentFace.src;
		countedMistakes = 0;
		dead = false;
		// if (animate && currentFace !== faceImages.default) Graphics.flashImage(currentFace.src);
	}
	const cacheBust = function (src) {
		return src + '?t=' + Date.now();
	}
}
Graphics.splashText = async function (text) {
	const splashContainer = Elements.splashContainer;
	splashContainer.classList.add('fade-in');
	await this.typeText(text, 90, Elements.splashText);
	splashContainer.classList.remove('fade-in');
};
Graphics.flashMessage = async function (text) {
	Elements.messageText.textContent = text;
	const animation = Config.animation.splash2;
	const anim = Elements.messageText.animate(animation.keyframes, animation.options);
	return anim.finished;
}
Graphics.flashImage = async function (src) {
	const image = Elements.splashImage;
	image.src = src;
	const animation = Config.animation.splash2;
	const anim = image.animate(animation.keyframes, animation.options);
	return anim.finished;
}
Graphics.resetToolTip = function(game, victory) {
	Elements.levelDisplay.textContent = `Level ${game.state.level}`;
	game.percentScorer.updateScore(game.state.score);
	game.faceChanger.resetFace(victory);
}
Graphics.PercentScorer = function () {
	const scoreDisplay = Elements.scoreDisplay;
	const rounding = Config.scoreRounding;
	const delay = 80;
	let intervalId = null;

	const displayScore = function (formattedScore) {
		scoreDisplay.classList.add('visible');
		scoreDisplay.textContent = formattedScore + "%";
	};

	this.interpolateScore = async function (oldScore, newScore) {
		const displayStart = percentScoreFloat(oldScore);
		const displayEnd = percentScoreFloat(newScore);
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
				displayScore(Math.abs(current).toFixed(rounding));
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
		displayScore(percentScoreString(score));
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