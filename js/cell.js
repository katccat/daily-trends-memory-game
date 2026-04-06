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
		this.bespoke = false;
		this.solvedLoop;
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
		const image1 = this.elements.image1 = el('div', 'cell-image');
		const image2 = this.elements.image2 = el('div', 'cell-image');
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

		imgContainer.append(image1, image2);
		cellBack.append(imgContainer);
		cellBack.append(labelBg);
		card.append(cellBack, front, edges);
		parent.appendChild(card);
		parent.addEventListener('click', () => this.unhide());
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
	async activate(word, trendObject) {
		this.id = word;
		this.displayName = trendObject.nickname || word.toLowerCase();
		const images = Array.isArray(trendObject.url) ? trendObject.url : [trendObject.url];
		let firstImageFilled = false;
		for (const img of images) {
			const imageValid = (await game.imageValidator.isValid(img));
			if (!imageValid) continue;
			if (!firstImageFilled) {
				this.elements.image1.style.backgroundImage = `url(${img})`;
				firstImageFilled = true;
			}
			else {
				this.image2 = true;
				this.elements.image2.style.backgroundImage = `url(${img})`;
			}
		}
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
	slideImage() {
		if (!this.image2) return;
		this.elements.imageContainer.classList.add('show-second');
	}

	reverseImages() {
		if (!this.image2) return;
		const container = this.elements.imageContainer;
		const img1 = this.elements.image1.style.backgroundImage;
		const img2 = this.elements.image2.style.backgroundImage;

		// Copy image2's source into image1
		this.elements.image1.style.backgroundImage = img2;

		// Disable transition, snap back to start position
		container.style.transition = 'none';
		container.classList.remove('show-second');
		this.elements.image2.style.backgroundImage = img1;

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
	// In Cell class:
	showBackground() {
		const animation = Config.animation.slide.right;
		const anim = this.elements.labelBg.animate(animation.keyframes, animation.options);
		this.elements.labelBg.classList.add('fade-in');
		return anim.finished;
	}
	showViews() {
		this.elements.number.classList.add('fade-in');
		this.elements.label.classList.add('fade-out');
	}
	hideViews() {
		this.elements.number.classList.remove('fade-in');
		this.elements.label.classList.remove('fade-out');
	}
}