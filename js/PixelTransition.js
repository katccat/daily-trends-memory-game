import { shuffle } from './utils.js';
import { Elements } from './graphics.js';
import { isPhone } from './utils.js';

const PIXEL_SIZE = isPhone() ? 32 : 36; // target square side length in CSS pixels
const SNAP_MS = 120; // delay between opacity steps (1→0.5→0 or reverse)
const buffer = 300;

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

    // Advances exactly pixelsPerFrame pixels per animation frame.
    // onStep1 fires immediately on a pixel's turn; onStep2 fires SNAP_MS later.
    // The returned promise resolves once every pixel's onStep2 has run.
    _animate(pixels, pixelsPerFrame, onStep1, onStep2) {
        return new Promise(resolve => {
            let idx = 0;
            let pending = 0;
            const total = pixels.length;

            const tick = () => {
                const end = Math.min(idx + pixelsPerFrame, total);
                for (let i = idx; i < end; i++) {
                    const pixel = pixels[i];
                    onStep1(pixel);
                    pending++;
                    setTimeout(() => {
                        onStep2(pixel);
                        pending--;
                        if (idx >= total && pending === 0) resolve();
                    }, SNAP_MS);
                }
                idx = end;
                if (idx < total) requestAnimationFrame(tick);
            };

            requestAnimationFrame(tick);
        });
    }

    async fillIn(pixelsPerFrame = 3) {
        const pixels = this._pixels;
        for (const pixel of pixels) pixel.className = 'pixel';
        shuffle(pixels);
        this._transitionPromise = this._animate(
            pixels, pixelsPerFrame,
            pixel => pixel.classList.add('half'),
            pixel => { pixel.classList.remove('half'); pixel.classList.add('visible'); }
        );
        await this._transitionPromise;
        await new Promise(r => setTimeout(r, buffer));
    }

    async fillOut(pixelsPerFrame = 3) {
        const pixels = this._pixels;
        for (const pixel of pixels) pixel.className = 'pixel visible';
        pixels.reverse();
        this._transitionPromise = this._animate(
            pixels, pixelsPerFrame,
            pixel => { pixel.classList.remove('visible'); pixel.classList.add('half'); },
            pixel => pixel.classList.remove('half')
        );
        await this._transitionPromise;
        await new Promise(r => setTimeout(r, buffer));
    }

    destroy() {
        window.removeEventListener('resize', this._resizeHandler);
    }
}
