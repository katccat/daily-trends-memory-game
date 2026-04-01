import { Config } from './config.js';
import { Graphics } from './graphics.js';
import { getLines, isPhone } from './utils.js';
import { awaitTransition } from './utils.js';
import { fitFontSize } from './utils.js';

export class Cell {
	static State = {
		DEFAULT: 'default',
		REVEALED: 'revealed',
		SOLVED: 'solved',
		INACTIVE: 'inactive',
	};

	constructor(game) {
		this.game = game;
		this.state = Cell.State.INACTIVE;
		this.id;
		this.displayName;
		this.labelLines;
		this.usedTrend;
		this.views;
		this.bespoke = false;
		this.solvedLoop;
		this.transitioning;

		this.elements = {
			parent: document.createElement('div'),
			card: document.createElement('div'),
			image: document.createElement('div'),
			labelBg: document.createElement('div'),
			label: document.createElement('div'),
			labelBuffer: null,
			number: document.createElement('div'),
			front: document.createElement('div'),
			edgeTop: document.createElement('div'),
			edgeBottom: document.createElement('div'),
			edgeLeft: document.createElement('div'),
			edgeRight: document.createElement('div'),
		};
		this.build();
		this.elements.parent.addEventListener('click', () => this.unhide());
	}
	build() {
		this.elements.parent.className = 'cell-wrapper';

		this.elements.card.className = 'cell-card';
		this.elements.parent.appendChild(this.elements.card);

		this.elements.image.className = 'cell-back';
		this.elements.card.appendChild(this.elements.image);

		this.elements.labelBg.className = 'cell-label-bg';
		this.elements.image.appendChild(this.elements.labelBg);

		this.elements.label.className = 'cell-label';
		this.elements.labelBg.appendChild(this.elements.label);

		this.elements.number.className = 'cell-number';
		this.elements.labelBg.appendChild(this.elements.number);

		this.elements.front.className = 'cell-front';
		this.elements.card.appendChild(this.elements.front);

		this.elements.edgeTop.className = 'cell-edge cell-edge--top';
		this.elements.card.appendChild(this.elements.edgeTop);

		this.elements.edgeBottom.className = 'cell-edge cell-edge--bottom';
		this.elements.card.appendChild(this.elements.edgeBottom);

		this.elements.edgeLeft.className = 'cell-edge cell-edge--left';
		this.elements.card.appendChild(this.elements.edgeLeft);

		this.elements.edgeRight.className = 'cell-edge cell-edge--right';
		this.elements.card.appendChild(this.elements.edgeRight);
	}
	getElement() {
		return this.elements.parent;
	}
	stopLoop() {
		if (this.solvedLoop) this.solvedLoop.stop();
	}
	remove() {
		this.state = Cell.State.INACTIVE;
		this.elements.parent.remove();
		this.destroyLabelBuffer();
		this.stopLoop();
	}
	createLabelBuffer() {
		this.elements.labelBuffer = document.createElement('div');
		this.elements.labelBuffer.className = 'cell-label-buffer';
		this.elements.labelBuffer.style.width = this.elements.label.offsetWidth + 'px';
		//this.elements.labelBuffer.style.height = this.elements.label.offsetHeight + 'px';
		this.elements.labelBuffer.style.fontSize = getComputedStyle(this.elements.label).fontSize;
		document.body.appendChild(this.elements.labelBuffer);
		return this.elements.labelBuffer;
	}
	destroyLabelBuffer() {
		if (this.elements.labelBuffer) this.elements.labelBuffer.remove();
	}
	getName() {
		return this.id;
	}
	getDisplayName() {
		return this.displayName;
	}
	activate(word, trendObject) {
		this.id = word;
		this.displayName = trendObject.nickname || word.toLowerCase();
		const image = Array.isArray(trendObject.url) ? trendObject.url[0] : trendObject.url;
		this.elements.image.style.backgroundImage = `url(${image})`;
		if (trendObject.views) {
			this.views = trendObject.views;
			this.elements.number.textContent = trendObject.views;
		} else {
			this.views = 0;
			this.elements.number.textContent = '+1';
		}
		if (trendObject.special) this.bespoke = true;
	}
	reveal() {
		this.state = Cell.State.DEFAULT;
		this.elements.parent.classList.toggle('fade-in', true);
	}
	fade() {
		this.state = Cell.State.INACTIVE;
		this.elements.parent.classList.toggle('fade-in', false);
		
	}
	hide() {
		this.state = Cell.State.DEFAULT;
		this.elements.card.classList.remove('scale');
		this.elements.card.classList.remove('unhide');
	}
	async shake() {
		this.elements.card.classList.remove('scale');
		const animation = this.elements.parent.animate(Config.animation.shake.keyframes, Config.animation.shake.options);
		this.transitioning = Promise.all([
			animation.finished,
			new Promise(resolve => setTimeout(resolve, 500))
		]);
	}
	async unhide() {
		if (this.state !== Cell.State.DEFAULT || this.game.state.coolDown) return;
		this.game.state.cellsFading = false;
		this.state = Cell.State.REVEALED;
		this.game.state.revealedCells.push(this);
		this.elements.card.classList.add('scale');
		this.elements.card.classList.add('unhide');
		this.transitioning = Promise.all([
			awaitTransition(this.elements.card),
			new Promise(resolve => setTimeout(resolve, 500))
		]);
	}
	solve() {
		this.state = Cell.State.SOLVED;
		this.elements.card.classList.remove('scale');
	}
	setFrontGlyph(src) {
		this.elements.front.style.backgroundImage = `url(${src})`;
	}
	writeOnFront(text) {
		this.elements.front.textContent = text;
	}
	setFontColor(color) {
		this.elements.front.style.color = color;
	}
	setFrontColor(color) {
		this.elements.front.style.backgroundColor = color;
	}
	setBackColor(color) {
		this.elements.labelBg.style.backgroundColor = color;
	}
}
export class CellSolvedLoop {
	constructor(game, ...cells) {
		let typingResolver, endResolver;
		const typingDone = new Promise(r => typingResolver = r);
		const endPromise = new Promise(r => endResolver = r);
		const specialAnimation = cells[0].bespoke;
		let ended = false;
		let stopped = false;
		
		this.end = async function () {
			if (ended) return;
			ended = true;
			if (specialAnimation) bgElements.forEach(e => setBespoke(e));
			viewsElements.forEach(e => e.classList.add('fade-in'));
			labelElements.forEach(e => e.classList.add('fade-out'));
			endResolver();
			(async () => {
				while (!stopped) {
					await new Promise(r => setTimeout(r, 4000));
					if (stopped) break;
					viewsElements.forEach(e => e.classList.remove('fade-in'));
					labelElements.forEach(e => e.classList.remove('fade-out'));
					await new Promise(r => setTimeout(r, 4000));
					if (stopped) break;
					viewsElements.forEach(e => e.classList.add('fade-in'));
					labelElements.forEach(e => e.classList.add('fade-out'));
				}
			})();
		};
		this.stop = function() {
			stopped = true;
		}

		const labelElements = [];
		const viewsElements = [];
		const bgElements = [];
		
		cells.forEach(cell => {
			cell.typingDone = typingDone;
			cell.endPromise = endPromise;
			labelElements.push(cell.elements.label);
			viewsElements.push(cell.elements.number);
			bgElements.push(cell.elements.labelBg);
		});

		const text = cells[0].getDisplayName();
		const testElement = cells[0].createLabelBuffer();
		const fontSize = fitFontSize(testElement, text, labelElements[0].offsetHeight);
		//const lines = getLines(testElement, text);
		cells[0].destroyLabelBuffer();
		labelElements.forEach(e => e.style.fontSize = fontSize);
		bgElements.forEach(e => e.classList.add('fade-in'));
		const animation = Config.animation.slide.right;
		
		this.start = async () => {
			
			await Promise.all(bgElements.map(el => el.animate(animation.keyframes, animation.options).finished));
			bgElements.forEach(el => el.classList.add('blur'));
			await Graphics.typeText(text, ...labelElements);
			await new Promise(r => setTimeout(r, 1000));
			typingResolver();
		};
	}
}
const setBespoke = function(element) {
	const current = getComputedStyle(element).backgroundColor;
	const colors = [...Config.darkColors];
	let currentIndex = 0;
	for (let i = 0; i < colors.length; i ++) {
		if (colors[i] === current) currentIndex = i;
	}
	const orderedColors = colors.splice(currentIndex);
	orderedColors.push(...colors);
	element.animate([
		{ backgroundColor: orderedColors[0] },
		{ backgroundColor: orderedColors[1] },
		{ backgroundColor: orderedColors[2] },
		{ backgroundColor: orderedColors[3] },
		{ backgroundColor: orderedColors[0] },
	], {
		duration: 8000,
		iterations: Infinity,
		easing: 'linear',
	});
}