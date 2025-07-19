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
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    console.log('🃏 CardDeck useEffect triggered');
    console.log('  - Player exists:', !!player);
    console.log('  - Current deckCount state:', deckCount);
    console.log('  - Current showGlow state:', showGlow);
    
    if (player) {
      const newDeckCount = player.deck.length;
      const wasCardDrawn = deckCount > newDeckCount && deckCount > 0;
      
      console.log('  - Player deck length:', newDeckCount);
      console.log('  - Previous deckCount:', deckCount);
      console.log('  - Was card drawn?', wasCardDrawn);
      console.log('  - Player hasDrawnCard:', player.hasDrawnCard);
      console.log('  - Player turnStatus:', player.turnStatus);
      console.log('  - Player drawnCards length:', player.drawnCards.length);
      
      // Show glow effect only when waiting for a card to be drawn (not_started status)
      const shouldShowGlow = player.turnStatus === "not_started" && !player.hasDrawnCard;
      console.log('  - Should show glow:', shouldShowGlow, `(turnStatus: "${player.turnStatus}", hasDrawnCard: ${player.hasDrawnCard})`);
      
      // Trigger flip animation when a card is actually drawn
      if (wasCardDrawn) {
        console.log('  ✨ Triggering deck flip animation!');
        setIsFlipping(true);
        setTimeout(() => {
          console.log('  ✨ Ending deck flip animation');
          setIsFlipping(false);
        }, 600); // Match animation duration
      }
      
      if (deckCount !== newDeckCount) {
        console.log(`  📊 Updating deck count: ${deckCount} → ${newDeckCount}`);
      }
      setDeckCount(newDeckCount);
      
      if (showGlow !== shouldShowGlow) {
        console.log(`  ✨ GLOW STATE CHANGE: ${showGlow} → ${shouldShowGlow}`);
        setShowGlow(shouldShowGlow);
      }
    } else {
      console.log('  ❌ No player data available');
    }
  }, [player, player?.turnStatus, player?.hasDrawnCard, player?.deck?.length, deckCount, showGlow]);

  const handleDeckClick = () => {
    console.log('🖱️ Deck clicked!');
    console.log('  - Room exists:', !!room);
    console.log('  - Player exists:', !!player);
    console.log('  - Player deck length:', player?.deck.length);
    console.log('  - Can draw card:', !!(room && player && player.deck.length > 0));
    
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
      <h3 className="text-lg font-semibold text-white">Deck</h3>
      
      {/* Card Deck */}
      <div 
        className={`
          card-deck relative w-20 h-28 bg-blue-900 border-2 border-blue-700 rounded-lg 
          cursor-pointer card-hover
          ${showGlow ? 'deck-glow' : ''}
          ${isFlipping ? 'card-flip' : ''}
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