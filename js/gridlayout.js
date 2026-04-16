export function GridLayout(elements) {
	const factors = [];
	factors[4] = [2];
	factors[8] = [2, 4];
	factors[10] = [3, 4];
	factors[14] = [3, 5];
	factors[16] = [4];
	factors[20] = [4, 5];
	factors[24] = [3, 4, 6, 8];
	factors[36] = [3, 4, 6, 9, 12];
	let cellCount, suitableFactors;
	const grid = elements.grid;

	this.update = async function (numCells) {
		if (factors[numCells]) {
			suitableFactors = factors[numCells];
			cellCount = suitableFactors[0] * suitableFactors[suitableFactors.length - 1];
		}
		else {
			cellCount = numCells;
			suitableFactors = [];
			for (let i = 2; i < cellCount; i++) {
				if (cellCount % i == 0) suitableFactors.push(i);
			}
			if (suitableFactors.length > 2 && suitableFactors[0] == 2) {
				suitableFactors.splice(0, 1);
				suitableFactors.splice(-1, 1);
			}
		}
		this.resizeGrid();
	}
	this.findBestDimensions = function (viewportAspectRatio) {
		const columnCountEstimate = Math.sqrt(cellCount * viewportAspectRatio);
		let smallestDiffToFactor = Infinity;
		let bestColumnCount = suitableFactors[0];
		for (const factor of suitableFactors) {
			let diff = Math.abs(factor - columnCountEstimate);
			if (diff < smallestDiffToFactor) {
				smallestDiffToFactor = diff;
				bestColumnCount = factor;
			}
		}
		let bestRowCount = cellCount / bestColumnCount;
		return [bestColumnCount, bestRowCount];
	}
	this.resizeGrid = () => {
		const tooltip = elements.tooltip;
		const gameContainer = elements.gameContainer;
		const root = document.documentElement;
		const viewportWidth = gameContainer.getBoundingClientRect().width;
		const viewportHeight = window.innerHeight - tooltip.getBoundingClientRect().height;
		const viewportAspectRatio = viewportWidth / viewportHeight;
		const [columns, rows] = this.findBestDimensions(viewportWidth / viewportHeight);
		const gridAspectRatio = columns / rows;
		root.style.setProperty('--columns', columns);
		root.style.setProperty('--rows', rows);
		grid.style.aspectRatio = `${columns} / ${rows}`;

		if (viewportAspectRatio > gridAspectRatio) {
			// Viewport is wider than grid: set height to 100%, width auto
			grid.style.height = "100%";
			grid.style.width = "auto";
		}
		else {
			// Viewport is taller than grid: set width to 100%, height auto
			grid.style.width = "100%";
			grid.style.height = "auto";
		}
		tooltip.style.width = grid.getBoundingClientRect().width + 'px';
		const cellWidth = grid.getBoundingClientRect().width / columns;
		let cellPerspective;
		//console.log(cellWidth);
		if (cellWidth > 280) {
			cellPerspective = 720;
		} 
		else if (cellWidth > 150) {
			cellPerspective = 480;
		} 
		else if (cellWidth > 100) {
			cellPerspective = 300;
		} 
		else {
			cellPerspective = 200;
		} 
		root.style.setProperty('--cell-perspective', `${cellPerspective}px`);
	}
};