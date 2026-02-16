import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";

const SPREAD_OUT_CARD_TYPE = "spread_out_room_overlay";
const TEST_SESSION_ID = "spread_out_test_player";

const makeSpreadOutCard = (id: string) =>
  new Card(
    id,
    SPREAD_OUT_CARD_TYPE,
    "Choose any square in a room. Cross off that square. You may cross off any adjacent squares.",
    "room",
    "centered_room_3x3",
    1,
    9,
    false,
    false,
    false,
    "empty",
    0,
    "green",
    "Spread Out"
  );

const createStateWithActiveSpreadOutCard = (): {
  state: DungeonState;
  player: any;
  activeCardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "SpreadOutPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const activeCardId = "spread_out_card";
  const card = makeSpreadOutCard(activeCardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

  return { state, player, activeCardId };
};

const resetRoomSquares = (room: any): void => {
  for (const square of room.squares) {
    square.wall = false;
    square.checked = false;
  }
};

const getSpreadTargets = (room: any, centerX: number, centerY: number): Array<{ x: number; y: number }> => {
  const coords: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      const square = room.getSquare(x, y);
      if (!square || square.wall || square.checked) {
        continue;
      }
      coords.push({ x, y });
    }
  }
  return coords;
};

describe("Spread Out Card", () => {
  it("should stage center square and optional 3x3 squares, then cross on confirm", () => {
    const { state, player } = createStateWithActiveSpreadOutCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);

    const center = { x: 2, y: 2 };
    room.getSquare(1, 1)!.wall = true; // Optional square should be ignored.
    room.getSquare(2, 1)!.checked = true; // Optional square should be ignored.

    const expectedTargets = getSpreadTargets(room, center.x, center.y);
    assert.strictEqual(expectedTargets.some((target) => target.x === center.x && target.y === center.y), true);
    assert.strictEqual(expectedTargets.length, 7);

    const result = state.selectSquareForCard(TEST_SESSION_ID, 0, center.x, center.y);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, false);
    assert(result.message?.includes("Spread Out selected 7"));

    // Pending selection should be staged but not yet committed to the room.
    for (const target of expectedTargets) {
      if (target.x === 2 && target.y === 1) {
        // This square was pre-checked to simulate an invalid optional target.
        assert.strictEqual(room.getSquare(target.x, target.y)?.checked, true);
      } else {
        assert.strictEqual(room.getSquare(target.x, target.y)?.checked, false);
      }
    }

    const selectionState = state.getCardSelectionState(TEST_SESSION_ID);
    assert.strictEqual(selectionState.selectedCount, 7);

    const confirm = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirm.success, true);
    assert.strictEqual(confirm.completed, true);

    for (const target of expectedTargets) {
      assert.strictEqual(room.getSquare(target.x, target.y)?.checked, true);
    }
    assert.strictEqual(room.getSquare(1, 1)?.wall, true);
    assert.strictEqual(room.getSquare(1, 1)?.checked, false);
    assert.strictEqual(room.getSquare(2, 1)?.checked, true);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, SPREAD_OUT_CARD_TYPE);
  });

  it("should fail when the center square is already crossed", () => {
    const { state, player } = createStateWithActiveSpreadOutCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);

    const center = { x: 2, y: 2 };
    room.getSquare(center.x, center.y)!.checked = true;

    const result = state.selectSquareForCard(TEST_SESSION_ID, 0, center.x, center.y);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidSquare, true);
    assert(result.error?.includes("Center square is already crossed"));

    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.discardPile.length, 0);
    assert.strictEqual(player.drawnCards[0].isActive, true);
  });

  it("should fail when no square in the Spread Out area is adjacent to entrance or an existing crossed square", () => {
    const { state, player } = createStateWithActiveSpreadOutCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);

    // Remove entrance adjacency from consideration to isolate the crossed-square rule.
    room.entranceX = -1;
    room.entranceY = -1;

    const result = state.selectSquareForCard(TEST_SESSION_ID, 0, 2, 2);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidSquare, true);
    assert(result.error?.includes("adjacent to the entrance or an existing crossed square"));

    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.discardPile.length, 0);
    assert.strictEqual(player.drawnCards[0].isActive, true);
  });

  it("should clear pending Spread Out selections when card action is cancelled", () => {
    const { state, player } = createStateWithActiveSpreadOutCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);
    room.getSquare(2, 1)!.checked = true;

    const result = state.selectSquareForCard(TEST_SESSION_ID, 0, 2, 2);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, false);

    const stagedState = state.getCardSelectionState(TEST_SESSION_ID);
    assert(stagedState.selectedCount > 0);

    const cancel = state.cancelCardAction(TEST_SESSION_ID);
    assert.strictEqual(cancel.success, true);

    const finalState = state.getCardSelectionState(TEST_SESSION_ID);
    assert.strictEqual(finalState.selectedCount, 0);
    assert.strictEqual(finalState.hasActiveCard, false);
    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.discardPile.length, 0);
  });
});
