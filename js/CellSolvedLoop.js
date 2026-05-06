import { Config } from './config.js';
import { fitFontSize } from './utils.js';
import { Graphics } from './Graphics.js';
import { Elements } from './Graphics.js';

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
					await new Promise(r => setTimeout(r, delay + randomDelay));
				};
				if (!playing) break;
				loopIndex = loopIndex % cellLoops.length;
				success = await this.slideImages(loopIndex);
				loopIndex++;
			}
		})();
	}
	this.stop = function () {
		playing = false
		cellLoops.length = 0;
		this.hideViews();
	};
	this.slideImages = async function (index) {
		return await cellLoops[index].slideImages();
	}
	this.showViews = () => Elements.grid.classList.add('show-views');
	this.hideViews = () => Elements.grid.classList.remove('show-views');
	
	this.endScreen = async function () {
		playing = true;
		await Promise.all(cellLoops.map(loop => loop.typingDone));
		cellLoops.forEach(loop => loop.setBespoke());
		this.showViews();
		(async () => {
			const delay = Config.delay.changeCellLabel;
			while (playing) {
				await new Promise(r => setTimeout(r, delay));
				if (!playing) break;
				this.hideViews();
				await new Promise(r => setTimeout(r, delay));
				if (!playing) break;
				this.showViews();
			}
		})();
	}
}	

export class CellSolvedLoop {
	constructor(...cells) {
		let backgroundResolver, typingResolver;
		this.backgroundVisible = new Promise(r => backgroundResolver = r);
		this.typingDone = new Promise(r => typingResolver = r);
		this.imageSlideAvailable = cells[0].imageSlideAvailable;

		const labelElements = [];
		cells.forEach(cell => labelElements.push(cell.elements.label));

		const text = cells[0].getDisplayName();
		const testElement = cells[0].createLabelBuffer();
		const fontSize = fitFontSize(testElement, text, labelElements[0].offsetHeight);
		cells[0].destroyLabelBuffer();
		labelElements.forEach(e => e.style.fontSize = fontSize);

		this.setBespoke = function () {
			cells.forEach(cell => {
				if (cell.special) cell.setBespoke();
			})
		}
		this.slideImages = async function () {
			if (!this.imageSlideAvailable) return false;
			await this.backgroundVisible;
			await this.typingDone;
			cells.forEach(cell => cell.slideImages());
			return true;
		}
		this.start = async function () {
			Promise.all(cells.map(cell => cell.showBackground())).then(() => backgroundResolver());
			await new Promise(r => setTimeout(r, 500));
			await Graphics.typeText(text, 90, false, ...labelElements);
			await new Promise(r => setTimeout(r, Config.delay.resolveTyping));
			typingResolver();
		};
	}
}