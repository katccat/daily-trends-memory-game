import { Config } from './config.js';

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
		this.special = false;
		this.transitioning;
		this.elements = {};

		this.build();
	}
	build() {
		const el = (tag, className) => {
			const node = document.createElement(tag);
			if (className) node.className = className;
			return node;
		};

		const front = this.elements.front = el('div', 'cell-front');
		const number = this.elements.number = el('div', 'cell-number');
		const label = this.elements.label = el('div', 'cell-label');
		const labelBg = this.elements.labelBg = el('div', 'cell-label-bg');
		const imageA = this.elements.imageA = el('div', 'cell-image');
		const imageB = this.elements.imageB = el('div', 'cell-image');
		const imgContainer = this.elements.imageContainer = el('div', 'cell-image-container');
		const cellBack = el('div', 'cell-back');
		const card = this.elements.card = el('div', 'cell-card');
		const parent = this.elements.parent = el('div', 'cell-wrapper');

		labelBg.append(label, number);

		this.elements.edge = {};
		const edges = document.createDocumentFragment();
		['top', 'bottom', 'left', 'right'].forEach(side => {
			const element = el('div', `cell-edge cell-edge--${side}`);
			edges.appendChild(element);
			this.elements.edge[side] = element;
		});

		imgContainer.append(imageA, imageB);
		cellBack.append(imgContainer);
		cellBack.append(labelBg);
		card.append(cellBack, front, edges);
		parent.appendChild(card);
		parent.addEventListener('click', () => this.unhide());
	}
	getElement() {
		return this.elements.parent;
	}
	remove() {
		this.state = Cell.State.INACTIVE;
		this.elements.parent.remove();
		this.destroyLabelBuffer();
	}
	createLabelBuffer() {
		const buffer = this.elements.labelBuffer = document.createElement('div');
		buffer.className = 'cell-label-buffer';
		buffer.style.width = this.elements.label.offsetWidth + 'px';
		const style = getComputedStyle(this.elements.label);
		buffer.style.fontSize = style.fontSize;
		buffer.style.padding = style.padding;
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
	get imageSlideAvailable() {
		if (!this?.images) return false;
		return (this.images.length > 1);
	}
	async activate(word, trendObject) {
		this.id = word;
		this.displayName = trendObject.nickname || word.toLowerCase();
		const images = Array.isArray(trendObject.url) ? trendObject.url : [trendObject.url];

		this.images = [...images]; // all valid image URLs
		// Load first two slots upfront
		this.nextImageIndex = this.images.length > 1 ? 1 : null;

		if (this.images[0]) this.elements.imageA.style.backgroundImage = `url("${this.images[0]}")`;
		if (this.nextImageIndex) this.elements.imageB.style.backgroundImage = `url("${this.images[this.nextImageIndex]}")`;

		if (trendObject.views) {
			this.views = trendObject.views;
			this.elements.number.textContent = trendObject.views;
		} else {
			this.views = 0;
			this.elements.number.textContent = '+1';
		}
		if (trendObject.special) this.special = true;
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
		const shake = Config.animation.shake;
		const animation = this.elements.parent.animate(shake.keyframes, shake.options);
		const duration = shake.options.duration;
		this.transitioning = Promise.all([
			animation.finished,
			new Promise(resolve => setTimeout(resolve, duration))
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
	async slideImages() {
		if (this.images.length < 2) return;
		const container = this.elements.imageContainer;

		container.classList.add('show-second');
		await new Promise(resolve => setTimeout(resolve, 1020));

		this.nextImageIndex = (this.nextImageIndex + 1) % this.images.length;
		const imgA = this.elements.imageB.style.backgroundImage;
		const imgB = `url("${this.images[this.nextImageIndex]}"`;
		
		// Copy imageB's source into imageA
		this.elements.imageA.style.backgroundImage = imgA;

		// Disable transition, snap back to start position
		container.style.transition = 'none';
		container.classList.remove('show-second');
		this.elements.imageB.style.backgroundImage = imgB;

		// Force reflow so the browser registers the change before re-enabling transition
		container.offsetHeight;

		container.style.transition = '';
	}
	setBespoke() {
		const element = this.elements.labelBg;
		const current = getComputedStyle(element).backgroundColor;
		const colors = [...Config.darkColors];
		let currentIndex = 0;
		for (let i = 0; i < colors.length; i++) {
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
	showBackground() {
		const animation = Config.animation.slide.right;
		const anim = this.elements.labelBg.animate(animation.keyframes, animation.options);
		this.elements.labelBg.classList.add('fade-in');
		return anim.finished;
	}
}