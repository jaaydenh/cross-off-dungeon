import React from 'react';
import { DungeonSquare } from '@/types/DungeonSquare';

interface SquareProps {
  x: number;
  y: number;
  square: DungeonSquare;
  onClick: (x: number, y: number) => void;
}

const Square: React.FC<SquareProps> = ({ x, y, square, onClick }) => {
  // Determine the background color based on the square type
  let bgColor = 'bg-gray-800'; // Default dark background
  let content = '';
  let clickable = true;

  if (square.wall) {
    bgColor = 'bg-gray-900'; // Darker for walls
    content = ''; // No content for walls
    clickable = false; // Walls are not clickable
  } else if (square.checked) {
    content = 'X';
  } else if (square.entrance) {
    content = 'E';
  } else if (square.exit) {
    content = 'X';
  } else if (square.treasure) {
    content = 'T';
  } else if (square.monster) {
    content = 'M';
  }

  return (
    <div
      onClick={() => clickable && onClick(x, y)}
      className={`flex items-center justify-center text-2xl ${bgColor} ${clickable ? 'cursor-pointer hover:bg-gray-700' : ''}`}
      style={{
        width: '40px',
        height: '40px',
        border: '1px solid rgba(255, 255, 255, 0.2)', // Subtle white border
        color: 'white',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
      }}
    >
      {content}
    </div>
  );
};

export default Square;
