'use client';

import CardFaceText from './CardFaceText';

const DOUBLE_SWEEP_CARD_TYPE = 'cross_two_horizontal_then_two_horizontal';

type CardFaceContentProps = {
  type: string;
  description: string;
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

export default function CardFaceContent({ type, description }: CardFaceContentProps) {
  const isDoubleSweep = type === DOUBLE_SWEEP_CARD_TYPE;

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
    </div>
  );
}

