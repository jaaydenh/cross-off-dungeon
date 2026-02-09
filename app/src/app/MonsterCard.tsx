'use client';

import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { MonsterSquare } from '@/types/MonsterSquare';
import { useCallback, useMemo, useState } from 'react';

interface MonsterCardProps {
  monster: MonsterCardType;
  isOwnedByPlayer: boolean;
  canDrag?: boolean;
  canSelect?: boolean;
  onSquareClick?: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  position?: { x: number; y: number };
  className?: string;
  selectedSquares?: Array<{ x: number; y: number }>;
  horizontalPairPreviewEnabled?: boolean;
}

export default function MonsterCard({
  monster,
  isOwnedByPlayer,
  canDrag,
  canSelect = false,
  onSquareClick,
  onDragStart,
  onDragEnd,
  onDrop,
  position,
  className = '',
  selectedSquares = [],
  horizontalPairPreviewEnabled = false
}: MonsterCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);
  const isInRoom = className.includes('monster-in-room');
  const isOwned = className.includes('monster-owned');
  const sizeScale = isInRoom ? 0.7 : isOwned ? 0.55 : 1;
  const squareSize = Math.round(40 * sizeScale);
  const gridPadding = Math.round(4 * sizeScale);
  const cardPadding = Math.round(12 * sizeScale);
  const minWidth = Math.max(120, Math.round(200 * sizeScale));
  const hoverZoomClasses = isOwned ? 'hover:scale-125 hover:z-50 hover:shadow-2xl' : '';
  const gridWidth = monster.width * squareSize;
  const gridHeight = monster.height * squareSize;

  const isSelectedSquare = (x: number, y: number): boolean =>
    selectedSquares.some((p) => p.x === x && p.y === y);

  const getSquareAt = useCallback((x: number, y: number): MonsterSquare | null => {
    const index = y * monster.width + x;
    return monster.squares[index] || null;
  }, [monster]);

  const previewCells = useMemo(() => {
    if (!horizontalPairPreviewEnabled || !hoveredSquare) {
      return { cells: [], invalid: false };
    }

    const rightX = hoveredSquare.x + 1;
    const leftSquare = getSquareAt(hoveredSquare.x, hoveredSquare.y);
    const rightSquare = getSquareAt(rightX, hoveredSquare.y);

    const invalid =
      !leftSquare ||
      !rightSquare ||
      !leftSquare.filled ||
      !rightSquare.filled ||
      leftSquare.checked ||
      rightSquare.checked;

    return {
      cells: [
        { x: hoveredSquare.x, y: hoveredSquare.y },
        { x: rightX, y: hoveredSquare.y }
      ],
      invalid
    };
  }, [horizontalPairPreviewEnabled, hoveredSquare, getSquareAt]);

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
    if (isOwnedByPlayer && canSelect && onSquareClick) {
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
      className={`monster-card relative bg-gray-800 border-2 border-gray-600 rounded-lg transition-all duration-200 transform-gpu ${hoverZoomClasses} ${
        canDrag ? 'cursor-grab hover:shadow-lg' : ''
      } ${
        isDragging ? 'rotate-3 shadow-2xl shadow-blue-500/50 scale-105 z-50' : ''
      } ${className}`}
      style={{
        padding: `${cardPadding}px`,
        minWidth: `${minWidth}px`,
        ...(position
          ? {
              position: 'absolute',
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: isDragging ? 1000 : 10
            }
          : {})
      }}
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Monster Header */}
      <div className={`flex items-center justify-between ${isInRoom ? 'mb-1' : 'mb-2'}`}>
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
        className="monster-grid relative inline-block bg-gray-700 border border-gray-500 rounded"
        style={{
          padding: `${gridPadding}px`
        }}
        onMouseLeave={() => setHoveredSquare(null)}
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${monster.width}, ${squareSize}px)`,
            gridTemplateRows: `repeat(${monster.height}, ${squareSize}px)`,
            width: `${gridWidth}px`,
            height: `${gridHeight}px`
          }}
        >
          {Array.from({ length: monster.height }, (_, y) =>
            Array.from({ length: monster.width }, (_, x) => {
              const square = getSquareAt(x, y);
              const isFilled = square?.filled || false;
              const isChecked = square?.checked || false;
              const isSelected = !isChecked && isSelectedSquare(x, y);

              return (
                <div
                  key={`${x}-${y}`}
                  className={`
                    monster-square border border-gray-600 text-xs flex items-center justify-center
                    ${isFilled ? 'bg-red-700' : 'bg-gray-800'}
                    ${isChecked ? 'bg-green-600' : ''}
                    ${isFilled && !isChecked && isOwnedByPlayer && canSelect ? 'hover:bg-red-600 cursor-pointer' : ''}
                    ${!isFilled ? 'opacity-30' : ''}
                  `}
                  style={{
                    width: `${squareSize}px`,
                    height: `${squareSize}px`
                  }}
                  onMouseEnter={() => {
                    if (horizontalPairPreviewEnabled) {
                      setHoveredSquare({ x, y });
                    }
                  }}
                  onClick={() => handleSquareClick(x, y)}
                >
                  {(isChecked || isSelected) && 'X'}
                </div>
              );
            })
          )}

          {horizontalPairPreviewEnabled && previewCells.cells.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30">
              {previewCells.cells
                .filter((cell) => cell.x >= 0 && cell.x < monster.width && cell.y >= 0 && cell.y < monster.height)
                .map((cell) => (
                  <div
                    key={`monster-preview-${monster.id}-${cell.x}-${cell.y}`}
                    className={`absolute border-2 ${
                      previewCells.invalid
                        ? 'bg-red-500/45 border-red-300'
                        : 'bg-sky-500/45 border-sky-300'
                    }`}
                    style={{
                      left: `${cell.x * squareSize}px`,
                      top: `${cell.y * squareSize}px`,
                      width: `${squareSize}px`,
                      height: `${squareSize}px`,
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Indicators */}
      <div className={`flex gap-2 justify-center ${isInRoom ? 'mt-1' : 'mt-2'}`}>
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

    </div>
  );
}
