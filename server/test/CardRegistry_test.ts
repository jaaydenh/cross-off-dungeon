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
});
