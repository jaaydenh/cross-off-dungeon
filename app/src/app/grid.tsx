import React from 'react';
import Square from './square';
import { Room } from '@/types/Room';

interface GridProps {
  room: Room;
  handleSquareClick: (x: number, y: number) => void;
}

const Grid: React.FC<GridProps> = ({ room, handleSquareClick }) => {
  const renderSquares = () => {
    const squares = [];
    
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const index = y * room.width + x;
        const square = room.squares[index];
        
        if (square) {
          squares.push(
            <Square
              key={`${x}-${y}`}
              x={x}
              y={y}
              square={square}
              onClick={handleSquareClick}
            />
          );
        }
      }
    }
    
    return squares;
  };

  return (
    <div 
      className="flex flex-wrap bg-black p-1 mx-auto"
      style={{ 
        width: `${room.width * 42}px`,
        maxWidth: '100%',
        overflow: 'auto'
      }}
    >
      {renderSquares()}
    </div>
  );
};

export default Grid;
