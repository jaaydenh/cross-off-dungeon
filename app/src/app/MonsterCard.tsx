'use client';

import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { MonsterSquare } from '@/types/MonsterSquare';
import { Room } from 'colyseus.js';
import { useState } from 'react';

interface MonsterCardProps {
  monster: MonsterCardType;
  isOwnedByPlayer: boolean;
  canDrag?: boolean;
  onSquareClick?: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  position?: { x: number; y: number };
  className?: string;
}

export default function MonsterCard({
  monster,
  isOwnedByPlayer,
  canDrag,
  onSquareClick,
  onDragStart,
  onDragEnd,
  onDrop,
  position,
  className = ''
}: MonsterCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const getSquareAt = (x: number, y: number): MonsterSquare | null => {
    const index = y * monster.width + x;
    return monster.squares[index] || null;
  };

  const getTotalSquares = (): number => {
    return monster.squares.filter(square => square.filled).length;
  };

  const getCrossedSquares = (): number => {
    return monster.squares.filter(square => square.filled && square.checked).length;
  };

  const isCompleted = (): boolean => {
    return getTotalSquares() > 0 && getCrossedSquares() === getTotalSquares();
  };

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

  const handleSquareClick = (x: number, y: number) => {
    if (isOwnedByPlayer && onSquareClick) {
      const square = getSquareAt(x, y);
      if (square?.filled && !square.checked) {
        onSquareClick(x, y);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    console.log('MonsterCard: Drag start for monster:', monster.id, 'canDrag:', canDrag);
    
    if (!canDrag) {
      e.preventDefault();
      console.log('MonsterCard: Drag prevented - canDrag is false');
      return;
    }
    
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'monster',
      monsterId: monster.id
    }));
    
    // Set drag effect
    e.dataTransfer.effectAllowed = 'move';
    
    if (onDragStart) {
      console.log('MonsterCard: Calling onDragStart');
      onDragStart();
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  return (
    <div 
      className={`monster-card bg-gray-800 border-2 border-gray-600 rounded-lg p-3 transition-all duration-200 ${
        canDrag ? 'cursor-grab hover:shadow-lg' : ''
      } ${
        isDragging ? 'rotate-3 shadow-2xl shadow-blue-500/50 scale-105 z-50' : ''
      } ${className}`}
      style={position ? { 
        position: 'absolute', 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        zIndex: isDragging ? 1000 : 10,
        minWidth: '200px'
      } : className?.includes('monster-in-room') ? {} : { minWidth: '200px' }}
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Monster Header */}
      <div className={`flex items-center justify-between ${className?.includes('monster-in-room') ? 'mb-1 text-xs' : 'mb-2'}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getMonsterEmoji(monster.name)}</span>
          <span className="text-white font-bold capitalize">{monster.name}</span>
        </div>
        <div className="text-sm text-gray-400">
          {getCrossedSquares()}/{getTotalSquares()}
        </div>
      </div>

      {/* Monster Grid */}
      <div 
        className="monster-grid bg-gray-700 border border-gray-500 rounded p-1 flex flex-wrap"
        style={{
          width: `${monster.width * 42}px`, // Same as room grid: 40px + 2px margin
        }}
      >
        {Array.from({ length: monster.height }, (_, y) =>
          Array.from({ length: monster.width }, (_, x) => {
            const square = getSquareAt(x, y);
            const isFilled = square?.filled || false;
            const isChecked = square?.checked || false;
            
            return (
              <div
                key={`${x}-${y}`}
                className={`
                  monster-square aspect-square border border-gray-600 text-xs flex items-center justify-center
                  ${isFilled ? 'bg-red-700' : 'bg-gray-800'}
                  ${isChecked ? 'bg-green-600' : ''}
                  ${isFilled && !isChecked && isOwnedByPlayer ? 'hover:bg-red-600 cursor-pointer' : ''}
                  ${!isFilled ? 'opacity-30' : ''}
                `}
                style={{
                  width: '40px',
                  height: '40px'
                }}
                onClick={() => handleSquareClick(x, y)}
              >
                {isChecked && '✓'}
              </div>
            );
          })
        )}
      </div>

      {/* Status Indicators */}
      <div className={`flex gap-2 justify-center ${className?.includes('monster-in-room') ? 'mt-1' : 'mt-2'}`}>
        {canDrag && (
          <div className="text-xs text-blue-400 font-medium">
            Drag to claim
          </div>
        )}
        
        {isCompleted() && (
          <div className="px-2 py-1 bg-green-600 text-white text-xs rounded">
            ✓ Completed!
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-1 text-xs text-gray-400">
        {isOwnedByPlayer 
          ? "In your area" 
          : monster.playerOwnerId 
            ? "Claimed by another player" 
            : "Available to claim"
        }
      </div>
    </div>
  );
}