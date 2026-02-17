import assert from "assert";
import { describe, it } from "mocha";
import { Card } from "../src/rooms/schema/Card";
import { DungeonState } from "../src/rooms/schema/DungeonState";

const HEROIC_DOUBLE_SWEEP_CARD_TYPE = "cross_two_horizontal_then_two_horizontal";
const TEST_SESSION_ID = "heroic_double_sweep_test_player";

const makeHeroicDoubleSweepCard = (id: string) =>
  new Card(
    id,
    HEROIC_DOUBLE_SWEEP_CARD_TYPE,
    "Cross off 2 horizontal squares, then 2 more horizontal squares",
    "room_or_monster",
    "horizontal_pair_twice",
    4,
    4,
    false,
    false,
    false,
    "counter"
  );

type HorizontalPairPlan = {
  anchorOneX: number;
  anchorTwoX: number;
  rowY: number;
  exitIndex: number;
  support: { x: number; y: number };
};

const getPairSquares = (anchorX: number, rowY: number): Array<{ x: number; y: number }> => [
  { x: anchorX, y: rowY },
  { x: anchorX + 1, y: rowY }
];

const findHorizontalExitPlan = (room: any): HorizontalPairPlan => {
  for (let exitIndex = 0; exitIndex < room.exitX.length; exitIndex++) {
    const exitX = room.exitX[exitIndex];
    const rowY = room.exitY[exitIndex];
    const anchorCandidates = [exitX - 1, exitX].filter(
      (anchorX) => anchorX >= 0 && anchorX + 1 < room.width
    );

    for (const anchorOneX of anchorCandidates) {
      const pairOneSquares = getPairSquares(anchorOneX, rowY);
      const pairTwoCandidates = [anchorOneX + 2, anchorOneX - 2].filter(
        (anchorX) => anchorX >= 0 && anchorX + 1 < room.width
      );

      for (const anchorTwoX of pairTwoCandidates) {
        const pairTwoSquares = getPairSquares(anchorTwoX, rowY);
        const occupied = new Set(
          [...pairOneSquares, ...pairTwoSquares].map((square) => `${square.x},${square.y}`)
        );
        if (occupied.size !== 4) {
          continue;
        }

        const supportCandidates = [
          { x: anchorOneX - 1, y: rowY },
          { x: anchorOneX + 2, y: rowY },
          { x: anchorOneX, y: rowY - 1 },
          { x: anchorOneX, y: rowY + 1 },
          { x: anchorOneX + 1, y: rowY - 1 },
          { x: anchorOneX + 1, y: rowY + 1 }
        ].filter(
          (candidate) =>
            candidate.x >= 0 &&
            candidate.x < room.width &&
            candidate.y >= 0 &&
            candidate.y < room.height &&
            !occupied.has(`${candidate.x},${candidate.y}`)
        );

        const support = supportCandidates[0];
        if (!support) {
          continue;
        }

        return { anchorOneX, anchorTwoX, rowY, exitIndex, support };
      }
    }
  }

  throw new Error("Failed to find a horizontal pair plan that includes an exit square");
};

describe("Heroic Double Sweep", () => {
  it("should open a room from an exit only after confirmCardAction", () => {
    const state = new DungeonState();
    state.initializeBoard();
    state.createPlayer(TEST_SESSION_ID, "HeroicDoubleSweepPlayer");

    const player = state.players.get(TEST_SESSION_ID)!;
    player.deck.clear();
    player.drawnCards.clear();
    player.discardPile.clear();

    const activeCardId = "heroic_double_sweep_card";
    const card = makeHeroicDoubleSweepCard(activeCardId);
    card.isActive = true;
    player.drawnCards.push(card);
    state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

    const room = state.getCurrentRoom()!;
    const { anchorOneX, anchorTwoX, rowY, exitIndex, support } = findHorizontalExitPlan(room);
    const pairOneSquares = getPairSquares(anchorOneX, rowY);
    const pairTwoSquares = getPairSquares(anchorTwoX, rowY);
    const allPairSquares = [...pairOneSquares, ...pairTwoSquares];

    for (const squarePos of allPairSquares) {
      const square = room.getSquare(squarePos.x, squarePos.y);
      assert(square, "Expected pair square to exist");
      square!.wall = false;
      square!.checked = false;
    }

    const supportSquare = room.getSquare(support.x, support.y);
    assert(supportSquare, "Expected support square to exist");
    supportSquare!.wall = false;
    supportSquare!.checked = true;

    const initialRoomCount = state.rooms.length;
    const initialDisplayedCount = state.displayedRoomIndices.length;

    const firstPair = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: anchorOneX, y: rowY }
    );
    assert.strictEqual(firstPair.success, true);
    assert.strictEqual(firstPair.completed, false);
    assert.strictEqual(state.rooms.length, initialRoomCount);
    assert.strictEqual(state.displayedRoomIndices.length, initialDisplayedCount);

    const secondPair = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: anchorTwoX, y: rowY }
    );
    assert.strictEqual(secondPair.success, true);
    assert.strictEqual(secondPair.completed, false);
    assert.strictEqual(state.rooms.length, initialRoomCount);
    assert.strictEqual(state.displayedRoomIndices.length, initialDisplayedCount);

    for (const squarePos of allPairSquares) {
      const square = room.getSquare(squarePos.x, squarePos.y);
      assert.strictEqual(square?.checked, false);
    }

    const beforeConfirmSelectionState = state.getCardSelectionState(TEST_SESSION_ID);
    assert.strictEqual(beforeConfirmSelectionState.selectedCount, 4);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    for (const squarePos of allPairSquares) {
      const square = room.getSquare(squarePos.x, squarePos.y);
      assert.strictEqual(square?.checked, true);
    }

    assert.strictEqual(room.exitConnected[exitIndex], true);
    assert.strictEqual(state.rooms.length, initialRoomCount + 1);
    assert.strictEqual(state.displayedRoomIndices.length, initialDisplayedCount + 1);
  });
});
