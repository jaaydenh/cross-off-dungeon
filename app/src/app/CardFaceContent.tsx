'use client';

import CardFaceText from './CardFaceText';

const DOUBLE_SWEEP_CARD_TYPE = 'cross_two_horizontal_then_two_horizontal';
const COMBAT_CARD_TYPE = 'combat_fight_three_diagonal_or_move_three';
const SWIPE_CARD_TYPE = 'swipe_fight_l_overlay';
const CUNNING_CARD_TYPE = 'cunning';
const SPREAD_OUT_CARD_TYPE = 'spread_out_room_overlay';
const MAGIC_CARD_TYPE = 'magic';
const QUICK_STEP_CARD_TYPE = 'quick_step';
const REPOSITION_CARD_TYPE = 'reposition';
const HORIZONTAL_SWEEP_CARD_TYPE = 'cross_row_room';
const EXPLORE_CARD_TYPE = 'explore';
const INSPIRATION_CARD_TYPE = 'inspiration';

type CardFaceContentProps = {
  type: string;
  name?: string;
  description: string;
  defenseSymbol?: string;
  color?: string;
};

function HeroicDoubleSweepVisual() {
  const blockClass =
    'h-4 w-5 border border-gray-500 bg-gray-300/90 sm:h-5 sm:w-6';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black">
      <div className="flex">
        <div className={blockClass} />
        <div className={blockClass} />
      </div>
      <div className="text-[10px] font-semibold leading-none">then</div>
      <div className="flex">
        <div className={blockClass} />
        <div className={blockClass} />
      </div>
    </div>
  );
}

function MagicVisual() {
  const blockClass = 'h-5 w-5 border border-blue-700 bg-blue-300/85';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-2 text-black">
      <div className="flex items-center justify-center gap-3">
        <div className={blockClass} />
        <div className={blockClass} />
        <div className={blockClass} />
      </div>
      <div className="text-center text-[8px] italic leading-tight text-gray-700">
        On one room or monster card,
      </div>
      <div className="text-center text-[8px] italic leading-tight text-gray-700">
        cross up to 3 non-adjacent squares.
      </div>
      <div className="text-center text-[8px] font-semibold leading-tight text-blue-800">
        Counter x2 on monster attacks
      </div>
    </div>
  );
}

function CombatBlastVisual() {
  const cellClass = 'h-5 w-5 border border-dashed border-rose-400 bg-rose-200/70';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black">
      <div className="text-sm font-semibold leading-none">Fight</div>
      <div className="grid grid-cols-3 gap-0">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const isCenter = row === 1 && col === 1;
            return (
              <div
                key={`combat-cell-${row}-${col}`}
                className={`${cellClass} ${isCenter ? 'bg-red-500/70 border-red-500' : ''}`}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function SwipeVisual() {
  const baseCell = 'h-5 w-5';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black">
      <div className="text-sm font-semibold leading-none">Fight</div>
      <div className="grid grid-cols-3 gap-0">
        <div className={`${baseCell} border border-red-500 bg-red-500/70`} />
        <div className={`${baseCell} border border-red-500 bg-red-500/70`} />
        <div className={`${baseCell} border border-dashed border-rose-400 bg-rose-300/55`} />

        <div className={`${baseCell} border border-red-500 bg-red-500/70`} />
        <div className={baseCell} />
        <div className={baseCell} />

        <div className={`${baseCell} border border-dashed border-rose-400 bg-rose-300/55`} />
        <div className={baseCell} />
        <div className={baseCell} />
      </div>
    </div>
  );
}

function CunningVisual() {
  const blockClass = 'h-5 w-5 border border-green-700 bg-green-400/80';

  return (
    <div className="h-full w-full flex flex-col items-center justify-between px-2 py-2 text-black">
      <div className="flex flex-col items-center gap-1">
        <div className={blockClass} />
        <div className="text-[10px] font-semibold leading-none">then</div>
        <div className="flex">
          <div className={blockClass} />
          <div className={blockClass} />
        </div>
        <div className="text-[10px] font-semibold leading-none">then</div>
        <div className="flex">
          <div className={blockClass} />
          <div className={blockClass} />
          <div className={blockClass} />
        </div>
      </div>
      <div className="text-center text-[8px] italic leading-tight text-gray-700">
        Each step must be on a different card
      </div>
    </div>
  );
}

function SpreadOutVisual() {
  const cellClass = 'h-5 w-5 border border-dashed border-green-500 bg-green-200/60';

  return (
    <div className="h-full w-full flex flex-col items-center justify-between px-2 py-2 text-black">
      <div className="grid grid-cols-3 gap-0 mt-1">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const isCenter = row === 1 && col === 1;
            return (
              <div
                key={`spread-out-cell-${row}-${col}`}
                className={`${cellClass} ${isCenter ? 'bg-green-500/75 border-green-600' : ''}`}
              />
            );
          })
        )}
      </div>
      <div className="text-center text-[8px] italic leading-tight text-gray-700">
        Center required. Adjacent squares optional.
      </div>
    </div>
  );
}

