import React from 'react';
import { Player } from '@/types/Player';

interface ConfirmMoveButtonProps {
  player: Player | null;
  room: any; // Colyseus room instance
  selectedCount: number;
  isVisible: boolean;
  isReady: boolean;
  selectedSquares?: Array<{ roomIndex: number; x: number; y: number; serverRoomIndex?: number }>;
  selectedMonsterSquares?: Array<{ monsterId: string; x: number; y: number }>;
}

const ConfirmMoveButton: React.FC<ConfirmMoveButtonProps> = ({
  player,
  room,
  selectedCount,
  isVisible,
  isReady,
  selectedSquares = [],
  selectedMonsterSquares = []
}) => {
  const handleConfirmMove = () => {
    if (!room || !player) return;

    const displayedRoomIndices = room?.state?.displayedRoomIndices;
    const currentRoomIndex = room?.state?.currentRoomIndex;

    // Map UI display room indices -> server room indices at submit time.
    const roomSquares = (selectedSquares || []).map((pos) => ({
      roomIndex:
        pos.serverRoomIndex ??
        displayedRoomIndices?.[pos.roomIndex] ??
        currentRoomIndex ??
        pos.roomIndex,
      x: pos.x,
      y: pos.y
    }));

    const payload: any = {};
    if (roomSquares.length > 0) payload.roomSquares = roomSquares;
    if ((selectedMonsterSquares || []).length > 0) payload.monsterSquares = selectedMonsterSquares;

    // Send message to server to confirm/commit the card action (includes pending selections)
    room.send('confirmCardAction', payload);
  };

  if (!isVisible || selectedCount === 0) {
    return null;
  }

  return (
    <button
      onClick={handleConfirmMove}
      disabled={!isReady}
      className={`text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all duration-200 transform border-2 ${
        isReady
          ? 'bg-green-600 hover:bg-green-700 border-green-400'
          : 'bg-green-900/50 border-green-900 cursor-not-allowed opacity-60'
      }`}
    >
      Confirm Move ({selectedCount}/3)
    </button>
  );
};

export default ConfirmMoveButton;
