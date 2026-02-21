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
  let textColorClass = 'text-white';
  let fillColor = '#e9e1d2';
  const fontPx = Math.max(12, Math.min(28, Math.round(sizePx * 0.55)));
  const textureOffsetX = (x * 7 + y * 5) % 24;
  const textureOffsetY = (x * 11 + y * 3) % 24;

  if (square.wall) {
    bgColor = 'bg-gray-900'; // Darker for walls
    content = ''; // No content for walls
    clickable = false; // Walls are not clickable
    hoverEffect = '';
    fillColor = '#4d4e56';
  } else if (square.entrance) {
    bgColor = 'bg-stone-200';
    content = square.checked ? 'X' : '';
    borderColor = 'border-stone-500';
    textColorClass = 'text-stone-900';
    fillColor = '#e8dfcf';
  } else if (square.exit) {
    // Doorway icon-only presentation (no letter labels).
    content = (square.checked || isSelected) ? 'X' : '';
    textColorClass = 'text-stone-900';
    
    // Apply exit highlighting based on navigation eligibility and connection status
    if (exitInfo) {
      if (exitInfo.isNavigable && exitInfo.isConnected) {
        bgColor = 'bg-stone-200';
        borderColor = 'border-stone-600';
        additionalClasses = 'shadow-lg shadow-black/25';
        fillColor = '#e8dfcf';
      } else if (exitInfo.isNavigable && !exitInfo.isConnected) {
        bgColor = 'bg-stone-200';
        borderColor = 'border-stone-600';
        additionalClasses = 'shadow-lg shadow-black/25';
        fillColor = '#e8dfcf';
      } else if (!exitInfo.isNavigable && exitInfo.isConnected) {
        bgColor = 'bg-stone-300';
        borderColor = 'border-stone-700';
        hoverEffect = 'hover:bg-stone-200';
        additionalClasses = 'opacity-75';
        fillColor = '#d9cfbd';
      } else {
        bgColor = 'bg-stone-300';
        borderColor = 'border-stone-700';
        hoverEffect = 'hover:bg-stone-200';
        additionalClasses = 'opacity-75';
        fillColor = '#d9cfbd';
      }

      // Add pulsing effect when hovered
      if (isExitHovered) {
        additionalClasses += ' animate-pulse';
      }
    } else {
      // Fallback for exits without info
      bgColor = 'bg-stone-200';
      borderColor = 'border-stone-600';
      fillColor = '#e8dfcf';
    }
    
    // If exit is selected (for card action), match pending-selection styling
    if (isSelected && !square.checked) {
      bgColor = 'bg-blue-600';
      borderColor = 'border-blue-400';
      additionalClasses = `${additionalClasses} ring-2 ring-sky-400 shadow-lg shadow-blue-500/50`.trim();
      fillColor = '#5d77b3';
    } else if (square.checked) {
      fillColor = '#d6cab5';
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

  // Invalid move highlight must win over any square-type styling (including exits/walls).
  if (showInvalidHighlight) {
    bgColor = 'bg-red-600';
    borderColor = 'border-red-400';
    hoverEffect = '';
    textColorClass = 'text-white';
    additionalClasses = `${additionalClasses} invalid-square-highlight`.trim();
    fillColor = '#d94a4a';
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
  const showTopDivider = y > 0;
  const showLeftDivider = x > 0;
  const backgroundLayers = [textureImage];
  const backgroundSizes = [textureSize];
  const backgroundPositions = [`${textureOffsetX}px ${textureOffsetY}px`];
  const backgroundRepeats = ['repeat'];

  if (showTopDivider) {
    backgroundLayers.push(dividerDotPattern);
    backgroundSizes.push(`${DIVIDER_DOT_SPACING_PX}px 2px`);
    backgroundPositions.push('0 0');
    backgroundRepeats.push('repeat-x');
  }

  if (showLeftDivider) {
    backgroundLayers.push(dividerDotPattern);
    backgroundSizes.push(`2px ${DIVIDER_DOT_SPACING_PX}px`);
    backgroundPositions.push('0 0');
    backgroundRepeats.push('repeat-y');
  }

  return (
    <div
      role="button"
      tabIndex={clickable ? 0 : -1}
      onClick={() => onClick(x, y)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(x, y); } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center justify-center font-bold ${textColorClass} border ${bgColor} ${borderColor} ${clickable ? `cursor-pointer ${hoverEffect}` : ''} ${additionalClasses}`}
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        fontSize: `${fontPx}px`,
        lineHeight: 1,
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        backgroundColor: fillColor,
        backgroundImage: backgroundLayers.join(', '),
        backgroundSize: backgroundSizes.join(', '),
        backgroundPosition: backgroundPositions.join(', '),
        backgroundRepeat: backgroundRepeats.join(', '),
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