function QuickStepVisual() {
  const cellClass = 'h-5 w-5 border border-green-700 bg-green-400/80';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black">
      <div className="rounded-full border border-gray-500 bg-white px-3 py-0.5 text-[10px] font-semibold leading-none">
        Move
      </div>
      <div className={cellClass} />
      <div className="text-[10px] font-semibold leading-none italic">then</div>
      <div className="flex h-7 w-5 items-center justify-center rounded border border-gray-500 bg-gray-300 text-base leading-none text-gray-700">
        +
      </div>
    </div>
  );
}

function RepositionVisual() {
  const cellClass = 'h-4 w-4 border border-gray-500 bg-white';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black">
      <div className="rounded-full border border-gray-500 bg-white px-3 py-0.5 text-[10px] font-semibold leading-none">
        Move
      </div>
      <div className="flex items-center">
        <div className={cellClass} />
        <div className="h-[2px] w-4 bg-gray-500" />
        <div className={cellClass} />
      </div>
      <div className="text-[10px] font-semibold leading-none italic">then</div>
      <div className="flex h-7 w-5 items-center justify-center rounded border border-gray-500 bg-gray-300 text-base leading-none text-gray-700">
        +
      </div>
    </div>
  );
}

function HorizontalSweepVisual({ description }: { description: string }) {
  const squareClass = 'h-4 w-5 border border-gray-500 bg-gray-300/90 sm:h-5 sm:w-6';

  return (
    <div className="h-full w-full flex flex-col text-black">
      <div className="flex items-center justify-center gap-1 pt-2">
        <span className="text-sm font-semibold leading-none text-gray-700">←</span>
        <div className="flex items-center">
          <div className={squareClass} />
          <div className={`${squareClass} -ml-px`} />
          <div className={`${squareClass} -ml-px`} />
        </div>
        <span className="text-sm font-semibold leading-none text-gray-700">→</span>
      </div>
      <div className="min-h-0 flex-1">
        <CardFaceText text={description} className="text-black" maxFontPx={11} minFontPx={7} />
      </div>
    </div>
  );
}

function ExploreVisual() {
  const squareClass = 'h-3 w-3 border border-dotted border-green-700 bg-green-400/85';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-black px-2">
      <div className="rounded-full border border-gray-500 bg-white px-3 py-0.5 text-[10px] font-semibold leading-none">
        Move
      </div>
      <div className="flex aspect-square w-14 items-center justify-center rounded-full border-2 border-gray-600 bg-green-300 text-2xl font-bold leading-none text-gray-700">
        5
      </div>
      <div className="text-[8px] font-medium leading-none text-gray-700">connected</div>
      <div className="grid grid-cols-3 gap-0">
        <div />
        <div className={squareClass} />
        <div />
        <div className={squareClass} />
        <div className={squareClass} />
        <div className={squareClass} />
        <div className={squareClass} />
        <div />
        <div />
      </div>
    </div>
  );
}

function InspirationVisual() {
  const squareClass = 'h-5 w-5 border border-green-700 bg-green-300/80';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-2 text-black">
      <div className="text-[9px] font-semibold leading-none">Pick a player</div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-green-700 bg-green-200 text-sm font-black leading-none text-green-900">
        x2
      </div>
      <div className="text-[9px] italic leading-none">then</div>
      <div className={squareClass} />
      <div className="text-[8px] text-center leading-tight text-gray-700">
        Cross 1 square on any room or monster card.
      </div>
    </div>
  );
}

