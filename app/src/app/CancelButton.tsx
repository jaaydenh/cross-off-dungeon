'use client';

import { Player } from '@/types/Player';
import { Room } from 'colyseus.js';

interface CancelButtonProps {
  player: Player | null;
  room: Room | undefined;
  isVisible: boolean;
  onCancel?: () => void;
}

export default function CancelButton({ player, room, isVisible, onCancel }: CancelButtonProps) {
  const handleCancelClick = () => {
    if (room) {
      room.send('cancelCardAction', {});
    }
    if (onCancel) {
      onCancel();
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
        cancel-button
        bg-red-600 hover:bg-red-700 
        text-white font-bold 
        px-4 py-2 rounded-md
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
