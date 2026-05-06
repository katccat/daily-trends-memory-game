import { Config } from './config.js';
export function randomItem(list) {
	return list[Math.floor(Math.random() * list.length)];
}

export function percentScoreFloat(score) {
	const num = score?.num;
	const denominator = score?.denominator ? score.denominator : 1;
	return parseFloat((num / denominator * 100).toFixed(Config.scoreRounding));
};
export function percentScoreString(score) {
	const num = score?.num;
	const denominator = score?.denominator ? score.denominator : 1;
	return (num / denominator * 100).toFixed(Config.scoreRounding);
};

export const ImageValidator = function () {
	// Map of url -> boolean (true = valid, false = invalid), insertion-ordered for eviction
	let imageCache = new Map();
	const MAX_ENTRIES = 500;

	const saved = JSON.parse(localStorage.getItem('images'));
	if (saved) {
		for (const [url, valid] of Object.entries(saved)) {
			imageCache.set(url, valid);
		}
	}

	const validateImage = async function (url) {
		if (!url) return false;

		// Try a HEAD request first to catch explicit 404s
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 1000);
			const response = await fetch(url, { method: "HEAD", signal: controller.signal });
			clearTimeout(timeoutId);
			if (response.status === 404) return false;
		} catch {
			// CORS or network error — fall through to img fallback
		}

		return new Promise((resolve) => {
			const img = new Image();
			let settled = false;
			let pollId;

			function settle(result) {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				clearInterval(pollId);
				img.onload = null;
				img.onerror = null;
				img.src = "";
				resolve(result);
			}

			pollId = setInterval(() => {
				if (img.naturalWidth > 0) {
					// console.log(`${url}: ${img.naturalWidth}`);
					settle(true);
					// console.log(`${url} settled due to natural width`);
				}
			}, 50);

			img.onload = () => {
				settle(true);
				// console.log(`${url} settled due to onload`);
			}
			img.onerror = () => settle(false);

			const timeoutId = setTimeout(() => settle(false), 5000);

			img.src = url;
		});
	};
	this.isValid = async function (url, ignoreStorage = false) {
		if (!ignoreStorage && imageCache.has(url)) {
			return imageCache.get(url);
		}
		const valid = await validateImage(url);
		imageCache.set(url, valid);
		while (imageCache.size > MAX_ENTRIES) {
			imageCache.delete(imageCache.keys().next().value);
		}
		this.saveData();
		return valid;
	};
	this.saveData = function() {
		localStorage.setItem('images', JSON.stringify(Object.fromEntries(imageCache)));
	}
};

export function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		// Generate random index between 0 and i
		const j = Math.floor(Math.random() * (i + 1));
		// Swap elements array[i] and array[j]
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export function waitForFlag(flagRef, state) {
	return new Promise(resolve => {
		function checkFlag() {
			if (flagRef() === state) {
				resolve();
			} else {
				setTimeout(checkFlag, 50);
			}
		}
		checkFlag();
	});
}

export function isPhone() {
	const phoneQuery = window.matchMedia('(max-width: 600px)');
	return phoneQuery.matches;
}
export function fitFontSize(element, text, maxHeight) {
	let size = parseFloat(getComputedStyle(element).fontSize);
	element.textContent = text;
	while (element.offsetHeight > maxHeight) {
		size--;
		element.style.fontSize = size + 'px';
	}
	return size + 'px';
};