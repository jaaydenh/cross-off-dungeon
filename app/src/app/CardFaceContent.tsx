'use client';

import CardFaceText from './CardFaceText';

const DOUBLE_SWEEP_CARD_TYPE = 'cross_two_horizontal_then_two_horizontal';

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
  const hasDefenseAbility = defenseSymbol === 'block' || defenseSymbol === 'counter';
  const defenseIcon = defenseSymbol === 'block' ? '🛡️' : '⚔️';
  const defenseLabel = defenseSymbol === 'block' ? 'Block' : 'Counter Attack';
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
