export function randomItem(list) {
	return list[Math.floor(Math.random() * list.length)];
}

export const ImageValidator = function () {
	let validatedImages = new Set();
	let invalidatedImages = new Set();

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
				if (img.naturalWidth > 0) settle(true);
			}, 50);

			img.onload = () => settle(true);
			img.onerror = () => settle(false);

			const timeoutId = setTimeout(() => settle(false), 5000);

			img.src = url;
		});
	};

	this.restore = function (saved) {
		if (saved) {
			validatedImages = new Set(saved.valid);
			invalidatedImages = new Set(saved.invalid);
		}
	};
	this.isValid = async function (url, ignoreStorage = false) {
		if (!ignoreStorage) {
			if (invalidatedImages.has(url)) return false;
			if (validatedImages.has(url)) return true;
		}
		const valid = await validateImage(url);
		if (valid) validatedImages.add(url);
		else invalidatedImages.add(url);
		this.saveData();
		return valid;
	};
	this.saveData = function() {
		const data = {
			valid: [...validatedImages],
			invalid: [...invalidatedImages],
		};
		localStorage.setItem('images', JSON.stringify(data));
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
export function truncate(str, maxLength) {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 3) + '...';
}