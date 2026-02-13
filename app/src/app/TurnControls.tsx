'use client';

import { Player } from '@/types/Player';
import { DungeonState } from '@/types/DungeonState';
import { Room } from 'colyseus.js';

interface TurnControlsProps {
  player: Player | null;
  gameState: DungeonState | null;
  room: Room | null;
}

export default function TurnControls({ player, gameState, room }: TurnControlsProps) {
  console.log('TurnControls RENDER:', {
    hasPlayer: !!player,
    hasGameState: !!gameState,
    hasRoom: !!room,
    playerTurnStatus: player?.turnStatus,
    turnInProgress: gameState?.turnInProgress,
    playerName: player?.name
  });

  const hasActiveCard = player?.drawnCards?.some(card => card.isActive) || false;
  const gameStatus = gameState?.gameStatus || 'in_progress';

  const handleEndTurn = () => {
    if (room && player) {
      console.log('Ending turn for player:', player.name);
      room.send('endTurn');
    }
  };

  // ALWAYS show something very obvious
  return (
    <div>
      {!player || !gameState || !room ? (
        <div className="text-white text-center font-bold">
          LOADING: P:{!!player ? 'YES' : 'NO'} | G:{!!gameState ? 'YES' : 'NO'} | R:{!!room ? 'YES' : 'NO'}
        </div>
      ) : (
        <div className="text-center">
          <div className="text-slate-300 text-sm mb-2">
            Day {gameState.currentDay}/{gameState.maxDays}
          </div>
          {gameStatus === 'won' && (
            <div className="text-emerald-300 font-bold text-lg">Boss defeated. Victory!</div>
          )}
          {gameStatus === 'lost' && (
            <div className="text-rose-300 font-bold text-lg">Day limit reached. Defeat.</div>
          )}
          
          {gameStatus === 'in_progress' && player.turnStatus === 'playing_turn' && gameState.turnInProgress ? (
            <div className="space-y-2">
              <button
                onClick={handleEndTurn}
                disabled={hasActiveCard}
                className={`turn-button text-white font-bold py-3 px-8 rounded-lg text-xl ${hasActiveCard ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                END TURN
              </button>
              {hasActiveCard && (
                <div className="text-yellow-200 font-bold text-sm">
                  Confirm or cancel your card action first
                </div>
              )}
            </div>
          ) : gameStatus === 'in_progress' ? (
            <div className="text-yellow-200 font-bold text-lg">
              {player.turnStatus !== 'playing_turn' ? 'DRAW A CARD TO START YOUR TURN' : 'WAITING FOR TURN TO BEGIN'}
            </div>
          ) : null}
          {gameStatus !== 'in_progress' && (
            <div className="text-slate-200 text-sm mt-2">The run has ended.</div>
          )}
        </div>
      )}
    </div>
  );
}