const getCardColorTheme = (color: string): {
  fallbackTitle: string;
  headerClasses: string;
} => {
  switch (color) {
    case 'red':
      return {
        fallbackTitle: 'Red',
        headerClasses: 'bg-red-600 border-red-700 text-white'
      };
    case 'blue':
      return {
        fallbackTitle: 'Blue',
        headerClasses: 'bg-blue-600 border-blue-700 text-white'
      };
    case 'green':
      return {
        fallbackTitle: 'Green',
        headerClasses: 'bg-green-600 border-green-700 text-white'
      };
    default:
      return {
        fallbackTitle: 'Heroic',
        headerClasses: 'bg-gray-300 border-gray-400 text-black'
      };
  }
};

export default function CardFaceContent({
  type,
  name = '',
  description,
  defenseSymbol = 'empty',
  color = 'clear'
}: CardFaceContentProps) {
  const isDoubleSweep = type === DOUBLE_SWEEP_CARD_TYPE;
  const isCombatBlast = type === COMBAT_CARD_TYPE;
  const isSwipe = type === SWIPE_CARD_TYPE;
  const isCunning = type === CUNNING_CARD_TYPE;
  const isSpreadOut = type === SPREAD_OUT_CARD_TYPE;
  const isMagic = type === MAGIC_CARD_TYPE;
  const isQuickStep = type === QUICK_STEP_CARD_TYPE;
  const isReposition = type === REPOSITION_CARD_TYPE;
  const isHorizontalSweep = type === HORIZONTAL_SWEEP_CARD_TYPE;
  const isExplore = type === EXPLORE_CARD_TYPE;
  const isInspiration = type === INSPIRATION_CARD_TYPE;
  const hasDefenseAbility =
    defenseSymbol === 'block' || defenseSymbol === 'counter' || defenseSymbol === 'dodge';
  const defenseIcon =
    defenseSymbol === 'block' ? '🛡️' : defenseSymbol === 'counter' ? '⚔️' : '💨';
  const defenseLabel = defenseSymbol === 'block'
    ? 'Block'
    : defenseSymbol === 'counter'
      ? (isMagic ? 'Counter Attack x2' : 'Counter Attack')
      : 'Dodge';
  const theme = getCardColorTheme(color);
  const titleText = (name || '').trim().length > 0 ? name : theme.fallbackTitle;

  return (
    <div className="absolute inset-0 rounded-lg overflow-hidden">
      <div className={`h-6 border-b flex items-center justify-center px-1 ${theme.headerClasses}`}>
        <span className="text-[10px] font-bold tracking-tight leading-none text-center">{titleText}</span>
      </div>
      <div className="h-[calc(100%-1.5rem)]">
        {isDoubleSweep ? (
          <HeroicDoubleSweepVisual />
        ) : isCombatBlast ? (
          <CombatBlastVisual />
        ) : isSwipe ? (
          <SwipeVisual />
        ) : isCunning ? (
          <CunningVisual />
        ) : isSpreadOut ? (
          <SpreadOutVisual />
        ) : isMagic ? (
          <MagicVisual />
        ) : isHorizontalSweep ? (
          <HorizontalSweepVisual description={description} />
        ) : isExplore ? (
          <ExploreVisual />
        ) : isInspiration ? (
          <InspirationVisual />
        ) : isReposition ? (
          <RepositionVisual />
        ) : isQuickStep ? (
          <QuickStepVisual />
        ) : (
          <CardFaceText text={description} className="text-black" maxFontPx={11} minFontPx={7} />
        )}
      </div>
      {hasDefenseAbility && (
        <div
          className="absolute bottom-1 right-1 h-5 w-5 rounded-full border border-gray-400 bg-white/95 flex items-center justify-center text-[10px] leading-none"
          title={defenseLabel}
        >
          {defenseIcon}
        </div>
      )}
    </div>
  );
}
