import { Config } from './config.js';
import { fitFontSize } from './utils.js';
import { Graphics } from './graphics.js';

export class CellSolvedLoop {
	constructor(...cells) {
		let ended = false;
		let stopped = false;
		let typingResolver, endResolver;
		const typingDone = new Promise(r => typingResolver = r);
		const endPromise = new Promise(r => endResolver = r);
		const specialAnimation = cells[0].bespoke;

		const labelElements = [];
		cells.forEach(cell => {
			cell.typingDone = typingDone;
			cell.endPromise = endPromise;
			labelElements.push(cell.elements.label);
		});

		const text = cells[0].getDisplayName();
		const testElement = cells[0].createLabelBuffer();
		const fontSize = fitFontSize(testElement, text, labelElements[0].offsetHeight);
		cells[0].destroyLabelBuffer();
		labelElements.forEach(e => e.style.fontSize = fontSize);

		this.stop = function () {
			stopped = true;
		};
		this.start = async function () {
			await Promise.all(cells.map(cell => cell.showBackground()));
			await Graphics.typeText(text, ...labelElements);
			await new Promise(r => setTimeout(r, Config.delay.resolveTyping));
			typingResolver();
			(async () => {
				if (!cells[0].image2) return;
				const delay = Config.delay.changeCellImage;
				while (!stopped) {
					await new Promise(r => setTimeout(r, delay));
					if (stopped) break;
					cells.forEach(cell => cell.slideImage());
					await new Promise(r => setTimeout(r, delay));
					if (stopped) break;
					cells.forEach(cell => cell.reverseImages());
				}
			})();
		};
		this.end = async function () {
			if (ended) return;
			ended = true;
			if (specialAnimation) cells.forEach(cell => cell.setBespoke());
			cells.forEach(cell => cell.showViews());
			endResolver();
			(async () => {
				const delay = Config.delay.changeCellLabel;
				while (!stopped) {
					await new Promise(r => setTimeout(r, delay));
					if (stopped) break;
					cells.forEach(cell => cell.hideViews());
					await new Promise(r => setTimeout(r, delay));
					if (stopped) break;
					cells.forEach(cell => cell.showViews());
				}
			})();
		};
	}
}