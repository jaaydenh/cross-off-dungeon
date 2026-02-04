import React from 'react';
import { render, screen } from '@testing-library/react';
import DungeonMap from '../DungeonMap';
import { Room } from '@/types/Room';
import { DungeonSquare } from '@/types/DungeonSquare';
import { Player } from '@/types/Player';
import { ArraySchema } from '@colyseus/schema';

// Mock the Grid component since we're testing DungeonMap positioning logic
jest.mock('../grid', () => {
    return function MockGrid({ room }: { room: Room }) {
        return (
            <div data-testid={`grid-${room.gridX}-${room.gridY}`}>
                Mock Grid for Room ({room.gridX}, {room.gridY})
            </div>
        );
    };
});

// Helper function to create a mock room with grid coordinates
const createMockRoom = (gridX: number, gridY: number, width: number = 8, height: number = 8): Room => {
    const room = new Room();
    room.width = width;
    room.height = height;
    room.gridX = gridX;
    room.gridY = gridY;

    // Initialize squares
    room.squares = new ArraySchema<DungeonSquare>();
    for (let i = 0; i < width * height; i++) {
        const square = new DungeonSquare();
        room.squares.push(square);
    }

    // Initialize exit arrays
    room.exitDirections = new ArraySchema<string>();
    room.exitX = new ArraySchema<number>();
    room.exitY = new ArraySchema<number>();
    room.connectedRoomIndices = new ArraySchema<number>();
    room.exitConnected = new ArraySchema<boolean>();

    return room;
};

// Helper function to add an exit to a room
const addExitToRoom = (room: Room, direction: string, connected: boolean = false, connectedRoomIndex: number = -1) => {
    room.exitDirections.push(direction);
    room.exitX.push(direction === 'east' ? room.width - 1 : direction === 'west' ? 0 : Math.floor(room.width / 2));
    room.exitY.push(direction === 'north' ? 0 : direction === 'south' ? room.height - 1 : Math.floor(room.height / 2));
    room.connectedRoomIndices.push(connectedRoomIndex);
    room.exitConnected.push(connected);
};

