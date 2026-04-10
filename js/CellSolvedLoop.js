import { Config } from './config.js';
import { fitFontSize } from './utils.js';
import { Graphics } from './graphics.js';
import { Elements } from './graphics.js';

export function CellLoopScheduler() {
	const cellLoops = [];
	let loopIndex = 0;
	let playing = false;
	this.newLoop = async function(...cells) {
		const loop = new CellSolvedLoop(...cells);
		loop.start();
		cellLoops.splice(loopIndex, 0, loop);
		if (!playing && cellLoops.some(loop => loop.imageSlideAvailable)) this.start();
	}
	this.start = async function () {
		playing = true;
		(async () => {
			const delay = Config.delay.changeCellImage;
			let success = true;
			while (playing) {
				if (success) {
					const randomDelay = Math.random() * 2000;
					await new Promise(r => setTimeout(r, delay + randomDelay))
				};
				if (!playing || cellLoops.length === 0) {
					this.stop();
					break;
				}
				loopIndex = loopIndex % cellLoops.length;
				success = await this.slideImages(loopIndex);
				loopIndex++;
			}
		})();
	}
	this.stop = function () {
		playing = false
		cellLoops.length = 0;
	};
	this.slideImages = async function (index) {
		return await cellLoops[index].slideImages();
	}
	this.showViews = () => Elements.grid.classList.add('show-views');
	this.hideViews = () => Elements.grid.classList.remove('show-views');
	
	this.endScreen = async function () {
		await Promise.all(cellLoops.map(loop => loop.typingDone));
		this.showViews();
		(async () => {
			const delay = Config.delay.changeCellLabel;
			while (playing && cellLoops.length > 0) {
				await new Promise(r => setTimeout(r, delay));
				if (!playing || cellLoops.length === 0) break;
				this.hideViews();
				await new Promise(r => setTimeout(r, delay));
				if (!playing || cellLoops.length === 0) break;
				this.showViews();
			}
		})();
	}
}	

export class CellSolvedLoop {
	constructor(...cells) {
		let typingResolver;
		this.typingDone = new Promise(r => typingResolver = r);
		this.imageSlideAvailable = cells[0].imageSlideAvailable;

		const labelElements = [];
		cells.forEach(cell => labelElements.push(cell.elements.label));

		const text = cells[0].getDisplayName();
		const testElement = cells[0].createLabelBuffer();
		const fontSize = fitFontSize(testElement, text, labelElements[0].offsetHeight);
		cells[0].destroyLabelBuffer();
		labelElements.forEach(e => e.style.fontSize = fontSize);

		this.slideImages = async function () {
			if (!this.imageSlideAvailable) return false;
			await this.typingDone;
			cells.forEach(cell => cell.slideImages());
			return true;
		}
		this.start = async function () {
			await Promise.all(cells.map(cell => cell.showBackground()));
			await Graphics.typeText(text, 90, ...labelElements);
			await new Promise(r => setTimeout(r, Config.delay.resolveTyping));
			typingResolver();
		};
	}
}