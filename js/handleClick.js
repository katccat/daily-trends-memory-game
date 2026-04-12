import { waitForFlag } from "./utils.js";
import { Graphics } from "./graphics.js";
import { Config } from "./config.js";
export async function handleClick (game) {
		if (game.state.awaitPlayer) {
			game.state.awaitPlayer = false;
			Graphics.hidePrompt();
			game.newGame(game.state.victory);
			return;
		}
		if (game.state.revealedCells.length > 1) {
			const [cell1, cell2] = game.state.revealedCells;
			if (!cell1.usedTrend) game.state.pendingTrends.add(cell1.getName());
			if (!cell2.usedTrend) game.state.pendingTrends.add(cell2.getName());
			game.state.revealedCells.length = 0;

			if (cell1.getName() === cell2.getName()) {
				cell1.solve();
				cell2.solve();
				game.cellLoopScheduler.newLoop(cell1, cell2);
				game.state.unsolvedCells -= 2;
				game.state.solvedCells.push(cell1, cell2);
				if (game.state.unsolvedCells <= 0) {
					game.winGame();
				}
			}
			else {
				game.state.remainingMistakes--;
				// if either of these cells have already been viewed, this could have been avoided
				
				const promises = [];

				if (game.state.viewedCells.includes(cell1) || game.state.viewedCells.includes(cell2)) {
					game.state.avoidableMistakes++;
					const shakePromise = Promise.all([cell1.transitioning, cell2.transitioning]).then(() => {
						cell1.shake();
						cell2.shake();
						return Promise.all([cell1.transitioning, cell2.transitioning]);
					});
					promises.push(shakePromise);
				}
				else {
					// if the player turned over the first cell which they have previously seen a match to but didn't make the match
					const word1 = cell1.getName();
					for (const cell of game.state.viewedCells) {
						if (cell.getName() == word1) {
							game.state.avoidableMistakes++;
							break;
						}
					}
				}
				if (game.state.avoidableMistakes > 0) {
					game.faceChanger.changeFace();
					// if (game.state.remainingMistakes <= 3 && game.state.remainingMistakes >= 0) Graphics.flashMessage(game.state.remainingMistakes);
				}
				if (game.state.remainingMistakes < 0) {
					game.loseGame();
					return;
				}
				game.state.cellsFading = true;
				const fadeDelay = new Promise(resolve => setTimeout(resolve, Config.delay.fade));
				const interrupt = waitForFlag(() => game.state.cellsFading, false);
				promises.push(fadeDelay, interrupt);
				await Promise.race(promises);

				game.state.cellsFading = false;
				cell1.hide();
				cell2.hide();
			}
			for (const cell of [cell1, cell2]) {
				if (!game.state.viewedCells.includes(cell)) {
					game.state.viewedCells.push(cell);
				}
			}
		}
	};