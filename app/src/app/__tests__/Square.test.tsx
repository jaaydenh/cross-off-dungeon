import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Square from '../square';
import { DungeonSquare } from '@/types/DungeonSquare';

describe('Square Component - Exit Highlighting and Visual Feedback', () => {
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

  const mockExitInfo = {
    exitIndex: 0,
    isNavigable: true,
    isConnected: true,
    adjacentCrossedSquares: [{ x: 1, y: 0 }]
  };

  describe('Exit Visual States', () => {
    it('should apply correct styling for navigable and connected exits', () => {
      const exitSquare = createMockSquare({ exit: true });
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={mockExitInfo}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveClass('bg-emerald-600');
      expect(square).toHaveClass('shadow-lg');
      expect(square).toHaveClass('shadow-emerald-500/50');
    });

    it('should apply correct styling for navigable but unconnected exits', () => {
      const exitSquare = createMockSquare({ exit: true });
      const unconnectedExitInfo = { ...mockExitInfo, isConnected: false };
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={unconnectedExitInfo}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveClass('bg-blue-600');
      expect(square).toHaveClass('shadow-lg');
      expect(square).toHaveClass('shadow-blue-500/50');
    });

    it('should apply correct styling for connected but non-navigable exits', () => {
      const exitSquare = createMockSquare({ exit: true });
      const nonNavigableExitInfo = { ...mockExitInfo, isNavigable: false };
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={nonNavigableExitInfo}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveClass('bg-green-800');
      expect(square).toHaveClass('opacity-75');
    });

    it('should apply correct styling for non-navigable and unconnected exits', () => {
      const exitSquare = createMockSquare({ exit: true });
      const blockedExitInfo = { ...mockExitInfo, isNavigable: false, isConnected: false };
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={blockedExitInfo}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveClass('bg-blue-800');
      expect(square).toHaveClass('opacity-75');
    });

    it('should add pulsing animation when exit is hovered', () => {
      const exitSquare = createMockSquare({ exit: true });
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={mockExitInfo}
          isExitHovered={true}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveClass('animate-pulse');
    });
  });

  describe('Hover Effects and Interaction', () => {
    it('should call onExitHover when exit is hovered', () => {
      const exitSquare = createMockSquare({ exit: true });
      const mockOnClick = jest.fn();
      const mockOnExitHover = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={mockExitInfo}
          onExitHover={mockOnExitHover}
        />
      );

      const square = screen.getByText('D');

      fireEvent.mouseEnter(square);
      expect(mockOnExitHover).toHaveBeenCalledWith(0);

      fireEvent.mouseLeave(square);
      expect(mockOnExitHover).toHaveBeenCalledWith(null);
    });

    it('should not call onExitHover for non-exit squares', () => {
      const regularSquare = createMockSquare();
      const mockOnClick = jest.fn();
      const mockOnExitHover = jest.fn();

      const { container } = render(
        <Square
          x={0}
          y={0}
          square={regularSquare}
          onClick={mockOnClick}
          onExitHover={mockOnExitHover}
        />
      );

      const square = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(square);
      fireEvent.mouseLeave(square);

      expect(mockOnExitHover).not.toHaveBeenCalled();
    });

    it('should show appropriate tooltips for exits', () => {
      const exitSquare = createMockSquare({ exit: true });
      const mockOnClick = jest.fn();

      render(
        <Square
          x={0}
          y={0}
          square={exitSquare}
          onClick={mockOnClick}
          exitInfo={mockExitInfo}
        />
      );

      const square = screen.getByText('D');
      expect(square).toHaveAttribute('title', 'Exit (Navigable) - Connected');
    });

    it('should show appropriate tooltips for squares adjacent to exits', () => {
      const regularSquare = createMockSquare();
      const mockOnClick = jest.fn();

      const { container } = render(
        <Square
          x={0}
          y={0}
          square={regularSquare}
          onClick={mockOnClick}
          isAdjacentToExit={true}
          adjacentExitInfo={mockExitInfo}
        />
      );

      const square = container.firstChild as HTMLElement;
      expect(square).toHaveAttribute('title', 'Adjacent to navigable exit');
    });

    it('should handle click events correctly', () => {
      const regularSquare = createMockSquare();
      const mockOnClick = jest.fn();

      const { container } = render(
        <Square
          x={2}
          y={3}
          square={regularSquare}
          onClick={mockOnClick}
        />
      );

      const square = container.firstChild as HTMLElement;
      fireEvent.click(square);

      expect(mockOnClick).toHaveBeenCalledWith(2, 3);
    });

    it('should not be clickable for wall squares', () => {
      const wallSquare = createMockSquare({ wall: true });
      const mockOnClick = jest.fn();

      const { container } = render(
        <Square
          x={0}
          y={0}
          square={wallSquare}
          onClick={mockOnClick}
        />
      );

      const square = container.firstChild as HTMLElement;
      fireEvent.click(square);

      expect(mockOnClick).not.toHaveBeenCalled();
      expect(square).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain consistent styling for different square types', () => {
      const squares = [
        { square: createMockSquare({ entrance: true }), content: 'E', expectedBg: 'bg-green-700' },
        { square: createMockSquare({ treasure: true }), content: 'T', expectedBg: 'bg-yellow-700' },
        { square: createMockSquare({ monster: true }), content: 'M', expectedBg: 'bg-red-700' },
        { square: createMockSquare({ checked: true }), content: 'X', expectedBg: 'bg-gray-700' },
      ];

      squares.forEach(({ square, content, expectedBg }) => {
        const { unmount } = render(
          <Square
            x={0}
            y={0}
            square={square}
            onClick={jest.fn()}
          />
        );

        const element = screen.getByText(content);
        expect(element).toHaveClass(expectedBg);

        unmount();
      });

      // Test wall square separately since it has empty content
      const { container } = render(
        <Square
          x={0}
          y={0}
          square={createMockSquare({ wall: true })}
          onClick={jest.fn()}
        />
      );

      const wallElement = container.firstChild as HTMLElement;
      expect(wallElement).toHaveClass('bg-gray-900');
    });

    it('should apply transition effects consistently', () => {
      const regularSquare = createMockSquare();
      const mockOnClick = jest.fn();

      const { container } = render(
        <Square
          x={0}
          y={0}
          square={regularSquare}
          onClick={mockOnClick}
        />
      );

      const square = container.firstChild as HTMLElement;
      expect(square).toHaveStyle('transition: all 0.2s ease');
    });
  });
});