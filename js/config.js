import { Elements } from './graphics.js';
export const Config = {
	fadeDelay: 700,
	trendData: {},
	funColorChance: 0,
	funGlyphChance: 0.1,
	maxLives: 3,
	milestones: [10, 25, 50, 75, 100, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
	scoreRounding: 1,
	deferViewedTrends: false,
	colors: [
		'#ed6a5e', // red
		'#86b2f9', // blue
		'#ffd65a', // yellow
		'#76d590', // green
	],
	darkColors: [
		'rgba(66, 133, 244, 0.7)',
		'rgba(234, 67, 53, 0.7)',
		'rgba(251, 188, 5, 0.7)',
		'rgba(52, 168, 83, 0.7)',
	],
	messages: {
		intro: ["I'm feeling lucky"],
		victory: ["I'm not a robot", "Great!", "Amazing!", "Fantastic!"],
		perfect: ['Perfect!', "I'm feeling lucky"],
		nearmiss: ["Phew!", "Close!"],
		failure: ["Aw, snap!", "That's an error.", "Please try again", "Only human!"],
		gameover: ["Game over!"],
		end: ["OMG 100%!", "You ARE a robot!"],
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
		"I'm",
		"not",
		"a",
		"robot",
	],
	difficulty: {
		easy: 0,
		medium: 6,
		hard: 12,
	},
	boardAnimationID: {
		win: 'win',
		lose: 'lose',
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
				options: { duration: 700, easing: 'ease-out', fill: 'forwards' },
			},
			/*left: {
				keyframes: [
					{ transform: 'translateX(-100%)', offset: 0 },
					{ transform: 'translateX(0)', offset: 1 },
				],
				options: { duration: 700, easing: 'ease-out', fill: 'forwards' },
			},*/
		},
	}
};

const IS_DEV = 
	window.location.hostname !== 'clayrobot.net' &&
	window.location.hostname !== 'www.clayrobot.net' &&
	window.location.hostname !== 'clayrobot.netlify.app' &&
	window.location.hostname !== 'localhost';

if (IS_DEV) {
	Config.BACKEND = 'https://backend.clayrobot.net/dev/memorygame';
	Config.FALLBACK = 'https://backend.clayrobot.net/dev/memorygame/fallback';
	Elements.title.textContent = "I'm not a robot (dev)";
}
else {
	Config.BACKEND = 'https://backend.clayrobot.net/memorygame';
	Config.FALLBACK = 'https://backend.clayrobot.net/memorygame/fallback';
}

Config.getCategories = async function() {
	try {
		this.trendData = await fetch(Config.BACKEND).then(res => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		}).then(trendData => {
			if (trendData.count < 1) throw new Error(`No trends found in ${Config.BACKEND}`);
			return trendData;
		});
	} catch (err) {
		try {
			this.trendData = await fetch(Config.FALLBACK).then(res => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json();
			}).then(trendData => {
				if (trendData.count < 1) throw new Error(`No trends found in ${Config.FALLBACK}`);
				return trendData;
			});
		} catch (err) {
			console.warn('Failed to fetch remote index, falling back to local:', err.message);
			this.trendData = await fetch('/words/fallback.json').then(res => res.json());
		}
	}
};