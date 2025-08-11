import React from 'react';
import { DungeonSquare } from '@/types/DungeonSquare';

interface ExitHighlightInfo {
  exitIndex: number;
  isNavigable: boolean;
  isConnected: boolean;
  adjacentCrossedSquares: { x: number; y: number }[];
}

interface SquareProps {
  x: number;
  y: number;
  square: DungeonSquare;
  onClick: (x: number, y: number) => void;
  exitInfo?: ExitHighlightInfo | null;
  isAdjacentToExit?: boolean;
  adjacentExitInfo?: ExitHighlightInfo;
  onExitHover?: (exitIndex: number | null) => void;
  isExitHovered?: boolean;
  showInvalidHighlight?: boolean;
  isSelected?: boolean;
}

const Square: React.FC<SquareProps> = ({ 
  x, 
  y, 
  square, 
  onClick, 
  exitInfo, 
  isAdjacentToExit, 
  adjacentExitInfo, 
  onExitHover, 
  isExitHovered,
  showInvalidHighlight,
  isSelected
}) => {
  // Determine the background color based on the square type
  let bgColor = 'bg-gray-800'; // Default dark background
  let content = '';
  let clickable = true;
  let borderColor = 'border-gray-700';
  let additionalClasses = '';
  let hoverEffect = 'hover:bg-gray-700';

  // Override colors for invalid square highlight (red highlight animation)
  if (showInvalidHighlight) {
    bgColor = 'bg-red-600';
    borderColor = 'border-red-400';
    additionalClasses = 'invalid-square-highlight';
  }

  if (square.wall) {
    bgColor = 'bg-gray-900'; // Darker for walls
    content = ''; // No content for walls
    clickable = false; // Walls are not clickable
    hoverEffect = '';
  } else if (square.entrance) {
    bgColor = 'bg-green-700'; // Green for entrance
    content = 'E';
    borderColor = 'border-green-500';
  } else if (square.exit) {
    // Show X if exit has been crossed OR if it's currently selected for card action
    content = (square.checked || isSelected) ? 'X' : 'D';
    
    // Apply exit highlighting based on navigation eligibility and connection status
    if (exitInfo) {
      if (exitInfo.isNavigable && exitInfo.isConnected) {
        // Navigable and connected - bright green
        bgColor = 'bg-emerald-600';
        borderColor = 'border-emerald-400';
        hoverEffect = 'hover:bg-emerald-500';
        additionalClasses = 'shadow-lg shadow-emerald-500/50';
      } else if (exitInfo.isNavigable && !exitInfo.isConnected) {
        // Navigable but not connected - bright blue
        bgColor = 'bg-blue-600';
        borderColor = 'border-blue-400';
        hoverEffect = 'hover:bg-blue-500';
        additionalClasses = 'shadow-lg shadow-blue-500/50';
      } else if (!exitInfo.isNavigable && exitInfo.isConnected) {
        // Connected but not navigable - dim green
        bgColor = 'bg-green-800';
        borderColor = 'border-green-600';
        hoverEffect = 'hover:bg-green-700';
        additionalClasses = 'opacity-75';
      } else {
        // Not navigable and not connected - dim blue
        bgColor = 'bg-blue-800';
        borderColor = 'border-blue-600';
        hoverEffect = 'hover:bg-blue-700';
        additionalClasses = 'opacity-75';
      }

      // Add pulsing effect when hovered
      if (isExitHovered) {
        additionalClasses += ' animate-pulse';
      }
    } else {
      // Fallback for exits without info
      bgColor = 'bg-blue-700';
      borderColor = 'border-blue-500';
    }
    
    // If exit is selected (for card action), show selection styling
    if (isSelected && !square.checked) {
      // Brighten the background and add selection effects for selected exits
      additionalClasses += ' shadow-lg shadow-blue-500/50 ring-2 ring-blue-400';
      // Keep the exit colors but make them more vibrant to show selection
    } else if (square.checked) {
      // If exit is checked, override with crossed styling while maintaining exit colors
      // Darken the background slightly to indicate it's been used
      if (bgColor.includes('emerald-600')) {
        bgColor = 'bg-emerald-700';
      } else if (bgColor.includes('blue-600')) {
        bgColor = 'bg-blue-700';
      } else if (bgColor.includes('green-800')) {
        bgColor = 'bg-green-900';
      } else if (bgColor.includes('blue-800')) {
        bgColor = 'bg-blue-900';
      } else {
        bgColor = 'bg-blue-800'; // Fallback darkened blue
      }
    }
  } else if (square.checked) {
    content = 'X';
    bgColor = 'bg-gray-700'; // Lighter for checked squares
  } else if (isSelected) {
    // Show X for squares selected during card-based selection
    content = 'X';
    bgColor = 'bg-blue-600'; // Blue background for selected squares
    borderColor = 'border-blue-400';
    additionalClasses = 'shadow-lg shadow-blue-500/50';
  } else if (square.treasure) {
    content = 'T';
    bgColor = 'bg-yellow-700'; // Yellow for treasure
  } else if (square.monster) {
    content = 'M';
    bgColor = 'bg-red-700'; // Red for monsters
  }

  const handleMouseEnter = () => {
    if (square.exit && exitInfo && onExitHover) {
      onExitHover(exitInfo.exitIndex);
    }
  };

  const handleMouseLeave = () => {
    if (square.exit && onExitHover) {
      onExitHover(null);
    }
  };

  return (
    <div
      onClick={() => clickable && onClick(x, y)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex border border-solid border-black/40 items-center justify-center text-2xl ${bgColor} ${clickable ? `cursor-pointer ${hoverEffect}` : ''} ${additionalClasses}`}
      style={{
        width: '40px',
        height: '40px',
        border: `1px solid ${borderColor}`,
        color: 'white',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
      }}
      title={
        square.exit && exitInfo
          ? `Exit ${exitInfo.isNavigable ? '(Navigable)' : '(Blocked)'} - ${exitInfo.isConnected ? 'Connected' : 'Unconnected'}`
          : isAdjacentToExit && adjacentExitInfo
          ? `Adjacent to ${adjacentExitInfo.isNavigable ? 'navigable' : 'blocked'} exit`
          : undefined
      }
    >
      {content}
    </div>
  );
};

export default Square;
