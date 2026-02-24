'use client';

import { Player } from '@/types/Player';
import { Card } from '@/types/Card';
import { Room } from '@colyseus/sdk';
import CardFaceContent from './CardFaceContent';

interface DrawnCardProps {
  player: Player | null;
  room: Room | undefined;
  showExtraUseBadge?: boolean;
  hiddenCardIds?: Set<string>;
}

export default function DrawnCard({
  player,
  room,
  showExtraUseBadge = false,
  hiddenCardIds
}: DrawnCardProps) {
  const topDrawnCard =
    player && player.drawnCards.length > 0
      ? player.drawnCards[player.drawnCards.length - 1]
      : null;
  const previousDrawnCard =
    player && player.drawnCards.length > 1
      ? player.drawnCards[player.drawnCards.length - 2]
      : null;
  const isTopDrawnCardHidden = !!topDrawnCard?.id && !!hiddenCardIds?.has(topDrawnCard.id);
  const drawnCard = isTopDrawnCardHidden ? previousDrawnCard : topDrawnCard;

  const handleCardClick = () => {
    if (room && drawnCard && !drawnCard.isActive) {
      room.send('playCard', { cardId: drawnCard.id });
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!drawnCard?.isActive) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'active_card_discard',
        cardId: drawnCard.id
      })
    );
    event.dataTransfer.effectAllowed = 'move';
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
        <div
          className="w-[121px] h-[176px] bg-gray-700 border-2 border-gray-600 rounded-lg flex items-center justify-center"
          data-player-active-card-slot="true"
        >
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
        `}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
        draggable={true}
        onDragStart={handleDragStart}
        title={cardTitle(drawnCard)}
        data-player-active-card-slot="true"
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

    </div>
  );
}
