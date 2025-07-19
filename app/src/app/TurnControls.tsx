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
          
          {player.turnStatus === 'playing_turn' && gameState.turnInProgress ? (
            <button
              onClick={handleEndTurn}
              className="turn-button text-white font-bold py-3 px-8 rounded-lg text-xl"
            >
            END TURN
            </button>
          ) : (
            <div className="text-yellow-200 font-bold text-lg">
              {player.turnStatus !== 'playing_turn' ? 'DRAW A CARD TO START YOUR TURN' : 'WAITING FOR TURN TO BEGIN'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}