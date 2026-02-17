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
  onHover?: (x: number, y: number) => void;
  onHoverEnd?: () => void;
  sizePx?: number;
  exitInfo?: ExitHighlightInfo | null;
  isAdjacentToExit?: boolean;
  adjacentExitInfo?: ExitHighlightInfo;
  onExitHover?: (exitIndex: number | null) => void;
  isExitHovered?: boolean;
  showInvalidHighlight?: boolean;
  isSelected?: boolean;
}

const PENCIL_PAPER_TEXTURE =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27%3E%3Cg fill=%27%23000000%27 fill-opacity=%270.16%27%3E%3Ccircle cx=%273%27 cy=%274%27 r=%270.65%27/%3E%3Ccircle cx=%2710%27 cy=%278%27 r=%270.55%27/%3E%3Ccircle cx=%2719%27 cy=%275%27 r=%270.6%27/%3E%3Ccircle cx=%276%27 cy=%2716%27 r=%270.55%27/%3E%3Ccircle cx=%2715%27 cy=%2713%27 r=%270.65%27/%3E%3Ccircle cx=%2721%27 cy=%2719%27 r=%270.55%27/%3E%3Ccircle cx=%278%27 cy=%2722%27 r=%270.6%27/%3E%3C/g%3E%3C/svg%3E")';
const PENCIL_HATCH_TEXTURE =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M0 4 L4 0 M4 16 L16 4 M0 12 L12 0 M8 16 L16 8%27 stroke=%27%23000000%27 stroke-opacity=%270.26%27 stroke-width=%271%27 stroke-linecap=%27round%27 fill=%27none%27/%3E%3C/svg%3E")';
const DIVIDER_DOT_SPACING_PX = 7;

const Square: React.FC<SquareProps> = ({ 
  x, 
  y, 
  square, 
  onClick, 
  onHover,
  onHoverEnd,
  sizePx = 42,
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
  let fillColor = '#e9e1d2';
  const fontPx = Math.max(12, Math.min(28, Math.round(sizePx * 0.55)));
  const textureOffsetX = (x * 7 + y * 5) % 24;
  const textureOffsetY = (x * 11 + y * 3) % 24;

  // Override colors for invalid square highlight (red highlight animation)
  if (showInvalidHighlight) {
    bgColor = 'bg-red-600';
    borderColor = 'border-red-400';
    additionalClasses = 'invalid-square-highlight';
    fillColor = '#d94a4a';
  }

  if (square.wall) {
    bgColor = 'bg-gray-900'; // Darker for walls
    content = ''; // No content for walls
    clickable = false; // Walls are not clickable
    hoverEffect = '';
    fillColor = '#4d4e56';
  } else if (square.entrance) {
    bgColor = 'bg-green-700'; // Green for entrance
    content = 'E';
    borderColor = 'border-green-500';
    fillColor = '#2f9152';
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
        fillColor = '#3e9772';
      } else if (exitInfo.isNavigable && !exitInfo.isConnected) {
        // Navigable but not connected - bright blue
        bgColor = 'bg-blue-600';
        borderColor = 'border-blue-400';
        hoverEffect = 'hover:bg-blue-500';
        additionalClasses = 'shadow-lg shadow-blue-500/50';
        fillColor = '#5d77b3';
      } else if (!exitInfo.isNavigable && exitInfo.isConnected) {
        // Connected but not navigable - dim green
        bgColor = 'bg-green-800';
        borderColor = 'border-green-600';
        hoverEffect = 'hover:bg-green-700';
        additionalClasses = 'opacity-75';
        fillColor = '#587665';
      } else {
        // Not navigable and not connected - dim blue
        bgColor = 'bg-blue-800';
        borderColor = 'border-blue-600';
        hoverEffect = 'hover:bg-blue-700';
        additionalClasses = 'opacity-75';
        fillColor = '#5f6885';
      }

      // Add pulsing effect when hovered
      if (isExitHovered) {
        additionalClasses += ' animate-pulse';
      }
    } else {
      // Fallback for exits without info
      bgColor = 'bg-blue-700';
      borderColor = 'border-blue-500';
      fillColor = '#5d77b3';
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
        fillColor = '#347f61';
      } else if (bgColor.includes('blue-600')) {
        bgColor = 'bg-blue-700';
        fillColor = '#4f679d';
      } else if (bgColor.includes('green-800')) {
        bgColor = 'bg-green-900';
        fillColor = '#4b6759';
      } else if (bgColor.includes('blue-800')) {
        bgColor = 'bg-blue-900';
        fillColor = '#4e5771';
      } else {
        bgColor = 'bg-blue-800'; // Fallback darkened blue
        fillColor = '#4e5771';
      }
    }
  } else if (square.checked) {
    content = 'X';
    bgColor = 'bg-gray-700'; // Lighter for checked squares
    fillColor = '#b0a997';
  } else if (isSelected) {
    // Show X for squares selected during card-based selection
    content = 'X';
    bgColor = 'bg-blue-600'; // Blue background for selected squares
    borderColor = 'border-blue-400';
    additionalClasses = 'shadow-lg shadow-blue-500/50';
    fillColor = '#5d77b3';
  } else if (square.treasure) {
    content = 'T';
    bgColor = 'bg-yellow-700'; // Yellow for treasure
    fillColor = '#b48f3d';
  } else if (square.monster) {
    content = 'M';
    bgColor = 'bg-red-700'; // Red for monsters
    fillColor = '#9d5454';
  }

  const handleMouseEnter = () => {
    onHover?.(x, y);
    if (square.exit && exitInfo && onExitHover) {
      onExitHover(exitInfo.exitIndex);
    }
  };

  const handleMouseLeave = () => {
    onHoverEnd?.();
    if (square.exit && onExitHover) {
      onExitHover(null);
    }
  };

  const textureImage = square.wall ? PENCIL_HATCH_TEXTURE : PENCIL_PAPER_TEXTURE;
  const textureSize = square.wall ? '16px 16px' : '24px 24px';
  const dividerDotColor = square.wall ? 'rgba(180, 185, 200, 0.4)' : 'rgba(24, 24, 24, 0.55)';
  const dividerDotPattern = `radial-gradient(circle, ${dividerDotColor} 1px, transparent 1.3px)`;

  return (
    <div
      onClick={() => clickable && onClick(x, y)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex items-center justify-center font-bold text-white border ${bgColor} ${borderColor} ${clickable ? `cursor-pointer ${hoverEffect}` : ''} ${additionalClasses}`}
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        fontSize: `${fontPx}px`,
        lineHeight: 1,
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        backgroundColor: fillColor,
        backgroundImage: `${textureImage}, ${dividerDotPattern}, ${dividerDotPattern}`,
        backgroundSize: `${textureSize}, ${DIVIDER_DOT_SPACING_PX}px 2px, 2px ${DIVIDER_DOT_SPACING_PX}px`,
        backgroundPosition: `${textureOffsetX}px ${textureOffsetY}px, 0 0, 0 0`,
        backgroundRepeat: 'repeat, repeat-x, repeat-y',
        borderStyle: 'solid',
        borderWidth: '0px',
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
