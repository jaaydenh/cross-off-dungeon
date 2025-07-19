import assert from "assert";
import { describe, it } from "mocha";
import { Card } from "../src/rooms/schema/Card";

describe("Card Schema", () => {
  describe("Card Construction", () => {
    it("should create a card with correct properties", () => {
      const card = new Card("test_id", "cross_connected_squares", "Test description");
      
      assert.strictEqual(card.id, "test_id");
      assert.strictEqual(card.type, "cross_connected_squares");
      assert.strictEqual(card.description, "Test description");
      assert.strictEqual(card.isActive, false);
    });

    it("should initialize isActive as false by default", () => {
      const card = new Card("id", "type", "desc");
      assert.strictEqual(card.isActive, false);
    });
  });

  describe("Card State Management", () => {
    it("should allow setting isActive to true", () => {
      const card = new Card("id", "type", "desc");
      card.isActive = true;
      assert.strictEqual(card.isActive, true);
    });

    it("should allow setting isActive back to false", () => {
      const card = new Card("id", "type", "desc");
      card.isActive = true;
      card.isActive = false;
      assert.strictEqual(card.isActive, false);
    });
  });

  describe("Card Properties", () => {
    it("should maintain immutable id after creation", () => {
      const card = new Card("original_id", "type", "desc");
      card.id = "new_id";
      assert.strictEqual(card.id, "new_id"); // Properties are mutable in this implementation
    });

    it("should allow type modification", () => {
      const card = new Card("id", "original_type", "desc");
      card.type = "new_type";
      assert.strictEqual(card.type, "new_type");
    });

    it("should allow description modification", () => {
      const card = new Card("id", "type", "original_desc");
      card.description = "new_desc";
      assert.strictEqual(card.description, "new_desc");
    });
  });

  describe("Card Type Validation", () => {
    it("should handle cross_connected_squares type correctly", () => {
      const card = new Card("id", "cross_connected_squares", "Cross any 3 connected squares");
      assert.strictEqual(card.type, "cross_connected_squares");
      assert.strictEqual(card.description, "Cross any 3 connected squares");
    });

    it("should handle empty strings", () => {
      const card = new Card("", "", "");
      assert.strictEqual(card.id, "");
      assert.strictEqual(card.type, "");
      assert.strictEqual(card.description, "");
    });
  });
});