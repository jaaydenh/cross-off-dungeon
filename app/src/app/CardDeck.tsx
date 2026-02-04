'use client';

import { Player } from '@/types/Player';
import { Room } from 'colyseus.js';
import { useState, useEffect } from 'react';

interface CardDeckProps {
  player: Player | null;
  room: Room | undefined;
}

export default function CardDeck({ player, room }: CardDeckProps) {
  const [deckCount, setDeckCount] = useState(0);
  const [showGlow, setShowGlow] = useState(true);

  useEffect(() => {    
    if (player) {
      const newDeckCount = player.deck.length;
      const wasCardDrawn = deckCount > newDeckCount && deckCount > 0;
      const shouldShowGlow = player.turnStatus === "not_started" && !player.hasDrawnCard;
      
      setDeckCount(newDeckCount);
      
      if (showGlow !== shouldShowGlow) {
        setShowGlow(shouldShowGlow);
      }
    } else {
      console.log('  ❌ No player data available');
    }
  }, [player, player?.turnStatus, player?.hasDrawnCard, player?.deck?.length, deckCount, showGlow]);

  const handleDeckClick = () => {
    if (room && player && player.deck.length > 0) {
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
      <h3 className="text-md font-semibold text-white">Deck</h3>
      
      {/* Card Deck */}
      <div 
        className={`
          card-deck relative w-24 h-32 bg-blue-900 border-2 border-blue-700 rounded-lg 
          cursor-pointer card-hover
          ${showGlow ? 'deck-glow' : ''}
          ${deckCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={handleDeckClick}
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