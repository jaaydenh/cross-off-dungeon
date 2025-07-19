'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room } from 'colyseus.js';
import { useState, useEffect } from 'react';

interface DiscardPileProps {
  player: Player | null;
  room: Room | undefined;
}

export default function DiscardPile({ player, room }: DiscardPileProps) {
  const [discardCount, setDiscardCount] = useState(0);
  const [topCard, setTopCard] = useState<Card | null>(null);
  const componentId = useState(() => Math.random().toString(36).substr(2, 5))[0];

  useEffect(() => {
    if (player) {
      // Update discard pile count
      setDiscardCount(player.discardPile.length);

      // Get the top card (most recently discarded)
      if (player.discardPile.length > 0) {
        setTopCard(player.discardPile[player.discardPile.length - 1]);
      } else {
        setTopCard(null);
      }
    }
  }, [player]);

  if (!player) {
    return (
      <div className="text-center text-gray-400">
        <p>Loading discard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-lg font-semibold text-white">Discard ({componentId})</h3>

      {/* Discard Pile */}
      <div
        className={`
          card-discard relative w-20 h-28 border-2 rounded-lg transition-all duration-200
          ${discardCount === 0
            ? 'bg-gray-700 border-gray-600 opacity-50'
            : 'bg-white border-gray-300 card-hover'
          }
        `}
      >
        {topCard ? (
          <>
            {/* Face-up card content */}
            <div className="absolute inset-2 flex flex-col justify-between text-black">
              {/* Card type at top */}
              <div className="text-xs font-bold text-center text-blue-800">
                {topCard.type.replace('_', ' ').toUpperCase()}
              </div>

              {/* Card description in middle */}
              <div className="text-xs text-center leading-tight px-1">
                {topCard.description}
              </div>

              {/* Card ID at bottom */}
              <div className="text-xs text-gray-500 text-center">
                #{topCard.id.slice(-3)}
              </div>
            </div>

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

      {/* Discard pile status text */}
      <div className="text-center text-sm text-gray-300">
        {discardCount > 0 ? (
          <p>{discardCount} card{discardCount !== 1 ? 's' : ''} discarded</p>
        ) : (
          <p>No cards discarded</p>
        )}
      </div>
    </div>
  );
}