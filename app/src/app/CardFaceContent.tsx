'use client';

import CardFaceText from './CardFaceText';

const DOUBLE_SWEEP_CARD_TYPE = 'cross_two_horizontal_then_two_horizontal';

type CardFaceContentProps = {
  type: string;
  description: string;
  defenseSymbol?: string;
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

export default function CardFaceContent({ type, description, defenseSymbol = 'empty' }: CardFaceContentProps) {
  const isDoubleSweep = type === DOUBLE_SWEEP_CARD_TYPE;
  const defenseIcon = defenseSymbol === 'block' ? '🛡️' : defenseSymbol === 'counter' ? '⚔️' : '○';
  const defenseLabel = defenseSymbol === 'block'
    ? 'Block'
    : defenseSymbol === 'counter'
      ? 'Counter Attack'
      : 'Empty';

  return (
    <div className="absolute inset-0 rounded-lg overflow-hidden">
      <div className="h-5 bg-gray-200 border-b border-gray-300 flex items-center justify-center">
        <span className="text-[10px] font-bold tracking-tight text-black leading-none">Heroic</span>
      </div>
      <div className="h-[calc(100%-1.25rem)]">
        {isDoubleSweep ? (
          <HeroicDoubleSweepVisual />
        ) : (
          <CardFaceText text={description} className="text-black" maxFontPx={11} minFontPx={7} />
        )}
      </div>
      <div
        className="absolute bottom-1 right-1 h-5 w-5 rounded-full border border-gray-400 bg-white/95 flex items-center justify-center text-[10px] leading-none"
        title={defenseLabel}
      >
        {defenseIcon}
      </div>
    </div>
  );
}
