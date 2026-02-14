'use client';

import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { MonsterSquare } from '@/types/MonsterSquare';
import { useCallback, useMemo, useState } from 'react';
import CardFaceContent from './CardFaceContent';
import { MonsterAttackAnimation } from '@/types/MonsterAttack';

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
  combatBlastPreviewEnabled?: boolean;
  swipePreviewEnabled?: boolean;
  attackAnimations?: MonsterAttackAnimation[];
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
  horizontalPairPreviewEnabled = false,
  combatBlastPreviewEnabled = false,
  swipePreviewEnabled = false,
  attackAnimations = []
}: MonsterCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);
  const isInRoom = className.includes('monster-in-room');
  const isOwned = className.includes('monster-owned');
  const sizeScale = isInRoom ? 0.7 : isOwned ? 0.55 : 1;
  const squareSize = Math.round(40 * sizeScale);
  const cardPadding = Math.round(12 * sizeScale);
  const minWidth = Math.max(120, Math.round(220 * sizeScale));
  const minHeight = Math.max(170, Math.round(320 * sizeScale));
  const hoverZoomClasses = isOwned ? 'hover:scale-125 hover:z-50 hover:shadow-2xl' : '';
  const gridWidth = monster.width * squareSize;
  const gridHeight = monster.height * squareSize;
  const totalSquares = monster.squares.filter((square) => square.filled).length;
  const crossedSquares = monster.squares.filter((square) => square.filled && square.checked).length;
  const experienceValue = Math.max(1, Math.ceil(totalSquares / 5));

  const isSelectedSquare = (x: number, y: number): boolean =>
    selectedSquares.some((p) => p.x === x && p.y === y);

  const getSquareAt = useCallback((x: number, y: number): MonsterSquare | null => {
    const index = y * monster.width + x;
    return monster.squares[index] || null;
  }, [monster]);

  const horizontalPairPreview = useMemo(() => {
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

  const combatBlastPreviewCells = useMemo(() => {
    if (!combatBlastPreviewEnabled || !hoveredSquare) {
      return [] as Array<{ x: number; y: number; inBounds: boolean; valid: boolean; isCenter: boolean }>;
    }

    const cells: Array<{ x: number; y: number; inBounds: boolean; valid: boolean; isCenter: boolean }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = hoveredSquare.x + dx;
        const y = hoveredSquare.y + dy;
        const inBounds = x >= 0 && x < monster.width && y >= 0 && y < monster.height;
        const square = getSquareAt(x, y);
        const valid = !!square && square.filled && !square.checked;
        cells.push({
          x,
          y,
          inBounds,
          valid,
          isCenter: dx === 0 && dy === 0
        });
      }
    }

    return cells;
  }, [combatBlastPreviewEnabled, hoveredSquare, monster.width, monster.height, getSquareAt]);

  const swipePreviewCells = useMemo(() => {
    if (!swipePreviewEnabled || !hoveredSquare) {
      return [] as Array<{
        x: number;
        y: number;
        inBounds: boolean;
        valid: boolean;
        required: boolean;
      }>;
    }

    const requiredOffsets = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }
    ];
    const optionalOffsets = [
      { dx: 2, dy: 0 },
      { dx: 0, dy: 2 }
    ];

    const offsets = [
      ...requiredOffsets.map((o) => ({ ...o, required: true })),
      ...optionalOffsets.map((o) => ({ ...o, required: false }))
    ];

    return offsets.map((offset) => {
      const x = hoveredSquare.x + offset.dx;
      const y = hoveredSquare.y + offset.dy;
      const inBounds = x >= 0 && x < monster.width && y >= 0 && y < monster.height;
      const square = getSquareAt(x, y);
      const valid = !!square && square.filled && !square.checked;
      return {
        x,
        y,
        inBounds,
        valid,
        required: offset.required
      };
    });
  }, [swipePreviewEnabled, hoveredSquare, monster.width, monster.height, getSquareAt]);

  const isCompleted = (): boolean => {
    return totalSquares > 0 && crossedSquares === totalSquares;
  };

  const borderSegments = (() => {
    const segments: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const seen = new Set<string>();

    const addSegment = (x1: number, y1: number, x2: number, y2: number) => {
      const key = `${x1},${y1},${x2},${y2}`;
      if (seen.has(key)) return;
      seen.add(key);
      segments.push({ key, x1, y1, x2, y2 });
    };

    for (let y = 0; y < monster.height; y++) {
      for (let x = 0; x < monster.width; x++) {
        const square = monster.squares[y * monster.width + x];
        if (!square?.filled) continue;

        // Add all 4 edges and deduplicate shared edges.
        addSegment(x, y, x + 1, y);
        addSegment(x, y + 1, x + 1, y + 1);
        addSegment(x, y, x, y + 1);
        addSegment(x + 1, y, x + 1, y + 1);
      }
    }

    return segments;
  })();

  const getMonsterEmoji = (name: string): string => {
    switch (name) {
      case 'bat': return '🦇';
      case 'goblin': return '👹';
      case 'rat': return '🐀';
      case 'troll': return '🧌';
      case 'slime': return '🟢';
      case 'ancient_wyrm': return '🐉';
      default: return '👾';
    }
  };

  const getAttackOutcomeLabel = (attack: MonsterAttackAnimation): string => {
    switch (attack.outcome) {
      case 'discarded':
        return 'Lost';
      case 'returned_to_deck':
        return 'Blocked';
      case 'counter_attack':
        return 'Counter!';
      case 'no_card_available':
        return 'No card';
      default:
        return 'Resolved';
    }
  };

  const getAttackOutcomeClass = (attack: MonsterAttackAnimation): string => {
    switch (attack.outcome) {
      case 'discarded':
        return 'bg-red-700 text-white';
      case 'returned_to_deck':
        return 'bg-blue-700 text-white';
      case 'counter_attack':
        return 'bg-emerald-700 text-white';
      case 'no_card_available':
        return 'bg-gray-700 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  const handleSquareClick = (x: number, y: number) => {
    if (isOwnedByPlayer && canSelect && onSquareClick) {
      if (combatBlastPreviewEnabled || swipePreviewEnabled) {
        onSquareClick(x, y);
        return;
      }

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

    e.dataTransfer.effectAllowed = 'move';

    if (onDragStart) {
      console.log('MonsterCard: Calling onDragStart');
      onDragStart();
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  return (
    <div
      className={`monster-card relative flex flex-col rounded-lg border-2 border-stone-500 bg-stone-200 text-black transition-all duration-200 transform-gpu ${hoverZoomClasses} ${
        canDrag ? 'cursor-grab hover:shadow-lg' : ''
      } ${
        isDragging ? 'rotate-3 shadow-2xl shadow-blue-500/50 scale-105 z-50' : ''
      } ${className}`}
      data-monster-card-id={monster.id}
      style={{
        padding: `${cardPadding}px`,
        minWidth: `${minWidth}px`,
        minHeight: `${minHeight}px`,
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
      <div className={`border-b border-stone-500 pb-1 ${isInRoom ? 'mb-1' : 'mb-2'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="h-6 w-2 rounded-sm bg-red-600" />
          <span className="flex-1 text-center text-lg font-black capitalize leading-none">
            {monster.name}
          </span>
          <span className="text-xl leading-none">{getMonsterEmoji(monster.name)}</span>
        </div>
        {monster.isBoss && (
          <div className="mt-1 text-center text-[10px] font-black tracking-widest text-red-700">
            BOSS
          </div>
        )}
        <div className="mt-1 flex items-end justify-between">
          <div className="inline-flex items-center gap-1 rounded border border-red-500 bg-red-200 px-1.5 py-0.5 leading-none">
            <span className="text-[9px] font-semibold uppercase tracking-wide">Atk</span>
            <span className="text-xs font-black">{monster.attackRating || 1}</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-red-500 bg-red-200 text-[9px] font-black text-red-900">
            {crossedSquares}/{totalSquares}
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-1 items-center justify-center" onMouseLeave={() => setHoveredSquare(null)}>
        <div className="monster-grid relative mx-auto">
          <div
            className="relative mx-auto grid"
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
                      monster-square text-xs flex items-center justify-center font-bold
                      ${isFilled ? 'bg-stone-100 text-stone-800' : 'bg-transparent'}
                      ${isChecked ? 'bg-emerald-300 text-stone-900' : ''}
                      ${isSelected ? 'bg-rose-200 text-stone-900' : ''}
                      ${
                        (combatBlastPreviewEnabled || swipePreviewEnabled) && isOwnedByPlayer && canSelect
                          ? 'hover:bg-stone-300/70 cursor-crosshair'
                          : isFilled && !isChecked && isOwnedByPlayer && canSelect
                            ? 'hover:bg-stone-300 cursor-pointer'
                            : ''
                      }
                    `}
                    style={{
                      width: `${squareSize}px`,
                      height: `${squareSize}px`,
                      boxSizing: 'border-box',
                      lineHeight: 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={() => {
                      if (horizontalPairPreviewEnabled || combatBlastPreviewEnabled || swipePreviewEnabled) {
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

            <svg
              className="pointer-events-none absolute left-0 top-0 z-20"
              width={gridWidth + 1}
              height={gridHeight + 1}
              viewBox={`0 0 ${gridWidth + 1} ${gridHeight + 1}`}
              shapeRendering="crispEdges"
              aria-hidden
            >
              {borderSegments.map((segment) => (
                <line
                  key={segment.key}
                  x1={segment.x1 * squareSize + 0.5}
                  y1={segment.y1 * squareSize + 0.5}
                  x2={segment.x2 * squareSize + 0.5}
                  y2={segment.y2 * squareSize + 0.5}
                  stroke="#78716c"
                  strokeWidth={1}
                />
              ))}
            </svg>

            {horizontalPairPreviewEnabled && horizontalPairPreview.cells.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-30">
                {horizontalPairPreview.cells
                  .filter((cell) => cell.x >= 0 && cell.x < monster.width && cell.y >= 0 && cell.y < monster.height)
                  .map((cell) => (
                    <div
                      key={`monster-preview-${monster.id}-${cell.x}-${cell.y}`}
                      className={`absolute border-2 ${
                        horizontalPairPreview.invalid
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

            {combatBlastPreviewEnabled && combatBlastPreviewCells.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-30">
                {combatBlastPreviewCells
                  .filter((cell) => cell.inBounds)
                  .map((cell) => (
                    <div
                      key={`monster-combat-preview-${monster.id}-${cell.x}-${cell.y}`}
                      className={`absolute border border-dashed ${
                        cell.valid
                          ? cell.isCenter
                            ? 'bg-red-500/65 border-red-300'
                            : 'bg-rose-300/55 border-rose-400'
                          : cell.isCenter
                            ? 'bg-red-400/25 border-red-300/70'
                            : 'bg-stone-500/10 border-stone-400/60'
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

            {swipePreviewEnabled && swipePreviewCells.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-30">
                {swipePreviewCells
                  .filter((cell) => cell.inBounds)
                  .map((cell) => (
                    <div
                      key={`monster-swipe-preview-${monster.id}-${cell.x}-${cell.y}`}
                      className={`absolute ${
                        cell.required
                          ? cell.valid
                            ? 'bg-red-500/70 border border-red-500'
                            : 'bg-red-400/25 border border-dashed border-red-300/70'
                          : cell.valid
                            ? 'bg-rose-300/55 border border-dashed border-rose-400'
                            : 'bg-stone-500/10 border border-dashed border-stone-400/60'
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
      </div>

      {attackAnimations.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-50 -translate-x-1/2">
          {attackAnimations.map((attack, index) => (
            <div
              key={attack.id}
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: `${-114 - index * 10}px`
              }}
            >
              {attack.card ? (
                <div
                  className="monster-attack-card-fly relative h-24 w-16 rounded border-2 border-gray-300 bg-white shadow-lg"
                  style={{ animationDelay: `${Math.max(0, attack.attackNumber - 1) * 280}ms` }}
                  title={`${(attack.card.name || '').trim() || 'Heroic'}: ${attack.card.description}`}
                >
                  <CardFaceContent
                    type={attack.card.type}
                    name={attack.card.name}
                    description={attack.card.description}
                    defenseSymbol={attack.card.defenseSymbol}
                    color={attack.card.color}
                  />
                </div>
              ) : (
                <div
                  className="monster-attack-card-fly flex h-24 w-16 items-center justify-center rounded border-2 border-gray-500 bg-slate-800 text-[10px] font-semibold text-gray-200 shadow-lg"
                  style={{ animationDelay: `${Math.max(0, attack.attackNumber - 1) * 280}ms` }}
                >
                  No card
                </div>
              )}
              <div
                className={`monster-attack-outcome-pop mt-1 rounded px-2 py-1 text-center text-[10px] font-semibold shadow ${getAttackOutcomeClass(
                  attack
                )}`}
                style={{ animationDelay: `${Math.max(0, attack.attackNumber - 1) * 280 + 420}ms` }}
              >
                {getAttackOutcomeLabel(attack)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1 flex min-h-[18px] items-center gap-2">
        {canDrag && (
          <div className="text-xs font-medium text-blue-600">
            Drag to claim
          </div>
        )}

        {isCompleted() && (
          <div className="rounded bg-green-600 px-2 py-1 text-xs text-white">
            ✓ Completed!
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-1 right-1 rounded border border-stone-500 bg-stone-100 px-1.5 py-1 text-right shadow-sm">
        <div className="text-[7px] font-semibold uppercase leading-none tracking-wide text-stone-600">
          XP
        </div>
        <div className="text-[10px] font-black leading-none text-stone-900">
          {experienceValue}
        </div>
      </div>
    </div>
  );
}