describe('DungeonMap Grid Positioning', () => {
    const mockHandleSquareClick = jest.fn();
    const mockPlayer = null; // Most tests don't need a specific player
    const mockColyseusRoom = {}; // Mock Colyseus room object
    const mockGameState = null;

    beforeEach(() => {
        mockHandleSquareClick.mockClear();
    });

    test('should use actual grid coordinates from Room schema instead of passed x,y coordinates', () => {
        // Create rooms with different grid coordinates vs passed coordinates
        const room1 = createMockRoom(0, 0);
        const room2 = createMockRoom(2, 1);

        const rooms = [
            { room: room1, x: 100, y: 200 }, // These x,y should be ignored
            { room: room2, x: 300, y: 400 }, // These x,y should be ignored
        ];

        render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        // Verify that rooms are positioned based on their gridX, gridY properties
        expect(screen.getByTestId('grid-0-0')).toBeInTheDocument();
        expect(screen.getByTestId('grid-2-1')).toBeInTheDocument();

        // Verify room coordinate labels are displayed
        expect(screen.getByText('Room (0, 0)')).toBeInTheDocument();
        expect(screen.getByText('Room (2, 1)')).toBeInTheDocument();
    });

    test('should implement consistent spacing between rooms based on grid layout', () => {
        const room1 = createMockRoom(0, 0);
        const room2 = createMockRoom(1, 0);
        const room3 = createMockRoom(0, 1);

        const rooms = [
            { room: room1, x: 0, y: 0 },
            { room: room2, x: 0, y: 0 },
            { room: room3, x: 0, y: 0 },
        ];

        const { container } = render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        const room00 = screen.getByText('Room (0, 0)').closest('div.absolute.border-2.border-slate-600') as HTMLElement;
        const room10 = screen.getByText('Room (1, 0)').closest('div.absolute.border-2.border-slate-600') as HTMLElement;
        const room01 = screen.getByText('Room (0, 1)').closest('div.absolute.border-2.border-slate-600') as HTMLElement;

        expect(room00).toBeTruthy();
        expect(room10).toBeTruthy();
        expect(room01).toBeTruthy();

        // Verify consistent spacing (based on internal constants)
        expect(room00.style.left).toBe('300px');
        expect(room00.style.top).toBe('300px');
        expect(room10.style.left).toBe('960px'); // 300 + (600 + 60)
        expect(room10.style.top).toBe('300px');
        expect(room01.style.left).toBe('300px');
        expect(room01.style.top).toBe('670px'); // 300 + (310 + 60)

        // Verify room sizing: height fixed, width based on room grid width
        [room00, room10, room01].forEach(roomContainer => {
            expect(roomContainer.style.height).toBe('310px');
            expect(roomContainer.style.width).toBe(`${8 * 42 + 16}px`);
        });
    });

    test('should show grid-based relationships clearly with room coordinate labels', () => {
        const room1 = createMockRoom(0, 0);
        const room2 = createMockRoom(1, 1);
        const room3 = createMockRoom(-1, 2);

        const rooms = [
            { room: room1, x: 0, y: 0 },
            { room: room2, x: 0, y: 0 },
            { room: room3, x: 0, y: 0 },
        ];

        render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        // Verify coordinate labels are displayed for each room
        expect(screen.getByText('Room (0, 0)')).toBeInTheDocument();
        expect(screen.getByText('Room (1, 1)')).toBeInTheDocument();
        expect(screen.getByText('Room (-1, 2)')).toBeInTheDocument();
    });

    test('should add visual connection indicators between rooms with aligned exits', () => {
        // Create two adjacent rooms with connected exits
        const room1 = createMockRoom(0, 0);
        const room2 = createMockRoom(1, 0);

        // Add connected exits
        addExitToRoom(room1, 'east', true, 1);
        addExitToRoom(room2, 'west', true, 0);

        const rooms = [
            { room: room1, x: 0, y: 0 },
            { room: room2, x: 0, y: 0 },
        ];

        const { container } = render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        // Look for connection lines by their CSS classes
        const connectionLines = container.querySelectorAll('.bg-green-400.opacity-60');
        expect(connectionLines.length).toBeGreaterThan(0);

        // Verify connection line has proper styling
        const connectionLine = connectionLines[0] as HTMLElement;
        expect(connectionLine.style.height).toBe('4px');
        expect(connectionLine.className).toContain('bg-green-400');
        expect(connectionLine.className).toContain('opacity-60');
    });

    test('should handle rooms at negative grid coordinates correctly', () => {
        const room1 = createMockRoom(-2, -1);
        const room2 = createMockRoom(0, 0);
        const room3 = createMockRoom(1, 2);

        const rooms = [
            { room: room1, x: 0, y: 0 },
            { room: room2, x: 0, y: 0 },
            { room: room3, x: 0, y: 0 },
        ];

        render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        // All rooms should be rendered regardless of negative coordinates
        expect(screen.getByText('Room (-2, -1)')).toBeInTheDocument();
        expect(screen.getByText('Room (0, 0)')).toBeInTheDocument();
        expect(screen.getByText('Room (1, 2)')).toBeInTheDocument();
    });

    test('should not show connection indicators for unconnected exits', () => {
        // Create two adjacent rooms with unconnected exits
        const room1 = createMockRoom(0, 0);
        const room2 = createMockRoom(1, 0);

        // Add unconnected exits
        addExitToRoom(room1, 'east', false, -1);
        addExitToRoom(room2, 'west', false, -1);

        const rooms = [
            { room: room1, x: 0, y: 0 },
            { room: room2, x: 0, y: 0 },
        ];

        const { container } = render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        // Should not have connection lines for unconnected exits
        const connectionLines = container.querySelectorAll('.bg-green-400.opacity-60');
        expect(connectionLines).toHaveLength(0);
    });

    test('should size rooms based on their grid content size', () => {
        // Create rooms with different internal dimensions
        const smallRoom = createMockRoom(0, 0, 6, 6);
        const largeRoom = createMockRoom(1, 0, 10, 10);

        const rooms = [
            { room: smallRoom, x: 0, y: 0 },
            { room: largeRoom, x: 0, y: 0 },
        ];

        render(<DungeonMap rooms={rooms} handleSquareClick={mockHandleSquareClick} player={mockPlayer} colyseusRoom={mockColyseusRoom} gameState={mockGameState} />);

        const smallRoomContainer = screen.getByText('Room (0, 0)').closest('div.absolute.border-2.border-slate-600') as HTMLElement;
        const largeRoomContainer = screen.getByText('Room (1, 0)').closest('div.absolute.border-2.border-slate-600') as HTMLElement;

        expect(smallRoomContainer).toBeTruthy();
        expect(largeRoomContainer).toBeTruthy();

        // Both rooms should keep a consistent height but their width depends on the room grid width
        expect(smallRoomContainer.style.height).toBe('310px');
        expect(largeRoomContainer.style.height).toBe('310px');
        expect(smallRoomContainer.style.width).toBe(`${6 * 42 + 16}px`);
        expect(largeRoomContainer.style.width).toBe(`${10 * 42 + 16}px`);
    });
});
