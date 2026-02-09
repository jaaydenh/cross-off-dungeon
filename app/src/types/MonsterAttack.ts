export type CardDefenseSymbol = 'empty' | 'block' | 'counter';

export type MonsterAttackOutcome =
  | 'discarded'
  | 'returned_to_deck'
  | 'counter_attack'
  | 'no_card_available';

export type MonsterAttackCardSnapshot = {
  id: string;
  type: string;
  description: string;
  defenseSymbol: CardDefenseSymbol;
};

export type MonsterAttackAnimation = {
  id: string;
  monsterId: string;
  attackNumber: number;
  monsterAttack: number;
  outcome: MonsterAttackOutcome;
  card?: MonsterAttackCardSnapshot;
  counterSquare?: { x: number; y: number } | null;
};
