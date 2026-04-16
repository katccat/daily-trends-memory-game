import { Config } from './config.js';
import { randomItem } from './utils.js';
import { isPhone } from './utils.js';

export class Board {
	constructor(cellCount, additionalMistakes = 0) {
		this.cellCount = cellCount;
		this.additionalMistakes = additionalMistakes;
		this.giveLife = true;
	}
}

export class BoardCreator {
	static cellCounts = {
		normal: {
			easy: [10, 12, 14],
			medium: [16, 18, 20, 24],
			hard: [30, 36],
		},
		phone: {
			easy: [10, 12, 12],
			medium: [14, 14, 18],
			hard: [20, 20],
		},
		challenge: {
			easy: [10, 12],
			medium: [14, 14],
			hard: [14],
		}
	};
	static previous = { level: null, board: null };
	static createBoard(level, lives, challengeMode = false) {
		let cellCount, additionalMistakes;

		{
			const difficulty = Config.difficulty;
			let availableCellCounts;
			if (challengeMode) availableCellCounts = BoardCreator.cellCounts.challenge;
			else availableCellCounts = isPhone() ? BoardCreator.cellCounts.phone : BoardCreator.cellCounts.normal;
			const cellCounts = [...availableCellCounts.easy];
			if (level >= difficulty.medium) {
				cellCounts.push(...availableCellCounts.medium);
				if (level >= difficulty.hard) {
					cellCounts.push(...availableCellCounts.hard);
				}
			}
			if (level === BoardCreator.previous.level && lives <= 1) {
				const maxCellCount = BoardCreator.previous.board.cellCount > 14 ? BoardCreator.previous.board.cellCount : 14;
				do {
					cellCount = randomItem(cellCounts);
				} while (cellCount > maxCellCount);
			}
			else cellCount = randomItem(cellCounts);
		}

		if (!challengeMode) {
			if (cellCount > 14) {
				additionalMistakes = 1;
			}
		}
		else {
			if (cellCount > 8) additionalMistakes = 2;
			else additionalMistakes = 1;
		}
		
		const board = new Board(cellCount, additionalMistakes);
		BoardCreator.previous.board = board;
		BoardCreator.previous.level = level;
		return board;
	}
}