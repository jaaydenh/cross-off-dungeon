'use client';

import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { Player } from '@/types/Player';
import { DungeonState } from '@/types/DungeonState';
import { Room } from 'colyseus.js';
import MonsterCard from './MonsterCard';
import { useState } from 'react';

interface PlayerMonstersProps {
  gameState: DungeonState;
  currentPlayer: Player | null;
  colyseusRoom: Room | null;
  isMonsterBeingDragged?: boolean;
}

export default function PlayerMonsters({
  gameState,
  currentPlayer,
  colyseusRoom,
  isMonsterBeingDragged = false
}: PlayerMonstersProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleMonsterSquareClick = (monsterId: string, x: number, y: number) => {
    if (!colyseusRoom) return;
    
    colyseusRoom.send('crossMonsterSquare', { monsterId, x, y });
  };

  const getPlayerMonsters = (): MonsterCardType[] => {
    if (!gameState?.activeMonsters || !currentPlayer) return [];
    
    return gameState.activeMonsters.filter(monster => 
      monster.playerOwnerId === colyseusRoom?.sessionId
    );
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
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const playerMonsters = getPlayerMonsters();

  const hasMonsters = playerMonsters.length > 0;
  const showDropZone = hasMonsters || isDragOver || isMonsterBeingDragged;

  console.log('PlayerMonsters: hasMonsters:', hasMonsters, 'isDragOver:', isDragOver, 'isMonsterBeingDragged:', isMonsterBeingDragged, 'showDropZone:', showDropZone);

  if (!showDropZone) {
    return null;
  }

  return (
    <div 
      className={`bg-slate-700 p-4 rounded flex-1 transition-all duration-300 ${
        isDragOver ? 'ring-4 ring-blue-500 ring-opacity-50 bg-slate-600 shadow-lg' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-white text-sm font-bold mb-2 flex items-center gap-2">
        <span>Your Monsters</span>
        {isDragOver && (
          <span className="text-blue-400 animate-pulse">Drop monster here!</span>
        )}
      </div>
      
      {hasMonsters ? (
        <div className="flex gap-4 flex-wrap">
          {playerMonsters.map(monster => (
            <MonsterCard
              key={monster.id}
              monster={monster}
              isOwnedByPlayer={true}
              canDrag={false}
              onSquareClick={(x, y) => handleMonsterSquareClick(monster.id, x, y)}
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