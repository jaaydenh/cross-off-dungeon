import React from 'react';
import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import MonsterCard from './MonsterCard';

interface MonsterBadgeProps {
  monster: MonsterCardType;
  canDrag: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const getMonsterEmoji = (name: string): string => {
  switch (name) {
    case 'bat': return '🦇';
    case 'goblin': return '👹';
    case 'rat': return '🐀';
    case 'troll': return '🧌';
    case 'slime': return '🟢';
    default: return '👾';
  }
};

export default function MonsterBadge({ monster, canDrag, onDragStart, onDragEnd }: MonsterBadgeProps) {
  const totalSquares = monster.squares.filter(square => square.filled).length;
  const crossedSquares = monster.squares.filter(square => square.filled && square.checked).length;

  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'monster',
      monsterId: monster.id
    }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative origin-top-right transition-all duration-200 ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'
      } w-10 h-10 hover:w-56 hover:h-56`}
      title={canDrag ? 'Drag to claim' : 'Join the game to claim'}
    >
      {/* Card frame */}
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-slate-800/95 border border-slate-500 shadow-lg overflow-hidden">
        {/* Compact view */}
        <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-150">
          <div className="relative">
            <div className="text-2xl leading-none">{getMonsterEmoji(monster.name)}</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-slate-200 bg-slate-900/80 px-1 rounded">
              {crossedSquares}/{totalSquares}
            </div>
          </div>
        </div>

        {/* Hover preview */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-2">
          <MonsterCard
            monster={monster}
            isOwnedByPlayer={false}
            canDrag={false}
            className="monster-in-room"
          />
          <div className="mt-2 text-center text-xs text-slate-200 font-semibold">
            Drag to claim
          </div>
        </div>
      </div>
    </div>
  );
}

