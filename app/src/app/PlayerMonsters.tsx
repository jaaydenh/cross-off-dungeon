'use client';

import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { Player } from '@/types/Player';
import { DungeonState } from '@/types/DungeonState';
import { Room } from '@colyseus/sdk';
import MonsterCard from './MonsterCard';
import { useMemo, useState } from 'react';
import { MonsterAttackAnimation } from '@/types/MonsterAttack';

interface PlayerMonstersProps {
  gameState: DungeonState | null;
  currentPlayer: Player | null;
  colyseusRoom: Room | null;
  isMonsterBeingDragged?: boolean;
  selectedMonsterSquares?: Array<{ monsterId: string; x: number; y: number }>;
  onMonsterSquareClick?: (monsterId: string, x: number, y: number) => void;
  onMonsterDrop?: () => void;
  cunningPreviewStepLength?: 1 | 2 | 3 | null;
  attackAnimations?: MonsterAttackAnimation[];
  completionFxByMonsterId?: Record<string, 'skull' | 'fade'>;
  hiddenCompletedMonsterIds?: string[];
  debugModeEnabled?: boolean;
  onDebugCompleteMonster?: (monsterId: string) => void;
}

const EMPTY_MONSTER_SQUARES: Array<{ monsterId: string; x: number; y: number }> = [];
const EMPTY_ATTACK_ANIMATIONS: MonsterAttackAnimation[] = [];
const EMPTY_HIDDEN_IDS: string[] = [];
const EMPTY_COMPLETION_FX: Record<string, 'skull' | 'fade'> = {};

export default function PlayerMonsters({
  gameState,
  currentPlayer,
  colyseusRoom,
  isMonsterBeingDragged = false,
  selectedMonsterSquares = EMPTY_MONSTER_SQUARES,
  onMonsterSquareClick,
  onMonsterDrop,
  cunningPreviewStepLength = null,
  attackAnimations = EMPTY_ATTACK_ANIMATIONS,
  completionFxByMonsterId = EMPTY_COMPLETION_FX,
  hiddenCompletedMonsterIds = EMPTY_HIDDEN_IDS,
  debugModeEnabled = false,
  onDebugCompleteMonster
}: PlayerMonstersProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const hiddenCompletedMonsterIdSet = useMemo(
    () => new Set(hiddenCompletedMonsterIds),
    [hiddenCompletedMonsterIds]
  );

  const isMonsterCompleted = (monster: MonsterCardType): boolean =>
    Array.isArray(monster.squares) && monster.squares.every((square) => !square.filled || square.checked);

  const activeCard = currentPlayer?.drawnCards?.find((card) => card.isActive);
  const canSelectMonsterSquares =
    !!activeCard &&
    (
      activeCard.selectionMode === 'squares' ||
      activeCard.selectionMode === 'horizontal_pair_twice' ||
      activeCard.selectionMode === 'cunning_three_step_different_cards' ||
      activeCard.selectionMode === 'centered_monster_3x3' ||
      activeCard.selectionMode === 'monster_swipe_l'
    ) &&
    (activeCard.selectionTarget === 'monster' ||
      activeCard.selectionTarget === 'room_or_monster' ||
      activeCard.selectionTarget === 'monster_each');
  const showHorizontalPairPreview = !!activeCard && activeCard.selectionMode === 'horizontal_pair_twice';
  const showCombatBlastPreview = !!activeCard && activeCard.selectionMode === 'centered_monster_3x3';
  const showSwipePreview = !!activeCard && activeCard.selectionMode === 'monster_swipe_l';

  const getPlayerMonsters = (): MonsterCardType[] => {
    if (!gameState?.activeMonsters || !currentPlayer) return [];
    
    return gameState.activeMonsters.filter((monster) => {
      if (monster.playerOwnerId !== colyseusRoom?.sessionId) {
        return false;
      }

      const monsterId = String(monster.id);
      if (hiddenCompletedMonsterIdSet.has(monsterId)) {
        return false;
      }

      if (isMonsterCompleted(monster) && !completionFxByMonsterId[monsterId]) {
        return false;
      }

      return true;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only hide drag over if we're actually leaving the drop zone
    // (not just moving to a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'monster' && data.monsterId) {
        // Send claim monster message to server
        if (colyseusRoom) {
          colyseusRoom.send('claimMonster', { monsterId: data.monsterId });
        }
        onMonsterDrop?.();
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const playerMonsters = getPlayerMonsters();

  const hasMonsters = playerMonsters.length > 0;
  const showDropZone = hasMonsters || isDragOver || isMonsterBeingDragged;
  const showDragPrompt = isMonsterBeingDragged || isDragOver;

  console.log('PlayerMonsters: hasMonsters:', hasMonsters, 'isDragOver:', isDragOver, 'isMonsterBeingDragged:', isMonsterBeingDragged, 'showDropZone:', showDropZone);

  if (!showDropZone) {
    return null;
  }

  return (
    <div 
      className={`bg-slate-700 border-2 border-slate-600 p-4 rounded flex-1 h-full flex flex-col justify-center transition-all duration-300 ${
        showDragPrompt ? 'ring-4 ring-blue-500 ring-opacity-50 bg-slate-600 shadow-lg' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showDragPrompt && (
        <div className="text-blue-400 text-sm font-bold mb-2 animate-pulse">
          Drop monster here!
        </div>
      )}
      
  {hasMonsters ? (
        <div className="flex gap-4 flex-wrap items-center">
          {playerMonsters.map(monster => (
            <MonsterCard
              key={monster.id}
              monster={monster}
              isOwnedByPlayer={true}
              canDrag={false}
              canSelect={canSelectMonsterSquares}
              selectedSquares={selectedMonsterSquares
                .filter(pos => pos.monsterId === monster.id)
                .map(pos => ({ x: pos.x, y: pos.y }))}
              onSquareClick={onMonsterSquareClick ? (x, y) => onMonsterSquareClick(monster.id, x, y) : undefined}
              horizontalPairPreviewEnabled={showHorizontalPairPreview}
              cunningStepPreviewLength={cunningPreviewStepLength}
              combatBlastPreviewEnabled={showCombatBlastPreview}
              swipePreviewEnabled={showSwipePreview}
              attackAnimations={attackAnimations.filter((attack) => attack.monsterId === monster.id)}
              completionFxPhase={completionFxByMonsterId[String(monster.id)] || null}
              debugModeEnabled={debugModeEnabled}
              onDebugComplete={onDebugCompleteMonster}
              className="monster-owned"
            />
          ))}
        </div>
      ) : isDragOver ? (
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-blue-400 rounded-lg">
          <div className="text-blue-400 text-center">
            <div className="text-2xl mb-2">🎯</div>
            <div>Drop monster here to claim it!</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
