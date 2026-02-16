'use client';

import { useEffect } from 'react';
import CardFaceContent from './CardFaceContent';
import { CARD_LIBRARY_ENTRIES } from './cardLibraryData';

type CardLibraryScreenProps = {
  isOpen: boolean;
  debugMode: boolean;
  onToggleDebugMode: () => void;
  onClose: () => void;
};

const formatLabel = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatSelectionCount = (minSelections: number, maxSelections: number): string => {
  if (maxSelections <= 0) {
    return `${minSelections}+`;
  }
  if (minSelections === maxSelections) {
    return `${minSelections}`;
  }
  return `${minSelections}-${maxSelections}`;
};

export default function CardLibraryScreen({
  isOpen,
  debugMode,
  onToggleDebugMode,
  onClose
}: CardLibraryScreenProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[220] bg-slate-950/95 text-slate-100">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
          <div>
            <h2 className="text-2xl font-bold">Card Library</h2>
            <p className="text-sm text-slate-300">All cards currently available in Cross-Off Dungeon.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Debug Mode</div>
              <p className="text-xs text-slate-300">
                Enables debug monster controls (instant complete).
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleDebugMode}
              className={`rounded px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                debugMode
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              }`}
            >
              {debugMode ? 'Disable Debug' : 'Enable Debug'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-6 pr-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {CARD_LIBRARY_ENTRIES.map((card) => (
              <article key={card.type} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <div className="flex justify-center">
                  <div className="relative h-[176px] w-[121px] rounded-lg border-2 border-slate-300 bg-white shadow-lg">
                    <CardFaceContent
                      type={card.type}
                      name={card.name}
                      description={card.description}
                      defenseSymbol={card.defenseSymbol}
                      color={card.color}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-300 [overflow-wrap:anywhere]">
                  <div>
                    <span className="font-semibold text-slate-100">Type:</span>{' '}
                    <span className="font-mono break-all">{card.type}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Targets:</span>{' '}
                    <span className="break-words">{formatLabel(card.selectionTarget)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Pattern:</span>{' '}
                    <span className="break-words">{formatLabel(card.selectionMode)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-100">Selections:</span>{' '}
                    {formatSelectionCount(card.minSelections, card.maxSelections)}
                  </div>
                  {card.drawCardsOnResolve ? (
                    <div>
                      <span className="font-semibold text-slate-100">Extra:</span> Draw {card.drawCardsOnResolve}{' '}
                      card{card.drawCardsOnResolve > 1 ? 's' : ''}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
