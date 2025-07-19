import React from 'react';
import { Player } from '@/types/Player';

interface ConfirmMoveButtonProps {
  player: Player | null;
  room: any; // Colyseus room instance
  selectedCount: number;
  isVisible: boolean;
}

const ConfirmMoveButton: React.FC<ConfirmMoveButtonProps> = ({
  player,
  room,
  selectedCount,
  isVisible
}) => {
  const handleConfirmMove = () => {
    if (!room || !player) return;
    
    // Send message to server to confirm/commit the card action
    room.send('confirmCardAction', {});
  };

  if (!isVisible || selectedCount === 0) {
    return null;
  }

  return (
    <div className="absolute top-2 left-2 z-10">
      <button
        onClick={handleConfirmMove}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-green-400"
      >
        ✓ Confirm Move ({selectedCount} square{selectedCount !== 1 ? 's' : ''})
      </button>
    </div>
  );
};

export default ConfirmMoveButton;