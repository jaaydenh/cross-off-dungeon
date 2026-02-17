'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room } from '@colyseus/sdk';
import { useState, useEffect } from 'react';
import CardFaceContent from './CardFaceContent';

interface DrawnCardProps {
  player: Player | null;
  room: Room | undefined;
  showExtraUseBadge?: boolean;
}

export default function DrawnCard({
  player,
  room,
  showExtraUseBadge = false
}: DrawnCardProps) {
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [isNewCard, setIsNewCard] = useState(false);
  const [lastCardId, setLastCardId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (player) {
      if (player.drawnCards.length > 0) {
        // Get the most recently drawn card (last in array)
        const card = player.drawnCards[player.drawnCards.length - 1];

        // Check if this is a new card being drawn (different ID from last tracked)
        const isNewCardDrawn = lastCardId !== card.id;
        if (isNewCardDrawn) {
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
    if (isDragging) {
      return;
    }

    if (room && drawnCard && !drawnCard.isActive) {
      room.send('playCard', { cardId: drawnCard.id });
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!drawnCard?.isActive) {
      event.preventDefault();
      return;
    }

    setIsDragging(true);
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'active_card_discard',
        cardId: drawnCard.id
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const cardTitle = (card: Card): string => {
    const name = (card.name || '').trim() || 'Heroic';
    return `${name}: ${card.description}`;
  };

  if (!player || !drawnCard) {
    return (
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-md font-semibold text-white flex items-center gap-2">
          <span>Active Card</span>
          {showExtraUseBadge ? (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-500/30 px-1 text-[10px] font-black text-emerald-100"
              title="Your next active card returns to be played again"
            >
              x2
            </span>
          ) : null}
        </h3>
        <div className="w-[121px] h-[176px] bg-gray-700 border-2 border-gray-600 rounded-lg flex items-center justify-center">
          <p className="text-gray-400 text-xs text-center">No card drawn</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-md font-semibold text-white flex items-center gap-2">
        <span>Active Card</span>
        {showExtraUseBadge ? (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-500/30 px-1 text-[10px] font-black text-emerald-100"
            title="Your next active card returns to be played again"
          >
            x2
          </span>
        ) : null}
      </h3>

      {/* Drawn Card */}
      <div
        className={`
          relative w-[121px] h-[176px] bg-white border-2 rounded-lg card-zoom
          ${drawnCard.isActive
            ? 'border-yellow-400 bg-yellow-100 shadow-lg shadow-yellow-400/50 cursor-grab active:cursor-grabbing'
            : 'border-gray-300 cursor-pointer hover:border-blue-400'
          }
          ${isDragging ? 'opacity-75 scale-95' : ''}
        `}
        onClick={handleCardClick}
        draggable={drawnCard.isActive}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title={cardTitle(drawnCard)}
      >
        {/* Card content */}
        <CardFaceContent
          type={drawnCard.type}
          name={drawnCard.name}
          description={drawnCard.description}
          defenseSymbol={drawnCard.defenseSymbol}
          color={drawnCard.color}
        />

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
          <p className="text-yellow-400">Card Active (drag to discard)</p>
        ) : (
          <p className="text-blue-400">Click to play</p>
        )}
      </div>
    </div>
  );
}
