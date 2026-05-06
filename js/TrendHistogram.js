import { Config } from "./config.js";
const BUCKETS = [
	{ label: '1K',   min: 0,         max: 1_000       },
	{ label: '5K',   min: 1_000,      max: 5_000     },
	{ label: '10K',  min: 5_000,      max: 10_000    },
	{ label: '50K',  min: 10_000,     max: 50_000    },
	{ label: '100K', min: 50_000,     max: 100_000   },
	{ label: '1M', min: 100_000,    max: Infinity   },
];

const colors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335'];
const shadowColors = colors.map(hex => {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgb(${Math.round(r * 0.8)}, ${Math.round(g * 0.8)}, ${Math.round(b * 0.8)})`;
});
const alwaysInterpolate = true;

// Builds a height→color map for the given array of relPct values.
// Unique heights sorted descending are divided into min(uniqueCount, colors.length)
// equal-sized groups; each group gets the next color so the tallest bars are blue.
function buildColorMap(relPcts) {
	const unique = [...new Set(relPcts)].sort((a, b) => b - a);
	const numColors = Math.min(unique.length, colors.length);
	const map = new Map();
	const shadowMap = new Map();
	for (let i = 0; i < numColors; i++) {
		const start = Math.floor(i * unique.length / numColors);
		const end   = Math.floor((i + 1) * unique.length / numColors);
		for (let j = start; j < end; j++) {
			map.set(unique[j], colors[i]);
			shadowMap.set(unique[j], shadowColors[i]);
		}
	}
	return { map, shadowMap };
}


function parseViews(str) {
	if (!str) return 0;
	try {
		const s = str.trim().toUpperCase();
		if (s.endsWith('K')) return parseFloat(s) * 1e3;
		if (s.endsWith('M')) return parseFloat(s) * 1e6;
		if (s.endsWith('B')) return parseFloat(s) * 1_000_000_000;
		return parseFloat(s) || 0;
	}
	catch {return 0;}
}

export class TrendHistogram {
	// dynamicScale: true  → tallest won column always fills 100% of the column height;
	//                        all tracks are equal height, fills encode won / max(won).
	//               false → track height encodes bucket size (totals[i] / maxTotal);
	//                        fill encodes completion rate (won[i] / totals[i]).
	//                        Bars with more total members are always taller.
	constructor(trendData, containerEl, { dynamicScale = true } = {}) {
		this._container   = containerEl;
		this._dynamicScale = dynamicScale;
		this._trends = Object.entries(trendData.trends || {}).map(([name, d]) => ({
			name,
			views: parseViews(d.views),
		}));
		this._totals   = this._computeTotals();
		this._maxTotal = Math.max(...this._totals, 1);
		this._won      = new Array(BUCKETS.length).fill(0);
		// Only track bars for non-empty buckets; map from bucket index → bar entry
		this._bars     = new Map();
		this._render(containerEl);
	}

	_bucketOf(views) {
		return BUCKETS.findIndex(b => views >= b.min && views < b.max);
	}

	_computeTotals() {
		const totals = new Array(BUCKETS.length).fill(0);
		for (const t of this._trends) {
			const i = this._bucketOf(t.views);
			if (i >= 0) totals[i]++;
		}
		return totals;
	}

	_render(container) {
		container.innerHTML = '';
		container.classList.add('trend-histogram');

		BUCKETS.forEach((bucket, i) => {
			if (this._totals[i] === 0) return;

			const col = document.createElement('div');
			col.className = 'hist-col';
			col.style.display = 'none';

			const track = document.createElement('div');
			track.className = 'hist-track';
			track.title = `${bucket.label}`;

			const fill = document.createElement('div');
			fill.className = 'hist-fill';
			fill.style.height = '0%';

			const label = document.createElement('div');
			label.className = 'hist-label';
			label.textContent = bucket.label;

			fill.append(label);
			track.append(fill);

			col.append(track);
			container.append(col);
			this._bars.set(i, { fill, track, col });
		});
	}

	// Shows columns that have won trends (at 0% height ready to animate up) and
	// hides columns that have dropped back to zero.
	// Called automatically by updateTrends: before the update when shrinking
	// (so columns stay visible to animate down), after when growing (so new columns
	// appear at 0% ready to animate up).
	provisionSpace() {
		for (const [i, { fill, col }] of this._bars) {
			if (this._won[i] > 0 && col.style.display === 'none') {
				col.style.display = '';
				fill.style.height = '0%';
			} else if (this._won[i] === 0) {
				col.style.display = 'none';
			}
		}
	}

	async rescale() {
		const visibleEntries = [...this._bars.entries()].filter(([, { col }]) => col.style.display !== 'none');
		if (visibleEntries.length <= 2) {
			this.hide();
			return;
		}
		const wonCounts = visibleEntries.map(([i]) => this._won[i]);
		if (wonCounts.every(v => v === wonCounts[0])) {
			this.hide();
			return;
		}

		this.show();
		if (alwaysInterpolate) {
			for (const { fill } of visibleEntries.map(([, bar]) => bar)) {
				fill.style.transition = 'none';
				fill.style.height = '0%';
			}
			visibleEntries[0]?.[1]?.fill?.offsetHeight; // commit 0% before re-enabling transition
			for (const { fill } of visibleEntries.map(([, bar]) => bar)) {
				fill.style.transition = '';
			}
		}
		const toReveal = [];

		if (this._dynamicScale) {
			// Track heights are uniform; fill encodes won / max(won) so the
			// most-won bucket always reaches full column height.
			const maxWon = Math.max(...this._won, 1);
			const visible = [...this._bars.entries()]
				.filter(([, { col }]) => col.style.display !== 'none')
				.map(([i, bar]) => ({ ...bar, relPct: this._won[i] / maxWon }));
			const { map: colorMap, shadowMap } = buildColorMap(visible.map(v => v.relPct));
			for (const { fill, track, relPct } of visible) {
				track.style.height = '100%';
				fill.style.background = colorMap.get(relPct);
				fill.style.boxShadow = `inset 5px 0px 0px 0px ${shadowMap.get(relPct)}, var(--card-shadow)`;
				const targetPct = relPct * 100;
				if (fill.style.height === '0%' && relPct > 0) {
					toReveal.push({ fill, targetPct });
				} else {
					fill.style.height = `${targetPct}%`;
				}
			}
		} else {
			// Track height encodes bucket size so a bucket with more total trends
			// is always a taller column than one with fewer. Fill encodes the
			// completion rate within that bucket (won / total).
			const maxCompletionRate = Math.max(
				...[...this._bars.keys()].map(i => this._won[i] / this._totals[i]),
				0.001,
			);
			const visible = [...this._bars.entries()]
				.filter(([, { col }]) => col.style.display !== 'none')
				.map(([i, bar]) => ({ ...bar, relPct: (this._won[i] / this._totals[i]) / maxCompletionRate, completionRate: this._won[i] / this._totals[i], bucketIdx: i }));
			const { map: colorMap, shadowMap } = buildColorMap(visible.map(v => v.relPct));
			for (const { fill, track, relPct, completionRate, bucketIdx } of visible) {
				track.style.height = `${this._totals[bucketIdx] / this._maxTotal * 100}%`;
				fill.style.background = colorMap.get(relPct);
				fill.style.boxShadow = `inset 5px 0px 0px 0px ${shadowMap.get(relPct)}, var(--card-shadow)`;

				const targetPct = completionRate * 100;
				if (fill.style.height === '0%' && completionRate > 0) {
					toReveal.push({ fill, targetPct });
				} else {
					fill.style.height = `${targetPct}%`;
				}
			}
		}

		if (toReveal.length) {
			// Force a reflow so the CSS transition starts from 0%, not a cached value.
			toReveal[0].fill.offsetHeight;
			for (const { fill, targetPct } of toReveal) {
				fill.style.height = `${targetPct}%`;
			}
		}
		await new Promise(r => setTimeout(r, Config.delay.showHistogram));
	}

	hide() {
		this._container.style.display = 'none';
	}
	show() {
		this._container.style.display = '';
	}
	// Recomputes won counts from the full list of attained trend names.
	// provisionSpace() runs after the update when the total grows (new columns appear
	// at 0% ready to animate up) and before when it shrinks (old columns stay visible
	// to animate down). Call rescale() after to apply the new heights.
	updateTrends(trendNames) {
		const newWon = new Array(BUCKETS.length).fill(0);
		for (const name of trendNames) {
			const trend = this._trends.find(t => t.name === name);
			if (!trend) continue;
			const i = this._bucketOf(trend.views);
			if (i >= 0 && this._totals[i] > 0) newWon[i] = Math.min(newWon[i] + 1, this._totals[i]);
		}
		const oldTotal = this._won.reduce((a, b) => a + b, 0);
		const newTotal = newWon.reduce((a, b) => a + b, 0);
		if (newTotal >= oldTotal) {
			this._won = newWon;
			this.provisionSpace();
		} else {
			this.provisionSpace();
			this._won = newWon;
		}
	}

	reset() {
		this._won.fill(0);
		this.rescale();
	}

	destroy() {
		this._container?.replaceChildren();
	}
}
