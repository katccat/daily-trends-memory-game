export function randomItem(list) {
	return list[Math.floor(Math.random() * list.length)];
}

export const ImageValidator = function () {
	let validatedImages = new Set();
	let invalidatedImages = new Set();

	const validateImage = async function (url) {
		if (!url) return false;

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

			// Poll for naturalWidth — becomes non-zero as soon as the first
			// few bytes are decoded, well before onload fires
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
	this.isValid = async function (url) {
		if (invalidatedImages.has(url)) return false;
		if (validatedImages.has(url)) return true;
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