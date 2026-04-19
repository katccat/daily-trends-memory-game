import { Elements } from './graphics.js';
import { randomItem, shuffle } from './utils.js';
export const Config = {
	BACKEND: 'https://backend.clayrobot.net/memorygame/',
	ENDPOINT: {
		TODAY: 'today',
		FALLBACK: 'fallback',
		INDEX: 'index',
	},
	OFFLINE_FALLBACK: '/words/offline.json',
	delay: {
		fade: 700,
		showContinuePrompt: 0,
		changeCellLabel: 5000,
		changeCellImage: 1500,
		resolveTyping: 1000,
		loseTransition: 1000,
		showHistogram: 1800,
	},
	removeAmountWhenLose: 0,
	removeAmountWhenGameOver: 12,
	trendData: {},
	funColorChance: 0,
	funGlyphChance: 0.1,
	maxLives: 3,
	milestones: [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
	scoreRounding: 1,
	deferViewedTrends: false,
	colors: [
		'rgba(237, 106, 94, 1)',  // red
		'rgba(134, 178, 249, 1)', // blue
		'rgba(255, 214, 90, 1)',  // yellow
		'rgba(118, 213, 144, 1)', // green
	],
	darkColors: [
		'rgba(66, 133, 244, 0.65)',
		'rgba(234, 67, 53, 0.6)',
		'rgba(251, 188, 5, 0.66)',
		'rgba(52, 168, 83, 0.67)',
	],
	messages: {
		intro: {
			normal: ["I'm not a robot."],
			challenge: ["Safe search: off"],
		},
		victory: ["I'm not a robot.", "Great!", "Amazing!", "Fantastic!"],
		perfect: ['Perfect!', "I'm feeling lucky", "Did you mean: win?", "404: Mistake not found", "Zero errors. Zero."],
		nearmiss: ["Phew!", "Close!"],
		failure: ["Aw, snap!", "That's an error.", "Please try again.", "Only human!"],
		gameover: ["Game over!", "ERR_GAME_OVER"],
		end: ["OMG 100%!", "You ARE a robot!", "All systems go!"],
	},
	glyphs: [
		"images/download_arrow.png",
		"images/mandarin.png",
		"images/puzzle.png",
		"images/share.png",
		"images/office.png",
		"images/cog.png",
		"images/search.png",
		"images/contact.png",
	],
	introMessage: [
		{
			words: [
				["tap", "to", "find", "matches"], 
				["tap", "squares", "to", "match"], 
			],
			shuffle: false,
		},
		{
			words: [["hello", "hola", "你好", "привет", "bonjour", "olá", "ciao", "hallo", "안녕", "مرحبًا"]],
			shuffle: true,
		},
		{
			words: [["news", "sports", "earth", "now", "search", "results", "trends", "top", "media", "people"]],
			shuffle: true,
		},
		{
			words: [
				["clay", "robot", "dot", "net"],
			],
			shuffle: false,
		},
	],
	difficulty: {
		easy: 0,
		medium: 5,
		hard: 10,
	},
	animation: {
		shake: {
			keyframes: [
				{ transform: 'translateX(0)', offset: 0 },
				{ transform: 'translateX(-10px)', offset: 0.08 },
				{ transform: 'translateX(10px)', offset: 0.25 },
				{ transform: 'translateX(-10px)', offset: 0.41 },
				{ transform: 'translateX(10px)', offset: 0.58 },
				{ transform: 'translateX(-5px)', offset: 0.75 },
				{ transform: 'translateX(5px)', offset: 0.92 },
				{ transform: 'translateX(0)', offset: 1 },
			],
			options: {
				duration: 500,
				iterations: 1,
				easing: 'linear',
			}
		},
		slide: {
			right: {
				keyframes: [
					{ transform: 'translateX(100%)', offset: 0 },
					{ transform: 'translateX(0)', offset: 1 },
				],
				options: { duration: 820, easing: 'ease-out', fill: 'forwards' },
			},
		},
		splash: {
			keyframes: [
				{ transform: 'translate(-50%, -50%) scale(0.7)', opacity: 0, offset: 0 },
				{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.2 },
				{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.75 },
				{ transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0, offset: 1 },
			],
			options: {
				duration: 1800,
				iterations: 1,
				easing: 'ease-in-out',
			}
		},
		splash2: {
			keyframes: [
				{ transform: 'translate(-50%, -50%) scale(0.1)', opacity: 1, offset: 0 },
				{ transform: 'translate(-50%, -50%) scale(1.4)', opacity: 0, offset: 1 },
			],
			options: {
				duration: 1000,
				iterations: 1,
				// easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
				easing: 'ease-out',
			}
		}
	}
};

const IS_DEV = 
	window.location.hostname !== 'clayrobot.net' &&
	window.location.hostname !== 'www.clayrobot.net' &&
	window.location.hostname !== 'clayrobot.netlify.app';

if (IS_DEV) Elements.title.textContent = "I'm not a robot (dev)";

Config.getIntroMessage = function () {
	const introMessage = randomItem(this.introMessage);
	const words = randomItem(introMessage.words);
	if (!introMessage.shuffle) return words;
	else {
		return shuffle(words);
	}
}