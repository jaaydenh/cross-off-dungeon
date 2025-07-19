import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Grid from '../grid';
import { Room } from '@/types/Room';
import { DungeonSquare } from '@/types/DungeonSquare';
import { ArraySchema } from '@colyseus/schema';

// Mock the Square component to test Grid logic
jest.mock('../square', () => {
  return function MockSquare({ 
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
  }: any) {
    const handleClick = () => onClick(x, y);
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
        data-testid={`square-${x}-${y}`}
        data-exit-navigable={exitInfo?.isNavigable}
        data-exit-connected={exitInfo?.isConnected}
        data-adjacent-to-exit={isAdjacentToExit}
        data-exit-hovered={isExitHovered}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {square.exit ? 'D' : square.entrance ? 'E' : square.checked ? 'X' : square.wall ? '' : '·'}
      </div>
    );
  };
});

describe('Grid Component - Exit Highlighting and User Feedback', () => {
  const createMockSquare = (overrides: Partial<DungeonSquare> = {}): DungeonSquare => {
    const square = new DungeonSquare();
    Object.assign(square, {
      checked: false,
      entrance: false,
      exit: false,
      treasure: false,
      monster: false,
      wall: false,
      ...overrides
    });
    return square;
  };

  const createMockRoom = (width: number, height: number): Room => {
    const room = new Room();
    room.width = width;
    room.height = height;
    room.squares = new ArraySchema<DungeonSquare>();
    room.exitX = new ArraySchema<number>();
    room.exitY = new ArraySchema<number>();
    room.exitDirections = new ArraySchema<string>();
    room.connectedRoomIndices = new ArraySchema<number>();
    room.exitConnected = new ArraySchema<boolean>();
    room.gridX = 0;
    room.gridY = 0;
    room.entranceDirection = "none";
    room.entranceX = -1;
    room.entranceY = -1;

    // Initialize squares
    for (let i = 0; i < width * height; i++) {
      room.squares.push(createMockSquare());
    }

    return room;
  };

  describe('Exit Navigation Eligibility Highlighting', () => {
    it('should highlight navigable exits differently from non-navigable exits', () => {
      const room = createMockRoom(3, 3);
      
      // Add an exit at position (2, 1)
      room.squares[1 * 3 + 2] = createMockSquare({ exit: true });
      room.exitX.push(2);
      room.exitY.push(1);
      room.exitDirections.push('east');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);
      
      // Add a crossed square adjacent to the exit (making it navigable)
      room.squares[1 * 3 + 1] = createMockSquare({ checked: true });

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const exitSquare = screen.getByTestId('square-2-1');
      expect(exitSquare).toHaveAttribute('data-exit-navigable', 'true');
      expect(exitSquare).toHaveAttribute('data-exit-connected', 'false');
    });

    it('should mark exits as non-navigable when no adjacent crossed squares exist', () => {
      const room = createMockRoom(3, 3);
      
      // Add an exit at position (2, 1) with no adjacent crossed squares
      room.squares[1 * 3 + 2] = createMockSquare({ exit: true });
      room.exitX.push(2);
      room.exitY.push(1);
      room.exitDirections.push('east');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const exitSquare = screen.getByTestId('square-2-1');
      expect(exitSquare).toHaveAttribute('data-exit-navigable', 'false');
    });

    it('should correctly identify orthogonally adjacent crossed squares', () => {
      const room = createMockRoom(5, 5);
      
      // Add an exit at center position (2, 2)
      room.squares[2 * 5 + 2] = createMockSquare({ exit: true });
      room.exitX.push(2);
      room.exitY.push(2);
      room.exitDirections.push('north');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);
      
      // Add crossed squares in all four orthogonal directions
      room.squares[1 * 5 + 2] = createMockSquare({ checked: true }); // North
      room.squares[2 * 5 + 3] = createMockSquare({ checked: true }); // East
      room.squares[3 * 5 + 2] = createMockSquare({ checked: true }); // South
      room.squares[2 * 5 + 1] = createMockSquare({ checked: true }); // West
      
      // Add a diagonal crossed square (should not count)
      room.squares[1 * 5 + 1] = createMockSquare({ checked: true }); // Northwest diagonal

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const exitSquare = screen.getByTestId('square-2-2');
      expect(exitSquare).toHaveAttribute('data-exit-navigable', 'true');
    });
  });

  describe('Connected vs Unconnected Exit States', () => {
    it('should show different visual states for connected vs unconnected exits', () => {
      const room = createMockRoom(3, 3);
      
      // Add two exits - one connected, one unconnected
      room.squares[0 * 3 + 2] = createMockSquare({ exit: true });
      room.squares[2 * 3 + 2] = createMockSquare({ exit: true });
      
      room.exitX.push(2, 2);
      room.exitY.push(0, 2);
      room.exitDirections.push('north', 'south');
      room.connectedRoomIndices.push(1, -1);
      room.exitConnected.push(true, false);
      
      // Make both navigable by adding adjacent crossed squares
      room.squares[0 * 3 + 1] = createMockSquare({ checked: true });
      room.squares[2 * 3 + 1] = createMockSquare({ checked: true });

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const connectedExit = screen.getByTestId('square-2-0');
      const unconnectedExit = screen.getByTestId('square-2-2');

      expect(connectedExit).toHaveAttribute('data-exit-connected', 'true');
      expect(unconnectedExit).toHaveAttribute('data-exit-connected', 'false');
    });
  });

  describe('Adjacent Square Highlighting', () => {
    it('should highlight squares adjacent to exits for strategic guidance', () => {
      const room = createMockRoom(3, 3);
      
      // Add an exit at position (1, 0)
      room.squares[0 * 3 + 1] = createMockSquare({ exit: true });
      room.exitX.push(1);
      room.exitY.push(0);
      room.exitDirections.push('north');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      // Check squares adjacent to the exit
      const adjacentSquares = [
        screen.getByTestId('square-0-0'), // West
        screen.getByTestId('square-2-0'), // East
        screen.getByTestId('square-1-1'), // South
      ];

      adjacentSquares.forEach(square => {
        expect(square).toHaveAttribute('data-adjacent-to-exit', 'true');
      });

      // Check that non-adjacent squares are not highlighted
      const nonAdjacentSquare = screen.getByTestId('square-0-1');
      expect(nonAdjacentSquare).toHaveAttribute('data-adjacent-to-exit', 'false');
    });

    it('should not highlight diagonal squares as adjacent to exits', () => {
      const room = createMockRoom(3, 3);
      
      // Add an exit at center position (1, 1)
      room.squares[1 * 3 + 1] = createMockSquare({ exit: true });
      room.exitX.push(1);
      room.exitY.push(1);
      room.exitDirections.push('north');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      // Diagonal squares should not be marked as adjacent
      const diagonalSquares = [
        screen.getByTestId('square-0-0'), // Northwest
        screen.getByTestId('square-2-0'), // Northeast
        screen.getByTestId('square-0-2'), // Southwest
        screen.getByTestId('square-2-2'), // Southeast
      ];

      diagonalSquares.forEach(square => {
        expect(square).toHaveAttribute('data-adjacent-to-exit', 'false');
      });
    });
  });

  describe('Hover Effects and Click Feedback', () => {
    it('should handle exit hover events correctly', async () => {
      const room = createMockRoom(3, 3);
      
      // Add an exit
      room.squares[1 * 3 + 1] = createMockSquare({ exit: true });
      room.exitX.push(1);
      room.exitY.push(1);
      room.exitDirections.push('north');
      room.connectedRoomIndices.push(-1);
      room.exitConnected.push(false);

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const exitSquare = screen.getByTestId('square-1-1');

      // Test hover enter
      fireEvent.mouseEnter(exitSquare);
      await waitFor(() => {
        expect(exitSquare).toHaveAttribute('data-exit-hovered', 'true');
      });

      // Test hover leave
      fireEvent.mouseLeave(exitSquare);
      await waitFor(() => {
        expect(exitSquare).toHaveAttribute('data-exit-hovered', 'false');
      });
    });

    it('should call handleSquareClick when squares are clicked', () => {
      const room = createMockRoom(2, 2);
      const mockHandleClick = jest.fn();
      
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      const square = screen.getByTestId('square-0-0');
      fireEvent.click(square);

      expect(mockHandleClick).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('Complex Exit Scenarios', () => {
    it('should handle multiple exits with different states correctly', () => {
      const room = createMockRoom(4, 4);
      
      // Exit 1: Navigable and connected
      room.squares[0 * 4 + 2] = createMockSquare({ exit: true });
      room.squares[0 * 4 + 1] = createMockSquare({ checked: true }); // Adjacent X
      
      // Exit 2: Not navigable but connected
      room.squares[2 * 4 + 0] = createMockSquare({ exit: true });
      
      // Exit 3: Navigable but not connected
      room.squares[3 * 4 + 2] = createMockSquare({ exit: true });
      room.squares[3 * 4 + 1] = createMockSquare({ checked: true }); // Adjacent X
      
      // Exit 4: Neither navigable nor connected
      room.squares[2 * 4 + 3] = createMockSquare({ exit: true });

      room.exitX.push(2, 0, 2, 3);
      room.exitY.push(0, 2, 3, 2);
      room.exitDirections.push('north', 'west', 'south', 'east');
      room.connectedRoomIndices.push(1, 2, -1, -1);
      room.exitConnected.push(true, true, false, false);

      const mockHandleClick = jest.fn();
      render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);

      // Test each exit state
      const exit1 = screen.getByTestId('square-2-0');
      expect(exit1).toHaveAttribute('data-exit-navigable', 'true');
      expect(exit1).toHaveAttribute('data-exit-connected', 'true');

      const exit2 = screen.getByTestId('square-0-2');
      expect(exit2).toHaveAttribute('data-exit-navigable', 'false');
      expect(exit2).toHaveAttribute('data-exit-connected', 'true');

      const exit3 = screen.getByTestId('square-2-3');
      expect(exit3).toHaveAttribute('data-exit-navigable', 'true');
      expect(exit3).toHaveAttribute('data-exit-connected', 'false');

      const exit4 = screen.getByTestId('square-3-2');
      expect(exit4).toHaveAttribute('data-exit-navigable', 'false');
      expect(exit4).toHaveAttribute('data-exit-connected', 'false');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exits at room boundaries correctly', () => {
      const room = createMockRoom(3, 3);
      
      // Add exits at all boundaries
      room.squares[0 * 3 + 1] = createMockSquare({ exit: true }); // Top
      room.squares[1 * 3 + 0] = createMockSquare({ exit: true }); // Left
      room.squares[1 * 3 + 2] = createMockSquare({ exit: true }); // Right
      room.squares[2 * 3 + 1] = createMockSquare({ exit: true }); // Bottom

      room.exitX.push(1, 0, 2, 1);
      room.exitY.push(0, 1, 1, 2);
      room.exitDirections.push('north', 'west', 'east', 'south');
      room.connectedRoomIndices.push(-1, -1, -1, -1);
      room.exitConnected.push(false, false, false, false);

      const mockHandleClick = jest.fn();
      
      // Should not throw errors
      expect(() => {
        render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);
      }).not.toThrow();
    });

    it('should handle empty room correctly', () => {
      const room = createMockRoom(1, 1);
      const mockHandleClick = jest.fn();
      
      expect(() => {
        render(<Grid room={room} handleSquareClick={mockHandleClick} roomIndex={0} />);
      }).not.toThrow();
    });
  });
});