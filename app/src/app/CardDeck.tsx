'use client';

import { Player } from '@/types/Player';
import { Room } from '@colyseus/sdk';
import { useState, useEffect } from 'react';

interface CardDeckProps {
  player: Player | null;
  room: Room | undefined;
  onOpenDeckModal?: () => void;
}

export default function CardDeck({ player, room, onOpenDeckModal }: CardDeckProps) {
  const [deckCount, setDeckCount] = useState(0);
  const [showGlow, setShowGlow] = useState(true);

  useEffect(() => {    
    if (player) {
      const newDeckCount = player.deck.length;
      const gameStatus = (room as any)?.state?.gameStatus || 'in_progress';
      const shouldShowGlow = gameStatus === 'in_progress' && player.turnStatus === "not_started" && !player.hasDrawnCard;
      
      setDeckCount(newDeckCount);
      setShowGlow(shouldShowGlow);
    }
  }, [player, player?.turnStatus, player?.hasDrawnCard, player?.deck?.length, room]);

  const handleDeckClick = () => {
    const gameStatus = (room as any)?.state?.gameStatus || 'in_progress';
    if (room && player && player.deck.length > 0 && gameStatus === 'in_progress') {
      console.log('  📤 Sending drawCard message to server');
      room.send('drawCard');
    } else {
      console.log('  ❌ Cannot draw card - conditions not met');
    }
  };

  if (!player) {
    return (
      <div className="text-center text-gray-400">
        <p>Loading deck...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-md font-semibold text-white">Deck</h3>
        <button
          type="button"
          onClick={() => onOpenDeckModal?.()}
          disabled={!onOpenDeckModal}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-500 bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="View full deck"
          aria-label="View full deck"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M1.5 10c1.8-3.2 4.8-5 8.5-5s6.7 1.8 8.5 5c-1.8 3.2-4.8 5-8.5 5s-6.7-1.8-8.5-5Z" />
            <circle cx="10" cy="10" r="2.6" />
          </svg>
        </button>
      </div>

      {/* Card Deck */}
      <div 
        className={`
          card-deck relative w-[121px] h-[176px] bg-blue-900 border-2 border-blue-700 rounded-lg 
          cursor-pointer card-hover
          ${showGlow ? 'deck-glow' : ''}
          ${deckCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        data-player-deck-card="true"
        role="button"
        tabIndex={0}
        onClick={handleDeckClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDeckClick(); } }}
      >
        {/* Card back design */}
        <div className="absolute inset-2 bg-blue-800 rounded border border-blue-600">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-400 rounded-full opacity-60"></div>
          </div>
        </div>

        {/* Card count badge */}
        {deckCount > 0 && (
          <div className="card-count-badge absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {deckCount}
          </div>
        )}
      </div>
    </div>
  );
}
