'use client';

import { Player } from '@/types/Player';
import { Room } from 'colyseus.js';

interface CancelButtonProps {
  player: Player | null;
  room: Room | undefined;
  roomIndex: number;
  isVisible: boolean;
}

export default function CancelButton({ player, room, roomIndex, isVisible }: CancelButtonProps) {
  const handleCancelClick = () => {
    if (room) {
      room.send('cancelCardAction', { roomIndex });
    }
  };

  // Don't render if not visible
  if (!isVisible || !player) {
    return null;
  }

  // Check if player has an active card
  const hasActiveCard = player.drawnCards.some(card => card.isActive);
  
  if (!hasActiveCard) {
    return null;
  }

  return (
    <button
      onClick={handleCancelClick}
      className="
        cancel-button absolute top-2 right-2 z-10
        bg-red-600 hover:bg-red-700 
        text-white font-bold 
        px-3 py-1 rounded-md
        text-sm transition-all duration-200
        shadow-lg hover:shadow-xl
        border border-red-500
      "
      title="Cancel card action"
    >
      Cancel
    </button>
  );
}