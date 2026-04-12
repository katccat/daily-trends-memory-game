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
		}
	};
	static previous = { level: null, board: null };
	static createBoard(level, challengeMode = false) {
		let cellCount, additionalMistakes;

		{
			const difficulty = Config.difficulty;
			const availableCellCounts = isPhone() ? BoardCreator.cellCounts.phone : BoardCreator.cellCounts.normal;
			const cellCounts = [...availableCellCounts.easy];
			if (level >= difficulty.medium) {
				cellCounts.push(...availableCellCounts.medium);
				if (level >= difficulty.hard) {
					cellCounts.push(...availableCellCounts.hard);
				}
			}
			if (level === BoardCreator.previous.level) {
				const maxCellCount = BoardCreator.previous.board.cellCount > 14 ? BoardCreator.previous.board.cellCount : 14;
				do {
					cellCount = randomItem(cellCounts);
				} while (cellCount > maxCellCount);
			}
			else cellCount = randomItem(cellCounts);
		}

		{
			const give = challengeMode ? 1 : 0;
			if (cellCount > 18 || (cellCount > 16 && isPhone())) {
				additionalMistakes = 2 + give;
			}
			else if (cellCount > 14) {
				additionalMistakes = 1 + give;
			}
		}
		
		const board = new Board(cellCount, additionalMistakes);
		BoardCreator.previous.board = board;
		BoardCreator.previous.level = level;
		return board;
	}
}