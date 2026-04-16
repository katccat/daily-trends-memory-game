import { Config } from "./config.js";
import { Graphics } from "./graphics.js";
import { imageValidator } from "./main.js";
export const TrendSelector = function (trendData, game) {
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
	function markUnusable(key) {
		if (!moveKey(key, keys.unused, keys.unusable))
			if (!moveKey(key, keys.deferred, keys.unusable))
				moveKey(key, keys.used, keys.unusable);
	};
	this.markViewed = function (key) {
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
		if (game.saveProgress) this.saveData();
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
		if (game.saveProgress) this.saveData();
	}
	this.getRandomTrendKeys = async function (amount) {
		const randomTrendKeys = [];

		const unusedKeys = [...keys.unused];
		const deferredKeys = [...keys.deferred];
		const usedKeys = [...keys.used];
		let loaded = 0;

		const pickKeys = (count) => {
			const picked = [];
			for (let i = 0; i < count; i++) {
				let usedTrend = false;
				let pool;
				if (unusedKeys.length > 0) pool = unusedKeys;
				else if (deferredKeys.length > 0) pool = deferredKeys;
				else if (usedKeys.length > 0) { pool = usedKeys; usedTrend = true; }
				else break;

				const index = Math.floor(Math.random() * pool.length);
				const key = pool.splice(index, 1)[0];
				picked.push({ key, usedTrend });
			}
			return picked;
		};

		const validateKey = async ({ key, usedTrend }) => {
			const trendObject = trends[key];
			let urlList = Array.isArray(trendObject.url) ? trendObject.url : [trendObject.url];

			if (urlList.length === 0 || urlList[0] === undefined) {
				markUnusable(key);
				return null;
			}

			const validationResults = await Promise.all(
				urlList.map(async (img) => ({
					url: img,
					isValid: await imageValidator.isValid(img)
				}))
			);

			const validUrls = validationResults.filter(r => r.isValid).map(r => r.url);
			trendObject.url = validUrls;

			const isViable = game.challengeMode ? validUrls.length >= 2 : validUrls.length > 0;
			if (!isViable) {
				markUnusable(key);
				return null;
			}
			// Graphics.splashText(++loaded + "");
			return { key, usedTrend };
		};

		let needed = amount;
		while (randomTrendKeys.length < amount) {
			const candidates = pickKeys(needed);
			if (candidates.length === 0) {
				console.error("No word with picture found.");
				break;
			}

			const results = await Promise.all(candidates.map(validateKey));
			const valid = results.filter(Boolean);
			randomTrendKeys.push(...valid);
			needed = amount - randomTrendKeys.length;
		}

		return randomTrendKeys;
	};
	this.getScore = function () {
		return { num: keys.used.size, denominator: Object.keys(trends).length - keys.unusable.size };
	};
	this.saveData = function () {
		const data = {
			unused: [...keys.unused],
			used: [...keys.used],
			deferred: [...keys.deferred],
			unusable: [...keys.unusable],
		};
		game.saveData('trendKeys', data);
	};
};