'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import { Room as DungeonRoom } from '@/types/Room';
import DungeonMap from './DungeonMap';
import CardDeck from './CardDeck';
import DrawnCard from './DrawnCard';
import DiscardPile from './DiscardPile';
import TurnControls from './TurnControls';
import CancelButton from './CancelButton';
import ConfirmMoveButton from './ConfirmMoveButton';
import PlayerMonsters from './PlayerMonsters';
import { MonsterAttackAnimation } from '@/types/MonsterAttack';
import CardFaceContent from './CardFaceContent';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState { }

export default function Game() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoom | null>(null);
  const [displayedRooms, setDisplayedRooms] = useState<{ room: DungeonRoom, x: number, y: number }[]>([]);
  const [gameState, setGameState] = useState<DungeonState | null>(null);
  // Add a state update counter to force re-renders
  const [updateCounter, setUpdateCounter] = useState(0);

  // Card-based square selection state
  const [selectedSquares, setSelectedSquares] = useState<
    Array<{ roomIndex: number; x: number; y: number; serverRoomIndex?: number }>
  >([]);
  const [selectedMonsterSquares, setSelectedMonsterSquares] = useState<Array<{ monsterId: string, x: number, y: number }>>([]);
  const [invalidSquareHighlight, setInvalidSquareHighlight] = useState<{ roomIndex: number, x: number, y: number } | null>(null);
  
  // Monster drag and drop state
  const [isMonsterBeingDragged, setIsMonsterBeingDragged] = useState(false);
  const [monsterAttackAnimations, setMonsterAttackAnimations] = useState<MonsterAttackAnimation[]>([]);
  const [deckReturnAnimations, setDeckReturnAnimations] = useState<Array<{
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    delayMs: number;
    card: { type: string; description: string; defenseSymbol: string };
  }>>([]);
  const [dayBanner, setDayBanner] = useState<string | null>(null);
  const [gameResultBanner, setGameResultBanner] = useState<string | null>(null);
  const dayBannerTimeoutRef = useRef<any>(null);
  const lastAnnouncedDayRef = useRef<number | null>(null);
  const lastGameStatusRef = useRef<string | null>(null);

  const activeCard = currentPlayer?.drawnCards?.find((card) => card.isActive) || null;
  const hasActiveCard = !!activeCard;
  const cancelIsActive = !!currentPlayer && hasActiveCard;
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room>();

  useEffect(() => {
    if (!hasActiveCard) {
      setSelectedSquares([]);
      setSelectedMonsterSquares([]);
    }
  }, [hasActiveCard]);

  useEffect(() => {
    return () => {
      if (dayBannerTimeoutRef.current) {
        clearTimeout(dayBannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!inRoom || !gameState) return;

    const currentDay = Number(gameState.currentDay || 1);
    if (lastAnnouncedDayRef.current !== currentDay) {
      lastAnnouncedDayRef.current = currentDay;
      setDayBanner(`Day ${currentDay}`);

      if (dayBannerTimeoutRef.current) {
        clearTimeout(dayBannerTimeoutRef.current);
      }

      dayBannerTimeoutRef.current = setTimeout(() => {
        setDayBanner(null);
      }, 2200);
    }

    if (lastGameStatusRef.current !== gameState.gameStatus) {
      lastGameStatusRef.current = gameState.gameStatus;
      if (gameState.gameStatus === 'won') {
        setGameResultBanner('Victory! Boss Defeated');
      } else if (gameState.gameStatus === 'lost') {
        setGameResultBanner('Defeat! 3 Days Elapsed');
      } else {
        setGameResultBanner(null);
      }
    }
  }, [inRoom, gameState]);

  const handleCancelCleanup = useCallback(() => {
    setSelectedSquares([]);
    setSelectedMonsterSquares([]);
  }, []);

  const triggerCancelAction = useCallback(() => {
    if (!cancelIsActive) return;

    if (roomRef.current) {
      roomRef.current.send('cancelCardAction', {});
    }

    handleCancelCleanup();
  }, [cancelIsActive, handleCancelCleanup]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!cancelIsActive) return;

      event.preventDefault();
      event.stopPropagation();
      triggerCancelAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelIsActive, triggerCancelAction]);

  const canContinueMonsterSelection = (): boolean => {
    if (!gameState || selectedMonsterSquares.length === 0) return false;
    if (selectedMonsterSquares.length >= 3) return false;

    const monsterId = selectedMonsterSquares[0]?.monsterId;
    if (!monsterId) return false;
    const monster = gameState.activeMonsters.find(m => m.id === monsterId);
    if (!monster) return false;

    const selectedSet = new Set(selectedMonsterSquares.map(pos => `${pos.x},${pos.y}`));
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    for (let y = 0; y < monster.height; y++) {
      for (let x = 0; x < monster.width; x++) {
        if (selectedSet.has(`${x},${y}`)) continue;
        const square = monster.squares[y * monster.width + x];
        if (!square || !square.filled || square.checked) continue;
        const isConnected = selectedMonsterSquares.some(pos => isOrthAdjacent(x, y, pos.x, pos.y));
        if (isConnected) {
          return true;
        }
      }
    }

    return false;
  };

  // Monster drag handlers
  const handleMonsterDragStart = () => {
    console.log('Game: Monster drag started, setting isMonsterBeingDragged to true');
    setIsMonsterBeingDragged(true);
  };

  const handleMonsterDragEnd = () => {
    console.log('Game: Monster drag ended, setting isMonsterBeingDragged to false');
    setIsMonsterBeingDragged(false);
  };

  const handleSquareClick = (x, y, roomIndex?) => {
    console.log(`Clicked square at ${x}, ${y} in room index: ${roomIndex !== undefined ? roomIndex : 'current'}`);

    const activeCard = currentPlayer?.drawnCards?.find((card) => card.isActive);
    if (!activeCard) {
      // No active card - squares cannot be crossed
      console.log('Cannot cross squares without an active card');
      return;
    }

    const allowsRoomSelection =
      activeCard.selectionTarget === 'room' || activeCard.selectionTarget === 'room_or_monster';
    if (!allowsRoomSelection) {
      console.log('Active card does not allow selecting room squares');
      return;
    }

    // Prevent mixing monster + room selections in the same card action
    if (selectedMonsterSquares.length > 0) {
      console.log('Cannot select room squares while monster squares are selected');
      return;
    }

    // Card-based multi-square selection mode (client-side selection only; server commit happens on Confirm)
    const displayRoomIndex = roomIndex !== undefined ? roomIndex : 0;
    const serverRoomIndex = gameState?.displayedRoomIndices?.[displayRoomIndex];
    const room = displayedRooms[displayRoomIndex]?.room;
    if (!room) {
      console.log('Invalid room');
      return;
    }

    if (activeCard.selectionMode === 'horizontal_pair_twice') {
      const rightX = x + 1;
      if (
        x < 0 ||
        x >= room.width ||
        y < 0 ||
        y >= room.height ||
        rightX >= room.width
      ) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const leftSquare = room.squares[y * room.width + x];
      const rightSquare = room.squares[y * room.width + rightX];
      if (
        !leftSquare ||
        !rightSquare ||
        leftSquare.wall ||
        rightSquare.wall ||
        leftSquare.checked ||
        rightSquare.checked
      ) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const hasRequiredAdjacency =
        isAdjacentToEntranceOrCrossedSquare(room, x, y) ||
        isAdjacentToEntranceOrCrossedSquare(room, rightX, y);
      if (!hasRequiredAdjacency) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      if (roomRef.current) {
        roomRef.current.send('crossSquare', {
          roomIndex: serverRoomIndex ?? displayRoomIndex,
          x,
          y
        });
      }
      return;
    }

    // Row-selection mode (cross off all horizontal squares in a row)
    if (activeCard.selectionMode === 'row') {
      if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const square = room.squares[y * room.width + x];
      if (!square || square.wall || square.checked) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      if (activeCard.requiresRoomStartAdjacency && !isValidStartingSquare(room, x, y)) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        console.log('Invalid row selection start: must be entrance/adjacent/cross-adjacent');
        return;
      }

      const rowSquares: Array<{ roomIndex: number; x: number; y: number; serverRoomIndex?: number }> = [];
      for (let checkX = 0; checkX < room.width; checkX++) {
        const s = room.squares[y * room.width + checkX];
        if (!s || s.wall || s.checked) continue;
        rowSquares.push({ roomIndex: displayRoomIndex, serverRoomIndex, x: checkX, y });
      }

      if (rowSquares.length === 0) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        console.log('No available squares in that row');
        return;
      }

      // Put the clicked square first so the server can use it as the row anchor.
      setSelectedSquares([
        { roomIndex: displayRoomIndex, serverRoomIndex, x, y },
        ...rowSquares.filter((pos) => !(pos.x === x && pos.y === y))
      ]);
      return;
    }

    // Perform client-side validation before allowing selection
    const validationResult = validateSquareSelection(activeCard, x, y, displayRoomIndex);

    if (!validationResult.valid) {
      // Show red highlight for invalid selection
      setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });

      // Remove highlight after 500ms
      setTimeout(() => {
        setInvalidSquareHighlight(null);
      }, 500);

      console.log('Invalid square selection:', validationResult.reason);
      return;
    }

    // Valid selection - add to selected squares for visual feedback.
    // NOTE: We do not send this to the server until the user clicks Confirm.
    setSelectedSquares((prev) => [
      ...prev,
      { roomIndex: displayRoomIndex, serverRoomIndex, x, y }
    ]);
  };

  const handleMonsterSquareClick = (monsterId: string, x: number, y: number) => {
    const activeCard = currentPlayer?.drawnCards?.find((card) => card.isActive);
    if (!activeCard) {
      console.log('Cannot select monster squares without an active card');
      return;
    }

    const allowsMonsterSelection =
      activeCard.selectionTarget === 'monster' ||
      activeCard.selectionTarget === 'room_or_monster' ||
      activeCard.selectionTarget === 'monster_each';
    if (!allowsMonsterSelection) {
      console.log('Active card does not allow selecting monster squares');
      return;
    }

    // Prevent mixing monster + room selections in the same card action
    if (selectedSquares.length > 0) {
      console.log('Cannot select monster squares while room squares are selected');
      return;
    }

    const allowsMultiMonster = activeCard.selectionTarget === 'monster_each';
    const maxSelections = activeCard.maxSelections || 0;

    // Enforce single-monster selection per card action
    if (!allowsMultiMonster && selectedMonsterSquares.length > 0 && selectedMonsterSquares.some(pos => pos.monsterId !== monsterId)) {
      console.log('Cannot select squares from multiple monsters in the same card action');
      return;
    }

    // Find the monster in state for validation
    const monster = gameState?.activeMonsters?.find(m => m.id === monsterId);
    if (!monster) {
      console.log('Monster not found in state');
      return;
    }

    if (activeCard.selectionMode === 'horizontal_pair_twice') {
      const rightX = x + 1;
      const leftSquare = monster.squares[y * monster.width + x];
      const rightSquare = monster.squares[y * monster.width + rightX];

      if (
        !leftSquare ||
        !rightSquare ||
        !leftSquare.filled ||
        !rightSquare.filled ||
        leftSquare.checked ||
        rightSquare.checked
      ) {
        console.log('Invalid monster horizontal pair placement');
        return;
      }

      if (roomRef.current) {
        roomRef.current.send('crossMonsterSquare', { monsterId, x, y });
      }
      return;
    }

    const selectedForMonster = selectedMonsterSquares.filter((pos) => pos.monsterId === monsterId);

    // Enforce max selection limits
    if (maxSelections > 0) {
      if (allowsMultiMonster) {
        if (selectedForMonster.length >= maxSelections) {
          console.log(`Maximum of ${maxSelections} squares can be selected per monster`);
          return;
        }
      } else if (selectedMonsterSquares.length >= maxSelections) {
        console.log(`Maximum of ${maxSelections} squares can be selected per card`);
        return;
      }
    }

    // Cannot select already checked or empty squares
    const idx = y * monster.width + x;
    const square = monster.squares[idx];
    if (!square || !square.filled || square.checked) {
      console.log('Invalid monster square selection');
      return;
    }

    // Check already selected
    const alreadySelected = selectedMonsterSquares.some(pos => pos.monsterId === monsterId && pos.x === x && pos.y === y);
    if (alreadySelected) {
      console.log('Monster square already selected');
      return;
    }

    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    // Connectivity (per monster): subsequent squares must be adjacent to existing selections on this monster
    if (activeCard.requiresConnected && selectedForMonster.length > 0) {
      const isConnected = selectedForMonster.some(pos => isOrthAdjacent(x, y, pos.x, pos.y));
      if (!isConnected) {
        console.log('Monster square must be orthogonally connected to selected squares');
        return;
      }
    }

    // Add to local selection for highlight
    setSelectedMonsterSquares(prev => [...prev, { monsterId, x, y }]);
  };

  // Client-side validation for card-based square selection
  const validateSquareSelection = (card: any, x: number, y: number, displayRoomIndex: number): { valid: boolean; reason?: string } => {
    if (!displayedRooms[displayRoomIndex]) {
      return { valid: false, reason: 'Invalid room' };
    }

    const room = displayedRooms[displayRoomIndex].room;

    // All selections for a card action must remain within the same room.
    if (selectedSquares.length > 0 && selectedSquares[0].roomIndex !== displayRoomIndex) {
      return { valid: false, reason: 'All selected squares must be in the same room' };
    }

    // Check if coordinates are valid
    if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
      return { valid: false, reason: 'Invalid coordinates' };
    }

    const square = room.squares[y * room.width + x];
    if (!square) {
      return { valid: false, reason: 'Invalid square' };
    }

    // Cannot select walls
    if (square.wall) {
      return { valid: false, reason: 'Cannot select wall squares' };
    }

    // Cannot select already crossed squares
    if (square.checked) {
      return { valid: false, reason: 'Square already crossed' };
    }

    // Check if square is already selected
    const alreadySelected = selectedSquares.some(pos =>
      pos.roomIndex === displayRoomIndex && pos.x === x && pos.y === y
    );
    if (alreadySelected) {
      return { valid: false, reason: 'Square already selected' };
    }

    const maxSelections = card?.maxSelections || 0;
    if (maxSelections > 0 && selectedSquares.length >= maxSelections) {
      return { valid: false, reason: `Maximum of ${maxSelections} squares can be selected per card` };
    }

    // Validate connectivity for non-first squares (when required)
    if (card?.requiresConnected && selectedSquares.length > 0) {
      const isConnected = isSquareConnectedToSelection(displayRoomIndex, x, y, selectedSquares);
      if (!isConnected) {
        return { valid: false, reason: 'Square must be orthogonally connected to selected squares' };
      }
    } else {
      if (selectedSquares.length === 0 && card?.requiresRoomStartAdjacency) {
        // First square must be the entrance, adjacent to the entrance, or adjacent to an existing crossed square.
        const isValidStart = isValidStartingSquare(room, x, y);
        if (!isValidStart) {
          return {
            valid: false,
            reason: 'First square must be the entrance, adjacent to the entrance, or adjacent to an existing crossed square'
          };
        }
      }
    }

    return { valid: true };
  };

  // Check if a square is connected to the current selection
  const isSquareConnectedToSelection = (
    roomIndex: number,
    x: number,
    y: number,
    selectedPositions: Array<{ roomIndex: number, x: number, y: number }>
  ): boolean => {
    // Check if the square is orthogonally adjacent to any selected square in the same room
    for (const pos of selectedPositions) {
      if (pos.roomIndex === roomIndex) {
        const dx = Math.abs(x - pos.x);
        const dy = Math.abs(y - pos.y);

        // Orthogonally adjacent means exactly one coordinate differs by 1
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          return true;
        }
      }
    }

    return false;
  };

  const isAdjacentToEntranceOrCrossedSquare = (room: DungeonRoom, x: number, y: number): boolean => {
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    if (room.entranceX !== -1 && room.entranceY !== -1) {
      if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
        return true;
      }
    }

    for (let checkX = 0; checkX < room.width; checkX++) {
      for (let checkY = 0; checkY < room.height; checkY++) {
        const square = room.squares[checkY * room.width + checkX];
        if (square?.checked && isOrthAdjacent(x, y, checkX, checkY)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check if a square is a valid starting position (entrance, adjacent to entrance, or adjacent to existing crossed square)
  const isValidStartingSquare = (room: DungeonRoom, x: number, y: number): boolean => {
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    // Check if entrance itself or adjacent to entrance
    if (room.entranceX !== -1 && room.entranceY !== -1) {
      if (x === room.entranceX && y === room.entranceY) {
        return true;
      }
      if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
        return true;
      }
    }

    // Check if adjacent to any existing crossed square
    for (let checkX = 0; checkX < room.width; checkX++) {
      for (let checkY = 0; checkY < room.height; checkY++) {
        const square = room.squares[checkY * room.width + checkX];
        if (square && square.checked) {
          if (isOrthAdjacent(x, y, checkX, checkY)) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Set up global listener for all state changes
  useEffect(() => {
    // Will run once after initial render and whenever inRoom changes
    const room = roomRef.current;
    if (room) {
      // Listen for ANY state changes from the server
      room.onStateChange((state) => {
        console.log("Full state update received");
        // Force a complete re-render when state changes
        setUpdateCounter(prev => prev + 1);

        // Update game state
        setGameState(state);

        // Update displayed rooms
        updateDisplayedRooms(state);

        // Update current player
        if (state.players && room.sessionId) {
          const player = state.players.get(room.sessionId);
          console.log('Updating current player:', player);
          if (player) {
            console.log('Player deck length:', player.deck.length);
            console.log('Player drawnCards length:', player.drawnCards.length);
            console.log('Player hasDrawnCard:', player.hasDrawnCard);
          }
          setCurrentPlayer(player || null);
        }
      });
    }
  }, [inRoom]); // Only re-run when room connection status changes

  // Function to update the displayed rooms based on the state
  const updateDisplayedRooms = (state) => {
    if (!state || !state.rooms || !state.displayedRoomIndices) return;

    const rooms = [];

    for (let i = 0; i < state.displayedRoomIndices.length; i++) {
      const roomIndex = state.displayedRoomIndices[i];
      const room = state.rooms[roomIndex];
      const x = state.roomPositionsX[i];
      const y = state.roomPositionsY[i];

      rooms.push({
        room,
        x,
        y
      });
    }

    setDisplayedRooms(rooms);

    // Also update the current room
    if (state.rooms[state.currentRoomIndex]) {
      setCurrentRoom(state.rooms[state.currentRoomIndex]);
    }
  };

  async function joinRoom() {
    var client = new Colyseus.Client('ws://localhost:2567');
    // var client = new Colyseus.Client('https://us-ewr-120d3744.colyseus.cloud');

    try {
      roomRef.current = await client.joinOrCreate('dungeon', { name: name });

      setInRoom(true);
      console.log('joined successfully', roomRef);

      roomRef.current.state.players.onAdd((player, sessionId) => {
        console.log(`Player added: ${player.name} (sessionId: ${sessionId})`);
        setInRoom(true);
        setPlayers((players) => [...players, player.name]);
      });

      roomRef.current.state.rooms.onAdd((room, index) => {
        console.log(`Room added at index ${index}, width: ${room.width}, height: ${room.height}`);

        // Listen for changes to the current room index
        roomRef.current.state.listen("currentRoomIndex", (currentIndex) => {
          console.log(`Current room index changed to ${currentIndex}`);
          setCurrentRoom(roomRef.current.state.rooms[currentIndex]);
          setUpdateCounter(prev => prev + 1);

          // Update displayed rooms when current room changes
          updateDisplayedRooms(roomRef.current.state);
        });

        // Set the initial current room
        if (index === roomRef.current.state.currentRoomIndex) {
          setCurrentRoom(room);
        }

        // Listen for changes to squares in the room
        room.squares.onChange((square, squareIndex) => {
          // console.log(`Square changed at index ${squareIndex}`);
        });
      });

      // Listen for changes to displayed room indices
      roomRef.current.state.displayedRoomIndices.onAdd((roomIndex, i) => {
        console.log(`Displayed room index added: ${roomIndex} at position ${i}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      // Listen for changes to room positions
      roomRef.current.state.roomPositionsX.onChange((value, i) => {
        console.log(`Room position X changed at index ${i}: ${value}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      roomRef.current.state.roomPositionsY.onChange((value, i) => {
        console.log(`Room position Y changed at index ${i}: ${value}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      roomRef.current.state.players.onChange = (
        player: Player,
        sessionId: string
      ) => {
        console.log(`Player changed: ${player.name} (sessionId: ${sessionId})`);
      };

      // Add message handlers
      roomRef.current.onMessage('drawCardResult', (message) => {
        console.log('📨 Draw card result received:', message);
        console.log('  - Success:', message.success);
        console.log('  - Message:', message.message);
        console.log('  - Error:', message.error);

        if (message.success) {
          console.log('  ✅ Card draw was successful - state should update soon');
        } else {
          console.log('  ❌ Card draw failed:', message.error);
        }

        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      // Handle crossSquare results for card-based selection
      roomRef.current.onMessage('crossSquareResult', (message) => {
        console.log('Cross square result:', message);

        if (message.success && !message.completed) {
          // Square was successfully selected but card action not yet completed
          // We need to track this locally for visual feedback since the server doesn't 
          // immediately mark squares as checked during card selection
          // The actual coordinates should be extracted from the last sent message
          // For now, we'll rely on the client-side tracking in handleSquareClick
        } else if (message.completed) {
          // Card action completed - clear selected squares
          setSelectedSquares([]);
        } else if (message.invalidSquare) {
          // Server confirmed invalid square - visual feedback already shown
          console.log('Server confirmed invalid square selection');
        }
      });

      // Handle cancel card action results
      roomRef.current.onMessage('cancelCardActionResult', (message) => {
        console.log('Cancel card action result:', message);

        if (message.success) {
          // Card action was successfully cancelled - clear selected squares
          setSelectedSquares([]);
          setSelectedMonsterSquares([]);
        }
      });

      // Handle confirm card action results
      roomRef.current.onMessage('confirmCardActionResult', (message) => {
        console.log('Confirm card action result:', message);

        if (message.success && message.completed) {
          // Card action was successfully completed - clear selected squares
          setSelectedSquares([]);
          setSelectedMonsterSquares([]);
        }
      });

      // Handle play card results
      roomRef.current.onMessage('playCardResult', (message) => {
        console.log('Play card result:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      // Handle turn advanced results
      roomRef.current.onMessage('turnAdvanced', (message) => {
        console.log('Turn advanced:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      roomRef.current.onMessage('monsterAttackPhase', (message) => {
        const sessionId = roomRef.current?.sessionId;
        if (!sessionId) {
          return;
        }

        const attacks = Array.isArray(message?.attacks) ? message.attacks : [];
        const relevantAttacks = attacks.filter((attack: any) => attack?.playerSessionId === sessionId && !!attack?.monsterId);
        if (relevantAttacks.length === 0) {
          return;
        }

        const createdAt = Date.now();
        const nextAnimations: MonsterAttackAnimation[] = relevantAttacks.map((attack: any, index: number) => {
          const defenseSymbol =
            attack?.card?.defenseSymbol === 'block' || attack?.card?.defenseSymbol === 'counter'
              ? attack.card.defenseSymbol
              : 'empty';

          return {
            id: `${attack.monsterId}-${attack.attackNumber || 1}-${createdAt}-${index}`,
            monsterId: attack.monsterId,
            attackNumber: Math.max(1, Number(attack.attackNumber || 1)),
            monsterAttack: Math.max(1, Number(attack.monsterAttack || 1)),
            outcome: attack.outcome || 'discarded',
            counterSquare: attack.counterSquare || null,
            card: attack.card
              ? {
                  id: String(attack.card.id || ''),
                  type: String(attack.card.type || ''),
                  description: String(attack.card.description || ''),
                  defenseSymbol
                }
              : undefined
          };
        });

        const idsToRemove = new Set(nextAnimations.map((attack) => attack.id));
        setMonsterAttackAnimations((prev) => [...prev, ...nextAnimations]);

        const deckCardEl = document.querySelector('[data-player-deck-card="true"]') as HTMLElement | null;
        if (deckCardEl) {
          const deckRect = deckCardEl.getBoundingClientRect();
          const toX = deckRect.left + deckRect.width / 2 - 32;
          const toY = deckRect.top + deckRect.height / 2 - 48;

          const returnAnimations = nextAnimations
            .filter(
              (attack) =>
                (attack.outcome === 'returned_to_deck' || attack.outcome === 'counter_attack') &&
                !!attack.card
            )
            .flatMap((attack) => {
              const escape = (window as any).CSS?.escape;
              const escapedMonsterId = escape ? escape(attack.monsterId) : attack.monsterId.replace(/"/g, '\\"');
              const monsterEl = document.querySelector(`[data-monster-card-id="${escapedMonsterId}"]`) as HTMLElement | null;
              if (!monsterEl || !attack.card) return [];

              const monsterRect = monsterEl.getBoundingClientRect();
              const fromX = monsterRect.left + monsterRect.width / 2 - 32;
              const fromY = monsterRect.top - 108;
              const delayMs = Math.max(0, (attack.attackNumber || 1) - 1) * 280 + 860;

              return [{
                id: `${attack.id}-return`,
                fromX,
                fromY,
                toX,
                toY,
                delayMs,
                card: {
                  type: attack.card.type,
                  description: attack.card.description,
                  defenseSymbol: attack.card.defenseSymbol
                }
              }];
            });

          if (returnAnimations.length > 0) {
            const returnIds = new Set(returnAnimations.map((anim) => anim.id));
            setDeckReturnAnimations((prev) => [...prev, ...returnAnimations]);

            const maxDelay = returnAnimations.reduce((max, anim) => Math.max(max, anim.delayMs), 0);
            setTimeout(() => {
              setDeckReturnAnimations((prev) => prev.filter((anim) => !returnIds.has(anim.id)));
            }, maxDelay + 1200);
          }
        }

        const maxAttackNumber = nextAnimations.reduce(
          (max, attack) => Math.max(max, attack.attackNumber || 1),
          1
        );
        const animationDurationMs = 2200 + maxAttackNumber * 320;
        setTimeout(() => {
          setMonsterAttackAnimations((prev) => prev.filter((attack) => !idsToRemove.has(attack.id)));
        }, animationDurationMs);
      });

      // Monster actions are authoritative on the server and reflected via state patches.
      // NOTE: We intentionally do not rely on "*Result" messages here because sending them
      // has intermittently triggered msgpackr RangeErrors in this project.

      roomRef.current.onStateChange.once((state) => {
        setInitialState(state);
      });
    } catch (e) {
      console.error('join error', e);
    }
  }

  const setInitialState = (state: DungeonState) => {
    console.log('setInitalState', state);

    // Set initial game state
    setGameState(state);

    if (state.rooms && state.rooms.length > 0) {
      setCurrentRoom(state.rooms[state.currentRoomIndex]);
      updateDisplayedRooms(state);
    }

    // Set initial current player
    if (state.players && roomRef.current?.sessionId) {
      const player = state.players.get(roomRef.current.sessionId);
      setCurrentPlayer(player || null);
    }
  };

  const selectedCount = (selectedSquares?.length || 0) + (selectedMonsterSquares?.length || 0);

  const isMonsterCompleted = (monster: any): boolean => {
    if (!monster?.squares) return false;
    return monster.squares.every((s: any) => !s.filled || s.checked);
  };

  const getMonsterRemainingSquares = (monster: any): number => {
    if (!monster?.squares) return 0;
    return monster.squares.filter((s: any) => s.filled && !s.checked).length;
  };

  const isConfirmReady = (() => {
    if (!activeCard) return false;

    const target = activeCard.selectionTarget;
    const minSelections = activeCard.minSelections ?? 1;
    const maxSelections = activeCard.maxSelections ?? 0;

    if (target === 'monster_each') {
      if (selectedSquares.length > 0) return false;
      const sessionId = roomRef.current?.sessionId;
      if (!sessionId || !gameState?.activeMonsters) return false;

      const owned = gameState.activeMonsters.filter((m: any) => m.playerOwnerId === sessionId);
      const eligible = owned.filter((m: any) => !isMonsterCompleted(m));
      if (eligible.length === 0) return false;

      const eligibleIds = new Set(eligible.map((m: any) => m.id));
      if (selectedMonsterSquares.some((s) => !eligibleIds.has(s.monsterId))) return false;

      const perMonsterMax = maxSelections || 2;
      for (const monster of eligible) {
        const remaining = getMonsterRemainingSquares(monster);
        const required = Math.min(perMonsterMax, remaining);
        const selectedForMonster = selectedMonsterSquares.filter((s) => s.monsterId === monster.id).length;
        if (selectedForMonster !== required) return false;
      }

      return true;
    }

    const roomCount = selectedSquares.length;
    const monsterCount = selectedMonsterSquares.length;

    if (target === 'room') {
      if (monsterCount > 0) return false;
      if (roomCount < minSelections) return false;
      if (maxSelections > 0 && roomCount > maxSelections) return false;
      return true;
    }

    if (target === 'monster') {
      if (roomCount > 0) return false;
      if (monsterCount < minSelections) return false;
      if (maxSelections > 0 && monsterCount > maxSelections) return false;
      return true;
    }

    if (target === 'room_or_monster') {
      if (roomCount > 0 && monsterCount > 0) return false;
      const count = roomCount > 0 ? roomCount : monsterCount;
      if (count === 0) return false;
      if (count < minSelections) return false;
      if (maxSelections > 0 && count > maxSelections) return false;
      return true;
    }

    return selectedCount > 0;
  })();

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden">
      {!inRoom && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <div>Character Name</div>
          <input className="border-2 border-gray-300 rounded-md p-2 text-black" type="text" onChange={(e) => setName(e.target.value)} />
          <button
            onClick={joinRoom}
            className="outline-hidden bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join
          </button>
        </div>
      )}
      {inRoom && (
        <div className="flex h-screen w-full">
          {/* Left side panel for game information */}
          <div className="w-64 flex flex-col bg-slate-800 p-4 overflow-y-auto border-r border-slate-700 h-[calc(100vh-20rem)]" >
            <span>
              <h2 className="text-xl font-bold mb-4">Players</h2>
              <ul className="space-y-2">
                {gameState?.players && Array.from(gameState.players.entries()).map(([sessionId, player]) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return 'status-not-started';
                      case 'playing_turn':
                        return 'status-playing';
                      case 'turn_complete':
                        return 'status-complete';
                      default:
                        return 'status-not-started';
                    }
                  };

                  const getStatusIcon = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return '⏸️';
                      case 'playing_turn':
                        return '▶️';
                      case 'turn_complete':
                        return '✅';
                      default:
                        return '⏸️';
                    }
                  };

                  const formatStatus = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return 'not started';
                      case 'playing_turn':
                        return 'playing turn';
                      case 'turn_complete':
                        return 'turn complete';
                      default:
                        return status;
                    }
                  };

                  return (
                    <li key={sessionId} className="p-2 bg-slate-700 rounded flex justify-between items-center">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{getStatusIcon(player.turnStatus)}</span>
                        <span className={`status-indicator text-sm font-medium ${getStatusColor(player.turnStatus)}`}>
                          {formatStatus(player.turnStatus)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </span>
            <div className="mt-auto pt-4 border-t border-slate-700">
              <TurnControls
                player={currentPlayer}
                gameState={gameState}
                room={roomRef.current}
              />
            </div>
          </div>

          {/* Main content area for dungeon map */}
          <div ref={mapScrollRef} className="flex-1 bg-slate-900 overflow-auto relative" >
            {/* Card Action Buttons - Fixed position at top center */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-4">
              <ConfirmMoveButton
                player={currentPlayer}
                room={roomRef.current}
                selectedCount={selectedCount}
                isVisible={hasActiveCard && selectedCount > 0}
                isReady={isConfirmReady}
                selectedSquares={selectedSquares}
                selectedMonsterSquares={selectedMonsterSquares}
              />
              <CancelButton
                player={currentPlayer}
                room={roomRef.current}
                isVisible={currentPlayer?.drawnCards.some(card => card.isActive)}
                onCancel={handleCancelCleanup}
              />
            </div>

            {displayedRooms.length > 0 && (
              <DungeonMap
                rooms={displayedRooms}
                handleSquareClick={handleSquareClick}
                player={currentPlayer}
                colyseusRoom={roomRef.current}
                invalidSquareHighlight={invalidSquareHighlight}
                selectedSquares={selectedSquares}
                gameState={gameState}
                onMonsterDragStart={handleMonsterDragStart}
                onMonsterDragEnd={handleMonsterDragEnd}
                scrollContainerRef={mapScrollRef}
                bottomOverlayRef={playerAreaRef}
                horizontalPairPreviewEnabled={activeCard?.selectionMode === 'horizontal_pair_twice'}
              />
            )}

            {/* Monsters are now displayed inside room containers */}
          </div>

          {/* Bottom drawer for player's area */}
          <div ref={playerAreaRef} className="player-area fixed bottom-0 left-0 right-0 h-80 bg-slate-800 border-t border-slate-700 p-2 z-50">
            <div className="flex flex-col h-full gap-2">
              <div className="flex-1 flex gap-4 min-h-0">
                <div className="bg-slate-700 p-4 rounded flex-1">
                  <div className="flex justify-start gap-6">
                    <CardDeck player={currentPlayer} room={roomRef.current} />
                    <DrawnCard player={currentPlayer} room={roomRef.current} key={updateCounter} />
                    <DiscardPile player={currentPlayer} room={roomRef.current} />
                  </div>
                </div>
                {/* Always render PlayerMonsters so it can respond to drag state */}
                <PlayerMonsters
                  gameState={gameState}
                  currentPlayer={currentPlayer}
                  colyseusRoom={roomRef.current}
                  isMonsterBeingDragged={isMonsterBeingDragged}
                  onMonsterDrop={() => setIsMonsterBeingDragged(false)}
                  selectedMonsterSquares={selectedMonsterSquares}
                  onMonsterSquareClick={handleMonsterSquareClick}
                  attackAnimations={monsterAttackAnimations}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {inRoom && dayBanner && (
        <div className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center">
          <div className="rounded-xl border-4 border-amber-300 bg-slate-950/90 px-12 py-8 text-6xl font-black tracking-wide text-amber-200 shadow-2xl">
            {dayBanner}
          </div>
        </div>
      )}

      {inRoom && gameResultBanner && (
        <div className="fixed inset-0 z-[95] pointer-events-none flex items-center justify-center">
          <div
            className={`rounded-xl border-4 bg-slate-950/92 px-12 py-8 text-5xl font-black tracking-wide shadow-2xl ${
              gameState?.gameStatus === 'lost'
                ? 'border-rose-300 text-rose-200'
                : 'border-emerald-300 text-emerald-200'
            }`}
          >
            {gameResultBanner}
          </div>
        </div>
      )}

      {deckReturnAnimations.map((anim) => (
        <div
          key={anim.id}
          className="monster-attack-return-card fixed z-[80] pointer-events-none w-16 h-24 rounded border-2 border-gray-300 bg-white shadow-xl"
          style={{
            left: `${anim.fromX}px`,
            top: `${anim.fromY}px`,
            animationDelay: `${anim.delayMs}ms`,
            ['--return-dx' as any]: `${anim.toX - anim.fromX}px`,
            ['--return-dy' as any]: `${anim.toY - anim.fromY}px`
          }}
        >
          <CardFaceContent
            type={anim.card.type}
            description={anim.card.description}
            defenseSymbol={anim.card.defenseSymbol}
          />
        </div>
      ))}
    </main>
  );
}
