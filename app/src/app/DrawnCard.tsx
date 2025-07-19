'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room } from 'colyseus.js';
import { useState, useEffect } from 'react';

interface DrawnCardProps {
  player: Player | null;
  room: Room | undefined;
}

export default function DrawnCard({ player, room }: DrawnCardProps) {
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [isNewCard, setIsNewCard] = useState(false);
  const [lastCardId, setLastCardId] = useState<string | null>(null);

  useEffect(() => {
    console.log('DrawnCard useEffect triggered, player:', player);
    if (player) {
      console.log('Player drawnCards length:', player.drawnCards.length);
      console.log('Player drawnCards:', player.drawnCards);
      if (player.drawnCards.length > 0) {
        // Get the most recently drawn card (last in array)
        const card = player.drawnCards[player.drawnCards.length - 1];
        console.log('Setting drawn card:', card);

        // Check if this is a new card being drawn (different ID from last tracked)
        const isNewCardDrawn = lastCardId !== card.id;
        if (isNewCardDrawn) {
          console.log('New card detected, triggering animation');
          setIsNewCard(true);
          setLastCardId(card.id);
          setTimeout(() => setIsNewCard(false), 500); // Match animation duration
        }

        setDrawnCard(card);
      } else {
        console.log('No drawn cards, setting to null');
        setDrawnCard(null);
        setLastCardId(null);
      }
    } else {
      console.log('No player, setting drawn card to null');
      setDrawnCard(null);
      setLastCardId(null);
    }
  }, [player, lastCardId]);

  const handleCardClick = () => {
    if (room && drawnCard && !drawnCard.isActive) {
      room.send('playCard', { cardId: drawnCard.id });
    }
  };

  if (!player || !drawnCard) {
    return (
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-lg font-semibold text-white">Drawn Card</h3>
        <div className="w-20 h-28 bg-gray-700 border-2 border-gray-600 rounded-lg flex items-center justify-center">
          <p className="text-gray-400 text-xs text-center">No card drawn</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-lg font-semibold text-white">Drawn Card</h3>

      {/* Drawn Card */}
      <div
        className={`
          card-drawn relative w-20 h-28 bg-white border-2 rounded-lg card-hover
          ${isNewCard ? 'card-draw' : ''}
          ${drawnCard.isActive
            ? 'border-yellow-400 bg-yellow-100 shadow-lg shadow-yellow-400/50 cursor-not-allowed'
            : 'border-gray-300 cursor-pointer hover:border-blue-400'
          }
        `}
        onClick={handleCardClick}
      >
        {/* Card content */}
        <div className="absolute inset-2 flex flex-col justify-between text-black">
          {/* Card description in middle */}
          <div className="text-xs text-center leading-tight px-1">
            {drawnCard.description}
          </div>
        </div>

        {/* Active state indicator */}
        {drawnCard.isActive && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            ⚡
          </div>
        )}
      </div>

      {/* Card status text */}
      <div className="text-center text-sm text-gray-300">
        {drawnCard.isActive ? (
          <p className="text-yellow-400">Card Active</p>
        ) : (
          <p className="text-blue-400">Click to play</p>
        )}
      </div>
    </div>
  );
}