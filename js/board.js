import { Config } from './config.js';
import { randomItem } from './utils.js';
import { isPhone } from './utils.js';

export class Board {
	constructor(cellCount, images, additionalMistakes = 0, giveLife = false) {
		this.cellCount = cellCount;
		this.images = images;
		this.additionalMistakes = additionalMistakes;
		this.giveLife = giveLife;
		this.funColorChance = Config.funColorChance;
		this.allowRecycleWords = false;
	}
}

export class BoardCreator {
	static cellCounts = {
		normal: {
			easy: [8, 12, 16],
			medium: [18, 20, 24],
			hard: [30, 36],
		},
		phone: {
			easy: [8, 10, 12],
			medium: [14, 18],
			hard: [20],
		}
	};
	static levels = Config.difficulty;
	static giveLifeThreshold = 8;
	static previous = { level: null, board: null };
	static createBoard(level) {
		let cellCount, category, allowRecycleWords;

		{
			const availableCellCounts = isPhone() ? BoardCreator.cellCounts.phone : BoardCreator.cellCounts.normal;
			const cellCounts = availableCellCounts.easy;
			if (level >= BoardCreator.levels.medium) {
				cellCounts.push(...availableCellCounts.medium);
				if (level >= BoardCreator.levels.hard) {
					cellCounts.push(...availableCellCounts.hard);
				}
			}
			cellCount = randomItem(cellCounts);
		}

		category = Config.trendData.trends;
		allowRecycleWords = false;
		
		const board = new Board(cellCount, category);
		board.allowRecycleWords = allowRecycleWords;
		if (cellCount > 12) {
			board.additionalMistakes = 3;
		}
		else if (cellCount > 8) {
			board.additionalMistakes = 2;
		}
		else if (cellCount > 4) board.additionalMistakes = 1;

		if (cellCount >= BoardCreator.giveLifeThreshold) {
			board.giveLife = true;
		}
		BoardCreator.previous.board = board;
		BoardCreator.previous.level = level;
		return board;
	}
}