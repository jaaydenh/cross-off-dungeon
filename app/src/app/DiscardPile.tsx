'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room, getStateCallbacks } from '@colyseus/sdk';
import { useState, useEffect } from 'react';
import CardFaceContent from './CardFaceContent';

interface DiscardPileProps {
  player: Player | null;
  room: Room | undefined;
  onDiscardDrop?: () => void;
}

export default function DiscardPile({ player, room, onDiscardDrop }: DiscardPileProps) {
  const [discardCount, setDiscardCount] = useState(0);
  const [topCard, setTopCard] = useState<Card | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const cardTitle = (card: Card): string => {
    const name = (card.name || '').trim() || 'Heroic';
    return `${name}: ${card.description}`;
  };

  useEffect(() => {
    if (player) {
      console.log("SetDiscardPile - Initial setup")

      // Update initial state
      setDiscardCount(player.discardPile.length);
      if (player.discardPile.length > 0) {
        setTopCard(player.discardPile[player.discardPile.length - 1]);
      } else {
        setTopCard(null);
      }

      if (!room) {
        return;
      }

      const $ = getStateCallbacks(room);

      // Listen for changes to the discard pile
      const onDiscardPileAdd = (card: Card, index: number) => {
        console.log("Card added to discard pile:", card, "at index:", index);
        setDiscardCount(player.discardPile.length);
        setTopCard(player.discardPile[player.discardPile.length - 1]);
      };

      const onDiscardPileRemove = (card: Card, index: number) => {
        console.log("Card removed from discard pile:", card, "at index:", index);
        setDiscardCount(player.discardPile.length);
        if (player.discardPile.length > 0) {
          setTopCard(player.discardPile[player.discardPile.length - 1]);
        } else {
          setTopCard(null);
        }
      };

      // Set up listeners - these return cleanup functions
      const removeAddListener = $(player).discardPile.onAdd(onDiscardPileAdd);
      const removeRemoveListener = $(player).discardPile.onRemove(onDiscardPileRemove);

      // Cleanup function to remove listeners
      return () => {
        removeAddListener();
        removeRemoveListener();
      };
    }
  }, [player, room]);

  if (!player) {
    return (
      <div className="text-center text-gray-400">
        <p>Loading discard...</p>
      </div>
    );
  }

  const hasActiveCard = player.drawnCards.some((card) => card.isActive);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasActiveCard) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
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
          ${discardCount === 0
            ? 'bg-gray-700 border-gray-600 opacity-50'
            : 'bg-white border-gray-300 card-zoom'
          }
          ${isDragOver ? 'ring-2 ring-amber-400 border-amber-400' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={topCard ? cardTitle(topCard) : undefined}
      >
        {topCard ? (
          <>
            {/* Face-up card content */}
            <CardFaceContent
              type={topCard.type}
              name={topCard.name}
              description={topCard.description}
              defenseSymbol={topCard.defenseSymbol}
              color={topCard.color}
            />

            {/* Card count badge */}
            {discardCount > 1 && (
              <div className="card-count-badge absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {discardCount}
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
