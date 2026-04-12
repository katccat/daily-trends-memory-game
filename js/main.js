import { Config } from './config.js';
import { Game } from './Game.js';
import { ImageValidator } from './utils.js';

export const imageValidator = new ImageValidator();

async function init() {

	const index = await getIndex();
	const date = index['2026/04/05'];
	
	let trendData;
	try {
		trendData = await getTrendSet(Config.ENDPOINT.TODAY);
	} catch {
		try {
			trendData = await getTrendSet(Config.ENDPOINT.FALLBACK);
		}
		catch {
			trendData = getTrendSet(Config.OFFLINE_FALLBACK);
		}
	}
	const game = new Game(trendData);

	globalThis.game = game;
	game.newGame();
}
init();

async function getTrendSet (endpoint) {
	if (!endpoint) return null;
	const trendData = await fetch(Config.BACKEND + endpoint).then(res => {
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}).then(trendData => {
		if (trendData.count < 1) throw new Error(`No trends found in ${Config.BACKEND}`);
		return trendData;
	});
	return trendData;
}
async function getIndex () {
	const index = await fetch(Config.BACKEND + Config.ENDPOINT.INDEX).then(res => {
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}).then(index => {
		if (Object.keys(index).length < 1) throw new Error(`No trends found in index`);
		return index;
	});
	return index;
}