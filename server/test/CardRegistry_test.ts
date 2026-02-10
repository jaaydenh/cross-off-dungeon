import assert from "assert";
import { describe, it } from "mocha";
import { CARD_DEFINITIONS, createCardFromDefinition } from "../src/rooms/cards/CardRegistry";

describe("Card Registry", () => {
  it("should configure Any Two as up to 2 squares with a minimum of 1", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_any_two_room_or_monster");
    assert(definition, "Any Two card definition should exist");

    assert.strictEqual(definition.description, "Cross off up to 2 squares on a single room or monster");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 2);
  });

  it("should create Any Two cards with minSelections = 1 and maxSelections = 2", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_any_two_room_or_monster");
    assert(definition, "Any Two card definition should exist");

    const created = createCardFromDefinition(definition, "test_any_two");

    assert.strictEqual(created.type, "cross_any_two_room_or_monster");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 2);
    assert.strictEqual(created.description, "Cross off up to 2 squares on a single room or monster");
  });

  it("should configure Reposition as a room-only adjacent move with a bonus draw", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "reposition");
    assert(definition, "Reposition card definition should exist");

    assert.strictEqual(definition.name, "Reposition");
    assert.strictEqual(definition.selection.target, "room");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 2);
    assert.strictEqual(definition.selection.maxSelections, 2);
    assert.strictEqual(definition.selection.connected, true);
    assert.strictEqual(definition.selection.requireRoomStartAdjacency, true);
    assert.strictEqual(definition.drawCardsOnResolve, 1);
  });

  it("should create Reposition cards with drawCardsOnResolve = 1", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "reposition");
    assert(definition, "Reposition card definition should exist");

    const created = createCardFromDefinition(definition, "test_reposition");

    assert.strictEqual(created.type, "reposition");
    assert.strictEqual(created.minSelections, 2);
    assert.strictEqual(created.maxSelections, 2);
    assert.strictEqual(created.requiresConnected, true);
    assert.strictEqual(created.selectionTarget, "room");
    assert.strictEqual(created.drawCardsOnResolve, 1);
  });
});
