'use client';

import { Player } from '@/types/Player';
import { Room } from '@colyseus/sdk';

interface DiscardCardButtonProps {
  player: Player | null;
  room: Room | undefined;
  isVisible: boolean;
  onDiscard?: () => void;
}

export default function DiscardCardButton({
  player,
  room,
  isVisible,
  onDiscard
}: DiscardCardButtonProps) {
  const handleDiscardClick = () => {
    if (room) {
      room.send('discardCardAction', {});
    }
    onDiscard?.();
  };

  if (!isVisible || !player) {
    return null;
  }

  const hasActiveCard = player.drawnCards.some((card) => card.isActive);
  if (!hasActiveCard) {
    return null;
  }

  return (
    <button
      onClick={handleDiscardClick}
      className="
        bg-amber-600 hover:bg-amber-700
        text-white font-bold
        px-4 py-2 rounded-md
        text-sm transition-all duration-200
        shadow-lg hover:shadow-xl
        border border-amber-500
      "
      title="Discard active card"
    >
      Discard
    </button>
  );
}
