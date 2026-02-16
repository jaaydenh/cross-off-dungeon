export type CardLibraryEntry = {
  type: string;
  name: string;
  description: string;
  color: 'clear' | 'red' | 'blue' | 'green';
  defenseSymbol: 'empty' | 'block' | 'counter';
  selectionTarget: 'room' | 'monster' | 'room_or_monster' | 'monster_each';
  selectionMode:
    | 'squares'
    | 'row'
    | 'horizontal_pair_twice'
    | 'cunning_three_step_different_cards'
    | 'centered_room_3x3'
    | 'centered_monster_3x3'
    | 'monster_swipe_l';
  minSelections: number;
  maxSelections: number;
  requiresConnected: boolean;
  drawCardsOnResolve?: number;
};

export const CARD_LIBRARY_ENTRIES: CardLibraryEntry[] = [
  {
    type: 'cross_connected_squares',
    name: 'Connected Cross',
    description: 'Cross off up to 3 connected squares',
    color: 'clear',
    defenseSymbol: 'empty',
    selectionTarget: 'room',
    selectionMode: 'squares',
    minSelections: 1,
    maxSelections: 3,
    requiresConnected: true
  },
  {
    type: 'cross_any_two_room_or_monster',
    name: 'Any Two',
    description: 'Cross off up to 2 squares on a single room or monster',
    color: 'clear',
    defenseSymbol: 'block',
    selectionTarget: 'room_or_monster',
    selectionMode: 'squares',
    minSelections: 1,
    maxSelections: 2,
    requiresConnected: false
  },
  {
    type: 'cross_two_connected_each_monster',
    name: 'Every Monster',
    description: 'Cross off 2 connected squares on every monster',
    color: 'clear',
    defenseSymbol: 'counter',
    selectionTarget: 'monster_each',
    selectionMode: 'squares',
    minSelections: 2,
    maxSelections: 2,
    requiresConnected: true
  },
  {
    type: 'cross_row_room',
    name: 'Horizontal Sweep',
    description: 'Cross off all horizontal squares on a single room',
    color: 'clear',
    defenseSymbol: 'empty',
    selectionTarget: 'room',
    selectionMode: 'row',
    minSelections: 1,
    maxSelections: 0,
    requiresConnected: false
  },
  {
    type: 'cross_two_horizontal_then_two_horizontal',
    name: 'Heroic Double Sweep',
    description: 'Cross off 2 horizontal squares, then 2 more horizontal squares',
    color: 'clear',
    defenseSymbol: 'counter',
    selectionTarget: 'room_or_monster',
    selectionMode: 'horizontal_pair_twice',
    minSelections: 4,
    maxSelections: 4,
    requiresConnected: false
  },
  {
    type: 'cunning',
    name: 'Cunning',
    description:
      'Cross 1 square, then 2 horizontal squares, then 3 horizontal squares. Each step must target a different room or monster.',
    color: 'green',
    defenseSymbol: 'empty',
    selectionTarget: 'room_or_monster',
    selectionMode: 'cunning_three_step_different_cards',
    minSelections: 6,
    maxSelections: 6,
    requiresConnected: false
  },
  {
    type: 'heroic_move_two_and_fight_two',
    name: 'Heroic Move and Fight',
    description: 'Move 2 and fight 2',
    color: 'clear',
    defenseSymbol: 'counter',
    selectionTarget: 'room_or_monster',
    selectionMode: 'squares',
    minSelections: 4,
    maxSelections: 4,
    requiresConnected: true
  },
  {
    type: 'spread_out_room_overlay',
    name: 'Spread Out',
    description: 'Choose any square in a room. Cross off that square. You may cross off any adjacent squares.',
    color: 'green',
    defenseSymbol: 'empty',
    selectionTarget: 'room',
    selectionMode: 'centered_room_3x3',
    minSelections: 1,
    maxSelections: 9,
    requiresConnected: false
  },
  {
    type: 'combat_fight_three_diagonal_or_move_three',
    name: 'Combat',
    description: 'Fight',
    color: 'red',
    defenseSymbol: 'counter',
    selectionTarget: 'monster',
    selectionMode: 'centered_monster_3x3',
    minSelections: 1,
    maxSelections: 1,
    requiresConnected: false
  },
  {
    type: 'swipe_fight_l_overlay',
    name: 'Swipe',
    description: 'Fight',
    color: 'red',
    defenseSymbol: 'empty',
    selectionTarget: 'monster',
    selectionMode: 'monster_swipe_l',
    minSelections: 1,
    maxSelections: 1,
    requiresConnected: false
  },
  {
    type: 'reposition',
    name: 'Reposition',
    description: 'Move 2 then draw another card',
    color: 'clear',
    defenseSymbol: 'empty',
    selectionTarget: 'room',
    selectionMode: 'squares',
    minSelections: 2,
    maxSelections: 2,
    requiresConnected: true,
    drawCardsOnResolve: 1
  }
];
