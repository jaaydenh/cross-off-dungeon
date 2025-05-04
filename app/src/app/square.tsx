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
  let borderColor = 'border-gray-700';

  if (square.wall) {
    bgColor = 'bg-gray-900'; // Darker for walls
    content = ''; // No content for walls
    clickable = false; // Walls are not clickable
  } else if (square.entrance) {
    bgColor = 'bg-green-700'; // Green for entrance
    content = 'E';
    borderColor = 'border-green-500';
  } else if (square.exit) {
    bgColor = 'bg-blue-700'; // Blue for exit
    content = 'X';
    borderColor = 'border-blue-500';
  } else if (square.checked) {
    content = 'X';
    bgColor = 'bg-gray-700'; // Lighter for checked squares
  } else if (square.treasure) {
    content = 'T';
    bgColor = 'bg-yellow-700'; // Yellow for treasure
  } else if (square.monster) {
    content = 'M';
    bgColor = 'bg-red-700'; // Red for monsters
  }

  return (
    <div
      onClick={() => clickable && onClick(x, y)}
      className={`flex items-center justify-center text-2xl ${bgColor} ${clickable ? 'cursor-pointer hover:bg-gray-700' : ''}`}
      style={{
        width: '40px',
        height: '40px',
        border: `1px solid ${borderColor}`,
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
