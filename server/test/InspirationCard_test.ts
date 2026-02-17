import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";

const CASTER_SESSION_ID = "inspiration_caster";
const TARGET_SESSION_ID = "inspiration_target";

const makeInspirationCard = (id: string) =>
  new Card(
    id,
    "inspiration",
    "Pick a player. They can use their active card an extra time. Then cross off a single square on any card.",
    "room_or_monster",
    "squares",
    1,
    1,
    false,
    false,
    false,
    "dodge",
    0,
    "green",
    "Inspiration"
  );

const makeSingleRoomCard = (id: string) =>
  new Card(
    id,
    "single_room_cross",
    "Cross 1 room square.",
    "room",
    "squares",
    1,
    1,
    false,
    false,
    false,
    "empty",
    0,
    "clear",
    "Single Room Cross"
  );

const createStateWithTwoPlayers = (): {
  state: DungeonState;
  caster: any;
  target: any;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(CASTER_SESSION_ID, "Caster");
  state.createPlayer(TARGET_SESSION_ID, "Target");

  const caster = state.players.get(CASTER_SESSION_ID)!;
  const target = state.players.get(TARGET_SESSION_ID)!;

  caster.deck.clear();
  caster.drawnCards.clear();
  caster.discardPile.clear();

  target.deck.clear();
  target.drawnCards.clear();
  target.discardPile.clear();

  return { state, caster, target };
};

const findFirstAvailableRoomSquare = (state: DungeonState): { roomIndex: number; x: number; y: number } => {
  for (let roomIndex = 0; roomIndex < state.rooms.length; roomIndex++) {
    const room = state.rooms[roomIndex];
    if (!room) continue;

    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const square = room.getSquare(x, y);
        if (!square || square.wall || square.checked) {
          continue;
        }
        return { roomIndex, x, y };
      }
    }
  }

  throw new Error("No available room square found for Inspiration tests");
};

describe("Inspiration Card", () => {
  it("should require picking a player before crossing a square", () => {
    const { state, caster } = createStateWithTwoPlayers();
    const inspiration = makeInspirationCard("inspiration_active");
    inspiration.isActive = true;
    caster.drawnCards.push(inspiration);
    state.activeCardPlayers.set(CASTER_SESSION_ID, inspiration.id);

    const targetSquare = findFirstAvailableRoomSquare(state);
    const crossResult = state.crossSquare(
      { sessionId: CASTER_SESSION_ID } as any,
      {
        roomIndex: targetSquare.roomIndex,
        x: targetSquare.x,
        y: targetSquare.y
      }
    );

    assert.strictEqual(crossResult.success, false);
    assert.strictEqual(crossResult.invalidSquare, true);
    assert(crossResult.error?.includes("Select a player"));
  });

  it("should grant an extra active-card use to the selected player when Inspiration resolves", () => {
    const { state, caster } = createStateWithTwoPlayers();
    const inspiration = makeInspirationCard("inspiration_active");
    inspiration.isActive = true;
    caster.drawnCards.push(inspiration);
    state.activeCardPlayers.set(CASTER_SESSION_ID, inspiration.id);

    const selectResult = state.selectInspirationTarget(CASTER_SESSION_ID, TARGET_SESSION_ID);
    assert.strictEqual(selectResult.success, true);
    assert.strictEqual(state.inspirationPendingTargets.get(CASTER_SESSION_ID), TARGET_SESSION_ID);

    const targetSquare = findFirstAvailableRoomSquare(state);
    const crossResult = state.crossSquare(
      { sessionId: CASTER_SESSION_ID } as any,
      {
        roomIndex: targetSquare.roomIndex,
        x: targetSquare.x,
        y: targetSquare.y
      }
    );
    assert.strictEqual(crossResult.success, true);
    assert.strictEqual(crossResult.completed, false);

    const confirmResult = state.confirmCardAction(CASTER_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(state.inspirationExtraActiveUses.get(TARGET_SESSION_ID), 1);
    assert.strictEqual(state.inspirationPendingTargets.has(CASTER_SESSION_ID), false);
    assert.strictEqual(caster.drawnCards.length, 0);
    assert.strictEqual(caster.discardPile.length, 1);
    assert.strictEqual(caster.discardPile[0].type, "inspiration");
  });

  it("should return the target player's active card to drawn cards once and consume the x2 replay", () => {
    const state = new DungeonState();
    state.initializeBoard();
    state.createPlayer(TARGET_SESSION_ID, "Target");

    const target = state.players.get(TARGET_SESSION_ID)!;
    target.deck.clear();
    target.drawnCards.clear();
    target.discardPile.clear();

    const activeCard = makeSingleRoomCard("target_active_card");
    activeCard.isActive = true;
    target.drawnCards.push(activeCard);
    state.activeCardPlayers.set(TARGET_SESSION_ID, activeCard.id);
    state.inspirationExtraActiveUses.set(TARGET_SESSION_ID, 1);

    const targetSquare = findFirstAvailableRoomSquare(state);
    const crossResult = state.crossSquare(
      { sessionId: TARGET_SESSION_ID } as any,
      {
        roomIndex: targetSquare.roomIndex,
        x: targetSquare.x,
        y: targetSquare.y
      }
    );
    assert.strictEqual(crossResult.success, true);
    assert.strictEqual(crossResult.completed, false);

    const confirmResult = state.confirmCardAction(TARGET_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(state.activeCardPlayers.has(TARGET_SESSION_ID), false);
    assert.strictEqual(state.inspirationExtraActiveUses.has(TARGET_SESSION_ID), false);
    assert.strictEqual(target.drawnCards.length, 1);
    assert.strictEqual(target.drawnCards[0].id, activeCard.id);
    assert.strictEqual(target.drawnCards[0].isActive, false);
    assert.strictEqual(target.discardPile.length, 0);
    assert(confirmResult.message?.includes("returned to your active pile"));
  });
});
