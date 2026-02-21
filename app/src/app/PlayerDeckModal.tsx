'use client';

import { useEffect } from 'react';
import { Card } from '@/types/Card';
import { Player } from '@/types/Player';
import CardFaceContent from './CardFaceContent';

type CardZone = 'active' | 'drawn' | 'deck' | 'discarded';

interface PlayerDeckModalProps {
  isOpen: boolean;
  player: Player | null;
  onClose: () => void;
}

interface DeckCardEntry {
  card: Card;
  zone: CardZone;
}

const zoneLabelMap: Record<CardZone, string> = {
  active: 'Active',
  drawn: 'Drawn',
  deck: 'Deck',
  discarded: 'Discarded'
};

const zoneBadgeClassMap: Record<CardZone, string> = {
  active: 'border-yellow-300 bg-yellow-500/20 text-yellow-100',
  drawn: 'border-sky-300 bg-sky-500/20 text-sky-100',
  deck: 'border-indigo-300 bg-indigo-500/20 text-indigo-100',
  discarded: 'border-emerald-300 bg-emerald-500/20 text-emerald-100'
};

export default function PlayerDeckModal({ isOpen, player, onClose }: PlayerDeckModalProps) {
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const activeCards = player
    ? Array.from(player.drawnCards)
        .filter((card) => card.isActive)
        .map((card) => ({ card, zone: 'active' as const }))
    : [];
  const drawnCards = player
    ? Array.from(player.drawnCards)
        .filter((card) => !card.isActive)
        .map((card) => ({ card, zone: 'drawn' as const }))
    : [];
  const deckCards = player
    ? Array.from(player.deck).map((card) => ({ card, zone: 'deck' as const }))
    : [];
  const discardedCards = player
    ? Array.from(player.discardPile).map((card) => ({ card, zone: 'discarded' as const }))
    : [];

  const allCards: DeckCardEntry[] = [...activeCards, ...drawnCards, ...deckCards, ...discardedCards];
  const totalCards = allCards.length;

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div
        className="flex h-full max-h-[92vh] w-full max-w-7xl flex-col rounded-xl border border-slate-600 bg-slate-900 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-xl font-bold">Your Full Deck</h2>
            <p className="text-xs text-slate-300">
              Total: {totalCards} | Active: {activeCards.length} | Drawn: {drawnCards.length} | Deck: {deckCards.length} | Discarded: {discardedCards.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {totalCards === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
              No cards found for this player.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {allCards.map(({ card, zone }, index) => (
                <article key={`${zone}-${card.id}-${index}`} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div className="mb-2">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${zoneBadgeClassMap[zone]}`}
                    >
                      {zoneLabelMap[zone]}
                    </span>
                  </div>

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
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
