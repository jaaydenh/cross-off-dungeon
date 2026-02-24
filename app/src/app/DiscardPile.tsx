'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room } from '@colyseus/sdk';
import { useState, type DragEvent } from 'react';
import CardFaceContent from './CardFaceContent';

interface DiscardPileProps {
  player: Player | null;
  room: Room | undefined;
  onDiscardDrop?: () => void;
  hiddenTopCardIds?: Set<string>;
}

export default function DiscardPile({ player, room, onDiscardDrop, hiddenTopCardIds }: DiscardPileProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const cardTitle = (card: Card): string => {
    const name = (card.name || '').trim() || 'Heroic';
    return `${name}: ${card.description}`;
  };

  if (!player) {
    return (
      <div className="text-center text-gray-400">
        <p>Loading discard...</p>
      </div>
    );
  }

  const discardCount = player.discardPile.length;
  const topCard = discardCount > 0 ? player.discardPile[discardCount - 1] : null;
  const hasActiveCard = player.drawnCards.some((card) => card.isActive);
  const isTopCardHidden = !!topCard?.id && !!hiddenTopCardIds?.has(topCard.id);
  const previousTopCard =
    player.discardPile.length > 1 ? player.discardPile[player.discardPile.length - 2] : null;
  const visibleTopCard = isTopCardHidden ? previousTopCard : topCard;
  const visibleDiscardCount = isTopCardHidden ? Math.max(0, discardCount - 1) : discardCount;

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasActiveCard) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (!room || !hasActiveCard) {
      return;
    }

    try {
      const data = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
      if (data.type === 'active_card_discard') {
        room.send('discardCardAction', {});
        onDiscardDrop?.();
      }
    } catch (error) {
      console.error('Error handling discard drop:', error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-md font-semibold text-white">Discard</h3>

      {/* Discard Pile */}
      <div
        className={`
          card-discard relative w-[121px] h-[176px] border-2 rounded-lg transition-all duration-200
          ${visibleDiscardCount === 0
            ? 'bg-gray-700 border-gray-600 opacity-50'
            : 'bg-white border-gray-300 card-zoom'
          }
          ${isDragOver ? 'ring-2 ring-amber-400 border-amber-400' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={visibleTopCard ? cardTitle(visibleTopCard) : undefined}
        data-player-discard-card="true"
      >
        {visibleTopCard ? (
          <>
            {/* Face-up card content */}
            <CardFaceContent
              type={visibleTopCard.type}
              name={visibleTopCard.name}
              description={visibleTopCard.description}
              defenseSymbol={visibleTopCard.defenseSymbol}
              color={visibleTopCard.color}
            />

            {/* Card count badge */}
            {visibleDiscardCount > 1 && (
              <div className="card-count-badge absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {visibleDiscardCount}
              </div>
            )}
          </>
        ) : (
          /* Empty discard pile */
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-500 text-xs text-center">
              Empty
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
