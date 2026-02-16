export type CardDefenseSymbol = 'empty' | 'block' | 'counter' | 'dodge';

export type MonsterAttackOutcome =
  | 'discarded'
  | 'returned_to_deck'
  | 'counter_attack'
  | 'no_card_available';

export type MonsterAttackCardSnapshot = {
  id: string;
  type: string;
  name: string;
  description: string;
  defenseSymbol: CardDefenseSymbol;
  color: 'clear' | 'red' | 'blue' | 'green';
};

export type MonsterAttackMotionPath = {
  anchorX: number;
  anchorY: number;
  stackOrder: number;
  fromDx: number;
  fromDy: number;
  midDx: number;
  midDy: number;
  startScale: number;
  midScale: number;
  endScale: number;
  startScaleX?: number;
  startScaleY?: number;
  midScaleX?: number;
  midScaleY?: number;
  endScaleX?: number;
  endScaleY?: number;
};

export type MonsterAttackAnimation = {
  id: string;
  monsterId: string;
  attackNumber: number;
  monsterAttack: number;
  outcome: MonsterAttackOutcome;
  card?: MonsterAttackCardSnapshot;
  counterSquare?: { x: number; y: number } | null;
  motionPath?: MonsterAttackMotionPath;
};
