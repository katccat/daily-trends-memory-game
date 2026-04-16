import { shuffle } from './utils.js';
import { Elements } from './graphics.js';
import { isPhone } from './utils.js';

const PIXEL_SIZE = isPhone() ? 32 : 36; // target square side length in CSS pixels

export class PixelTransition {
    constructor() {
        this.el = document.getElementById('pixels');
        this._cols = 0;
        this._rows = 0;
        this._pixels = [];
        this._transitionPromise = Promise.resolve();

        this._resizeHandler = () => {
            this._transitionPromise.then(() => {
                this._layout();
                this._build(false);
            });
        };
        window.addEventListener('resize', this._resizeHandler);
        this._layout();
        this._build(false);
    }

    _layout() {
        const rect = Elements.gameContainer.getBoundingClientRect();

        const cols = Math.max(1, Math.round(rect.width / PIXEL_SIZE));
        const rows = Math.max(1, Math.round(rect.height / PIXEL_SIZE));
        this._cols = cols;
        this._rows = rows;

        this.el.style.width = rect.width + 'px';
        this.el.style.height = rect.height + 'px';
        this.el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    }

    _build(allVisible = false) {
        const pixels = [];
        const count = this._cols * this._rows;
        this.el.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = allVisible ? 'pixel visible' : 'pixel';
            fragment.appendChild(div);
            pixels.push(div);
        }
        this.el.appendChild(fragment);
        this._pixels = pixels;
        return count;
    }

    async fillIn() {
        const pixels = this._pixels;
        for (const pixel of pixels) pixel.className = 'pixel';
        shuffle(pixels);
        const count = pixels.length;
        this._transitionPromise = new Promise(resolve => {
            pixels.forEach((pixel, i) => {
                setTimeout(() => {
                    pixel.classList.add('visible');
                    if (i === count - 1) resolve();
                }, (i / count) * 1400);
            });
        });
        await this._transitionPromise;
        await new Promise(r => setTimeout(r, 200));
    }

    async fillOut() {
        const pixels = this._pixels;
        for (const pixel of pixels) pixel.className = 'pixel visible';
        pixels.reverse();
        // shuffle(pixels);
        const count = pixels.length;
        this._transitionPromise = new Promise(resolve => {
            pixels.forEach((pixel, i) => {
                setTimeout(() => {
                    pixel.classList.remove('visible');
                    if (i === count - 1) resolve();
                }, (i / count) * 1000);
            });
        });
        await this._transitionPromise;
        await new Promise(r => setTimeout(r, 200));
    }

    destroy() {
        window.removeEventListener('resize', this._resizeHandler);
    }
}
