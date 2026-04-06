export function randomItem(list) {
	return list[Math.floor(Math.random() * list.length)];
}

export const ImageValidator = function () {
	let validatedImages = new Set();
	let invalidatedImages = new Set();

	const validateImage = async function(url) {
		if (!url) return false;
		return new Promise((resolve) => {
			const img = new Image();
			img.src = url;
			img.onload = () => {
				resolve(true);
				cleanup();
			};
			img.onerror = () => { resolve(false); cleanup(); };
			function cleanup() {
				img.onload = null;
				img.onerror = null;
			}
		});
	}

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