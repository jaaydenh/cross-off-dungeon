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

const toHorizontalRoomPairAnchors = (
  squares: Array<{ roomIndex: number; x: number; y: number }>
): Array<{ roomIndex: number; x: number; y: number }> => {
  const grouped = new Map<number, Array<{ roomIndex: number; x: number; y: number }>>();
  for (const square of squares) {
    const list = grouped.get(square.roomIndex) || [];
    list.push(square);
    grouped.set(square.roomIndex, list);
  }

  const anchors: Array<{ roomIndex: number; x: number; y: number }> = [];
  for (const groupSquares of grouped.values()) {
    const keySet = new Set(groupSquares.map((square) => `${square.x},${square.y}`));
    const consumed = new Set<string>();
    const sorted = [...groupSquares].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const square of sorted) {
      const key = `${square.x},${square.y}`;
      if (consumed.has(key)) continue;

      const rightKey = `${square.x + 1},${square.y}`;
      if (keySet.has(rightKey) && !consumed.has(rightKey)) {
        anchors.push({ roomIndex: square.roomIndex, x: square.x, y: square.y });
        consumed.add(key);
        consumed.add(rightKey);
        continue;
      }

      // Fall back to preserving payload if pair grouping failed; server validation will reject invalid moves.
      anchors.push({ roomIndex: square.roomIndex, x: square.x, y: square.y });
      consumed.add(key);
    }
  }

  return anchors;
};

const toHorizontalMonsterPairAnchors = (
  squares: Array<{ monsterId: string; x: number; y: number }>
): Array<{ monsterId: string; x: number; y: number }> => {
  const grouped = new Map<string, Array<{ monsterId: string; x: number; y: number }>>();
  for (const square of squares) {
    const list = grouped.get(square.monsterId) || [];
    list.push(square);
    grouped.set(square.monsterId, list);
  }

  const anchors: Array<{ monsterId: string; x: number; y: number }> = [];
  for (const groupSquares of grouped.values()) {
    const keySet = new Set(groupSquares.map((square) => `${square.x},${square.y}`));
    const consumed = new Set<string>();
    const sorted = [...groupSquares].sort((a, b) => a.y - b.y || a.x - b.x);

    for (const square of sorted) {
      const key = `${square.x},${square.y}`;
      if (consumed.has(key)) continue;

      const rightKey = `${square.x + 1},${square.y}`;
      if (keySet.has(rightKey) && !consumed.has(rightKey)) {
        anchors.push({ monsterId: square.monsterId, x: square.x, y: square.y });
        consumed.add(key);
        consumed.add(rightKey);
        continue;
      }

      // Fall back to preserving payload if pair grouping failed; server validation will reject invalid moves.
      anchors.push({ monsterId: square.monsterId, x: square.x, y: square.y });
      consumed.add(key);
    }
  }

  return anchors;
};

const ConfirmMoveButton: React.FC<ConfirmMoveButtonProps> = ({
  player,
  room,
  selectedCount,
  isVisible,
  isReady,
  selectedSquares = [],
  selectedMonsterSquares = []
}) => {
  const activeCard = player?.drawnCards?.find((c) => c.isActive);

  const handleConfirmMove = () => {
    if (!room || !player) return;
    if (activeCard?.selectionMode === 'cunning_three_step_different_cards') {
      room.send('confirmCardAction', {});
      return;
    }

    const displayedRoomIndices = room?.state?.displayedRoomIndices;
    const currentRoomIndex = room?.state?.currentRoomIndex;

    // Map UI display room indices -> server room indices at submit time.
    let roomSquares = (selectedSquares || []).map((pos) => ({
      roomIndex:
        pos.serverRoomIndex ??
        displayedRoomIndices?.[pos.roomIndex] ??
        currentRoomIndex ??
        pos.roomIndex,
      x: pos.x,
      y: pos.y
    }));
    let monsterSquares = [...(selectedMonsterSquares || [])];

    if (activeCard?.selectionMode === 'horizontal_pair_twice') {
      roomSquares = toHorizontalRoomPairAnchors(roomSquares);
      monsterSquares = toHorizontalMonsterPairAnchors(monsterSquares);
    }

    const payload: any = {};
    if (roomSquares.length > 0) payload.roomSquares = roomSquares;
    if (monsterSquares.length > 0) payload.monsterSquares = monsterSquares;

    // Send message to server to confirm/commit the card action (includes pending selections)
    room.send('confirmCardAction', payload);
  };

  if (!isVisible || selectedCount === 0) {
    return null;
  }

  const counterLabel = (() => {
    if (!activeCard) return `${selectedCount}`;
    if (activeCard.selectionTarget === 'monster_each') return `${selectedCount}`;
    if (activeCard.selectionMode === 'row') return `${selectedCount}`;
    if (activeCard.maxSelections && activeCard.maxSelections > 0) return `${selectedCount}/${activeCard.maxSelections}`;
    return `${selectedCount}`;
  })();

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
      Confirm Move ({counterLabel})
    </button>
  );
};

export default ConfirmMoveButton;
