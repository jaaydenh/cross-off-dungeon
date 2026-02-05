import { Card } from "../schema/Card";

export type CardSelectionTarget = "room" | "monster" | "room_or_monster" | "monster_each";
export type CardSelectionMode = "squares" | "row";

export type CardDefinition = {
  id: string;
  name: string;
  description: string;
  selection: {
    target: CardSelectionTarget;
    mode: CardSelectionMode;
    minSelections?: number;
    maxSelections?: number;
    connected?: boolean;
    requireRoomStartAdjacency?: boolean;
    requireMonsterStartAdjacency?: boolean;
  };
};

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: "cross_connected_squares",
    name: "Connected Cross",
    description: "Cross off up to 3 connected squares",
    selection: {
      target: "room",
      mode: "squares",
      minSelections: 1,
      maxSelections: 3,
      connected: true,
      requireRoomStartAdjacency: true
    }
  },
  {
    id: "cross_any_two_room_or_monster",
    name: "Any Two",
    description: "Cross off any 2 squares on a single room or monster",
    selection: {
      target: "room_or_monster",
      mode: "squares",
      minSelections: 2,
      maxSelections: 2,
      connected: false,
      // This card allows starting anywhere in a room (no entrance/cross-adjacent requirement).
      requireRoomStartAdjacency: false,
      requireMonsterStartAdjacency: false
    }
  },
  {
    id: "cross_two_connected_each_monster",
    name: "Every Monster",
    description: "Cross off 2 connected squares on every monster",
    selection: {
      target: "monster_each",
      mode: "squares",
      minSelections: 2,
      maxSelections: 2,
      connected: true,
      requireMonsterStartAdjacency: true
    }
  },
  {
    id: "cross_row_room",
    name: "Horizontal Sweep",
    description: "Cross off all horizontal squares on a single room",
    selection: {
      target: "room",
      mode: "row",
      minSelections: 1,
      connected: false,
      requireRoomStartAdjacency: true
    }
  }
];

const CARD_DEFINITIONS_BY_ID = new Map(CARD_DEFINITIONS.map((card) => [card.id, card]));

export function getCardDefinition(id: string): CardDefinition | undefined {
  return CARD_DEFINITIONS_BY_ID.get(id);
}

export function createCardFromDefinition(definition: CardDefinition, id: string): Card {
  const selection = definition.selection;
  return new Card(
    id,
    definition.id,
    definition.description,
    selection.target,
    selection.mode,
    selection.minSelections ?? 1,
    selection.maxSelections ?? 0,
    selection.connected ?? false,
    selection.requireRoomStartAdjacency ?? false,
    selection.requireMonsterStartAdjacency ?? false
  );
}

export function createStarterDeck(): Card[] {
  const cards: Card[] = [];
  let cardIndex = 1;

  for (const definition of CARD_DEFINITIONS) {
    for (let i = 0; i < 2; i++) {
      cards.push(createCardFromDefinition(definition, `card_${cardIndex}`));
      cardIndex += 1;
    }
  }

  // Shuffle the cards using Fisher-Yates algorithm
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}
