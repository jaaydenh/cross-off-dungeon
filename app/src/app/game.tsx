'use client';
// @ts-nocheck

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Client, Room, getStateCallbacks } from '@colyseus/sdk';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import { Room as DungeonRoom } from '@/types/Room';
import DungeonMap from './DungeonMap';
import CardDeck from './CardDeck';
import DrawnCard from './DrawnCard';
import DiscardPile from './DiscardPile';
import TurnControls from './TurnControls';
import CancelButton from './CancelButton';
import DiscardCardButton from './DiscardCardButton';
import ConfirmMoveButton from './ConfirmMoveButton';
import PlayerMonsters from './PlayerMonsters';
import { MonsterAttackAnimation } from '@/types/MonsterAttack';
import CardFaceContent from './CardFaceContent';
import MonsterCard from './MonsterCard';
import CardLibraryScreen from './CardLibraryScreen';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState { }
type LobbyRoomMetadata = {
  roomCode?: string;
  currentDay?: number;
  currentTurn?: number;
  gameStatus?: string;
  playerCount?: number;
  maxPlayers?: number;
};
type LobbyRoomInfo = {
  name: string;
  roomId: string;
  clients: number;
  maxClients: number;
  locked?: boolean;
  metadata?: LobbyRoomMetadata;
};
type PersistedReconnection = {
  token: string;
  name: string;
  savedAt: number;
};

const DUNGEON_ROOM_NAME = 'dungeon';
const DEFAULT_SERVER_URL = 'ws://localhost:2567';
const RECONNECT_STORAGE_KEY = 'cross-off-dungeon.reconnect';
const RECONNECT_TOKEN_MAX_AGE_MS = 2 * 60 * 1000;

export default function Game() {
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<LobbyRoomInfo[]>([]);
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
    card: { type: string; name: string; description: string; defenseSymbol: string; color: string };
  }>>([]);
  const [dayBanner, setDayBanner] = useState<string | null>(null);
  const [gameResultBanner, setGameResultBanner] = useState<string | null>(null);
  const [openMonsterPopoverFor, setOpenMonsterPopoverFor] = useState<string | null>(null);
  const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
  const [cunningActivationBaseline, setCunningActivationBaseline] = useState<{
    cardId: string;
    totalCheckedSquares: number;
  } | null>(null);
  const dayBannerTimeoutRef = useRef<any>(null);
  const monsterPopoverCloseTimeoutRef = useRef<any>(null);
  const lastAnnouncedDayRef = useRef<number | null>(null);
  const lastGameStatusRef = useRef<string | null>(null);
  const hasGameState = gameState !== null;
  const currentDay = Number(gameState?.currentDay || 1);
  const currentGameStatus = gameState?.gameStatus || null;

  const activeCard = currentPlayer?.drawnCards?.find((card) => card.isActive) || null;
  const cardAllowsMonsterSelection = (card: any): boolean =>
    card?.selectionTarget === 'monster' ||
    card?.selectionTarget === 'room_or_monster' ||
    card?.selectionTarget === 'monster_each';
  const cardCanTargetAnyOwnedMonster = (card: any): boolean =>
    card?.selectionTarget === 'monster_each';
  const canCardTargetMonster = (card: any, monster: any): boolean => {
    if (!card || !monster || !cardAllowsMonsterSelection(card)) {
      return false;
    }
    if (!monster.playerOwnerId) {
      return false;
    }
    if (cardCanTargetAnyOwnedMonster(card)) {
      return true;
    }
    return monster.playerOwnerId === roomRef.current?.sessionId;
  };
  const canSelectMonsterSquares = cardAllowsMonsterSelection(activeCard);
  const showHorizontalPairPreview = activeCard?.selectionMode === 'horizontal_pair_twice';
  const showSpreadOutPreview = activeCard?.selectionMode === 'centered_room_3x3';
  const showCombatBlastPreview = activeCard?.selectionMode === 'centered_monster_3x3';
  const showSwipePreview = activeCard?.selectionMode === 'monster_swipe_l';
  const showCunningPreview = activeCard?.selectionMode === 'cunning_three_step_different_cards';
  const totalCheckedSquares = useMemo(() => {
    if (!gameState) {
      return 0;
    }

    let total = 0;

    for (const room of gameState.rooms || []) {
      for (const square of room.squares || []) {
        if (square?.checked) {
          total += 1;
        }
      }
    }

    for (const monster of gameState.activeMonsters || []) {
      for (const square of monster.squares || []) {
        if (square?.filled && square?.checked) {
          total += 1;
        }
      }
    }

    return total;
  }, [gameState]);
  useEffect(() => {
    if (!showCunningPreview || !activeCard?.id) {
      setCunningActivationBaseline(null);
      return;
    }

    setCunningActivationBaseline((previous) => {
      if (previous?.cardId === String(activeCard.id)) {
        return previous;
      }

      return {
        cardId: String(activeCard.id),
        totalCheckedSquares
      };
    });
  }, [showCunningPreview, activeCard?.id, totalCheckedSquares]);
  const cunningCheckedDelta =
    showCunningPreview &&
    activeCard?.id &&
    cunningActivationBaseline?.cardId === String(activeCard.id)
      ? Math.max(0, totalCheckedSquares - cunningActivationBaseline.totalCheckedSquares)
      : 0;
  const cunningPreviewStepLength: 1 | 2 | 3 | null = !showCunningPreview
    ? null
    : cunningCheckedDelta < 1
      ? 1
      : cunningCheckedDelta < 3
        ? 2
        : cunningCheckedDelta < 6
          ? 3
          : null;
  const monstersByPlayer = (() => {
    const grouped = new Map<string, any[]>();
    for (const monster of gameState?.activeMonsters || []) {
      if (!monster.playerOwnerId) {
        continue;
      }
      const isCompleted =
        Array.isArray(monster.squares) &&
        monster.squares.every((square: any) => !square.filled || square.checked);
      if (isCompleted) {
        continue;
      }
      const ownerMonsters = grouped.get(monster.playerOwnerId) || [];
      ownerMonsters.push(monster);
      grouped.set(monster.playerOwnerId, ownerMonsters);
    }
    return grouped;
  })();
  const hasActiveCard = !!activeCard;
  const cancelIsActive = !!currentPlayer && hasActiveCard;
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room>();
  const clientRef = useRef<Client | null>(null);
  const reconnectNameRef = useRef('');
  const openMonsterPopover = useCallback((sessionId: string) => {
    if (monsterPopoverCloseTimeoutRef.current) {
      clearTimeout(monsterPopoverCloseTimeoutRef.current);
      monsterPopoverCloseTimeoutRef.current = null;
    }
    setOpenMonsterPopoverFor(sessionId);
  }, []);
  const closeMonsterPopoverWithDelay = useCallback(() => {
    if (monsterPopoverCloseTimeoutRef.current) {
      clearTimeout(monsterPopoverCloseTimeoutRef.current);
    }
    monsterPopoverCloseTimeoutRef.current = setTimeout(() => {
      setOpenMonsterPopoverFor(null);
      monsterPopoverCloseTimeoutRef.current = null;
    }, 320);
  }, []);
  const isHeroicMoveAndFightCard = (card: any): boolean => card?.type === 'heroic_move_two_and_fight_two';
  const isCombatCard = (card: any): boolean => card?.type === 'combat_fight_three_diagonal_or_move_three';
  const roomCode = roomRef.current?.roomId || '';
  const normalizedName = name.trim().replace(/\s+/g, ' ').slice(0, 24);
  const canJoinLobbyActions = normalizedName.length > 0 && !isJoiningRoom;
  const readPersistedReconnection = useCallback((): PersistedReconnection | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    // Reconnection should be tab-scoped. Keep token in sessionStorage only.
    let raw = window.sessionStorage.getItem(RECONNECT_STORAGE_KEY);

    // Backward-compatibility migration from older localStorage behavior.
    // Only allow migration on a same-tab reload/back-forward navigation.
    const legacyRaw = window.localStorage.getItem(RECONNECT_STORAGE_KEY);
    if (!raw && legacyRaw) {
      const navEntry = window.performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
      const navType = navEntry?.type;
      const allowLegacyMigration = navType === 'reload' || navType === 'back_forward';

      if (allowLegacyMigration) {
        raw = legacyRaw;
        window.sessionStorage.setItem(RECONNECT_STORAGE_KEY, legacyRaw);
      }

      // Always clear legacy storage to prevent cross-tab auto-reconnect.
      window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedReconnection;
      if (!parsed?.token || typeof parsed.token !== 'string') {
        return null;
      }
      const savedAt = Number(parsed.savedAt || Date.now());
      if (!Number.isFinite(savedAt) || (Date.now() - savedAt) > RECONNECT_TOKEN_MAX_AGE_MS) {
        return null;
      }

      return {
        token: parsed.token,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        savedAt
      };
    } catch (error) {
      console.error('failed to parse reconnection data', error);
      return null;
    }
  }, []);

  const savePersistedReconnection = useCallback((token: string, playerName: string) => {
    if (typeof window === 'undefined' || !token) {
      return;
    }

    const payload: PersistedReconnection = {
      token,
      name: playerName,
      savedAt: Date.now()
    };
    window.sessionStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(payload));
    // Ensure we do not keep cross-tab reconnect artifacts.
    window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
  }, []);

  const clearPersistedReconnection = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.removeItem(RECONNECT_STORAGE_KEY);
    window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!hasActiveCard) {
      setSelectedSquares([]);
      setSelectedMonsterSquares([]);
    }
  }, [hasActiveCard]);

  useEffect(() => {
    if (!inRoom) {
      setOpenMonsterPopoverFor(null);
      setIsCardLibraryOpen(false);
      if (monsterPopoverCloseTimeoutRef.current) {
        clearTimeout(monsterPopoverCloseTimeoutRef.current);
        monsterPopoverCloseTimeoutRef.current = null;
      }
    }
  }, [inRoom]);

  useEffect(() => {
    return () => {
      if (dayBannerTimeoutRef.current) {
        clearTimeout(dayBannerTimeoutRef.current);
      }
      if (monsterPopoverCloseTimeoutRef.current) {
        clearTimeout(monsterPopoverCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!inRoom || !hasGameState) return;

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

    if (lastGameStatusRef.current !== currentGameStatus) {
      lastGameStatusRef.current = currentGameStatus;
      if (currentGameStatus === 'won') {
        setGameResultBanner('Victory! Boss Defeated');
      } else if (currentGameStatus === 'lost') {
        setGameResultBanner('Defeat! 3 Days Elapsed');
      } else {
        setGameResultBanner(null);
      }
    }
  }, [inRoom, hasGameState, currentDay, currentGameStatus]);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_COLYSEUS_URL || DEFAULT_SERVER_URL;
    clientRef.current = new Client(serverUrl);
  }, []);

  useEffect(() => {
    if (!clientRef.current) {
      return;
    }

    const persisted = readPersistedReconnection();
    if (!persisted) {
      return;
    }

    reconnectNameRef.current = persisted.name || '';
    if (persisted.name) {
      setName((currentName) => currentName || persisted.name);
    }

    let cancelled = false;

    void (async () => {
      // React Strict Mode mounts/unmounts effects twice in development.
      // Deferring by one microtask prevents duplicate reconnect attempts.
      await Promise.resolve();
      if (cancelled) {
        return;
      }

      const didReconnect = await connectToRoom(
        () => clientRef.current!.reconnect(persisted.token),
        { suppressJoinError: true }
      );

      if (!didReconnect) {
        clearPersistedReconnection();
      }
    })();

    return () => {
      cancelled = true;
    };
    // We intentionally run this once on mount with persisted data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPersistedReconnection, readPersistedReconnection]);

  const refreshLobbyRooms = useCallback(async () => {
    if (inRoom || !clientRef.current) {
      return;
    }

    try {
      const response = await clientRef.current.http.get<LobbyRoomInfo[]>(`matchmake/${DUNGEON_ROOM_NAME}`);
      const rooms = Array.isArray(response.data) ? response.data : [];
      setAvailableRooms(rooms.sort((a, b) => {
        const dayA = Number(a.metadata?.currentDay || 1);
        const dayB = Number(b.metadata?.currentDay || 1);
        if (dayA !== dayB) {
          return dayA - dayB;
        }

        const turnA = Number(a.metadata?.currentTurn || 1);
        const turnB = Number(b.metadata?.currentTurn || 1);
        return turnA - turnB;
      }));
      setLobbyError(null);
    } catch (error) {
      console.error('failed to fetch rooms', error);
      setLobbyError('Unable to load game list. Is the server running?');
    }
  }, [inRoom]);

  useEffect(() => {
    if (inRoom) {
      return;
    }

    void refreshLobbyRooms();
    const interval = setInterval(() => {
      void refreshLobbyRooms();
    }, 3000);

    return () => clearInterval(interval);
  }, [inRoom, refreshLobbyRooms]);

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

  // Remove any pending (unconfirmed) local selections that became invalid on the server.
  // This keeps the local preview in sync when another player claims those squares first.
  const prunePendingSelectionsAgainstServerState = useCallback((state: DungeonState) => {
    if (!state) {
      return;
    }

    setSelectedSquares((prev) => {
      if (!prev.length) {
        return prev;
      }

      const next = prev.filter((selection) => {
        const fallbackRoomIndex = typeof selection.roomIndex === 'number' ? selection.roomIndex : 0;
        const resolvedRoomIndex = typeof selection.serverRoomIndex === 'number'
          ? selection.serverRoomIndex
          : (state.displayedRoomIndices?.[fallbackRoomIndex] ?? fallbackRoomIndex);

        const room = state.rooms?.[resolvedRoomIndex];
        if (!room) {
          return false;
        }

        const square = room.squares?.[selection.y * room.width + selection.x];
        if (!square) {
          return false;
        }

        return !square.wall && !square.checked;
      });

      if (next.length !== prev.length) {
        console.log('Removed stale pending room selections after server update');
      }
      return next;
    });

    setSelectedMonsterSquares((prev) => {
      if (!prev.length) {
        return prev;
      }

      const monstersById = new Map<string, any>();
      for (const monster of (state.activeMonsters || [])) {
        monstersById.set(String((monster as any).id), monster as any);
      }
      const next = prev.filter((selection) => {
        const monster = monstersById.get(selection.monsterId);
        if (!monster) {
          return false;
        }

        const square = monster.squares?.[selection.y * monster.width + selection.x];
        if (!square) {
          return false;
        }

        return square.filled && !square.checked;
      });

      if (next.length !== prev.length) {
        console.log('Removed stale pending monster selections after server update');
      }
      return next;
    });
  }, []);

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
    if (selectedMonsterSquares.length > 0 && !isHeroicMoveAndFightCard(activeCard)) {
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

    if (activeCard.selectionMode === 'cunning_three_step_different_cards') {
      if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const targetSquare = room.squares[y * room.width + x];
      if (!targetSquare || targetSquare.wall || targetSquare.checked) {
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

    if (activeCard.selectionMode === 'centered_room_3x3') {
      if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const centerSquare = room.squares[y * room.width + x];
      if (!centerSquare || centerSquare.wall || centerSquare.checked) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        return;
      }

      const surroundingSquares: Array<{ roomIndex: number; x: number; y: number; serverRoomIndex?: number }> = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const targetX = x + dx;
          const targetY = y + dy;
          if (targetX < 0 || targetX >= room.width || targetY < 0 || targetY >= room.height) {
            continue;
          }

          const targetSquare = room.squares[targetY * room.width + targetX];
          if (!targetSquare || targetSquare.wall || targetSquare.checked) {
            continue;
          }

          surroundingSquares.push({
            roomIndex: displayRoomIndex,
            serverRoomIndex,
            x: targetX,
            y: targetY
          });
        }
      }

      const selectedSpreadSquares = [
        { roomIndex: displayRoomIndex, serverRoomIndex, x, y },
        ...surroundingSquares.filter((pos) => !(pos.x === x && pos.y === y))
      ];

      const hasRequiredAdjacency = selectedSpreadSquares.some((pos) =>
        isAdjacentToEntranceOrCrossedSquare(room, pos.x, pos.y)
      );
      if (!hasRequiredAdjacency) {
        setInvalidSquareHighlight({ roomIndex: displayRoomIndex, x, y });
        setTimeout(() => setInvalidSquareHighlight(null), 500);
        console.log('Invalid Spread Out selection: at least one square must be adjacent to entrance or crossed square');
        return;
      }

      setSelectedSquares(selectedSpreadSquares);
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

    const allowsMonsterSelection = cardAllowsMonsterSelection(activeCard);
    if (!allowsMonsterSelection) {
      console.log('Active card does not allow selecting monster squares');
      return;
    }

    // Prevent mixing monster + room selections in the same card action
    if (selectedSquares.length > 0 && !isHeroicMoveAndFightCard(activeCard)) {
      console.log('Cannot select monster squares while room squares are selected');
      return;
    }

    const allowsMultiMonster = activeCard.selectionTarget === 'monster_each';
    const maxSelections = activeCard.maxSelections || 0;
    const maxSelectionsForMonster = isHeroicMoveAndFightCard(activeCard) ? 2 : maxSelections;

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

    if (!canCardTargetMonster(activeCard, monster)) {
      console.log('Active card cannot target this monster');
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

    if (activeCard.selectionMode === 'cunning_three_step_different_cards') {
      const square = monster.squares[y * monster.width + x];
      if (!square || !square.filled || square.checked) {
        console.log('Invalid Cunning monster step placement');
        return;
      }

      if (roomRef.current) {
        roomRef.current.send('crossMonsterSquare', { monsterId, x, y });
      }
      return;
    }

    if (activeCard.selectionMode === 'centered_monster_3x3' || activeCard.selectionMode === 'monster_swipe_l') {
      if (roomRef.current) {
        roomRef.current.send('crossMonsterSquare', { monsterId, x, y });
      }
      return;
    }

    const selectedForMonster = selectedMonsterSquares.filter((pos) => pos.monsterId === monsterId);

    // Enforce max selection limits
    if (maxSelectionsForMonster > 0) {
      if (allowsMultiMonster) {
        if (selectedForMonster.length >= maxSelectionsForMonster) {
          console.log(`Maximum of ${maxSelectionsForMonster} squares can be selected per monster`);
          return;
        }
      } else if (selectedMonsterSquares.length >= maxSelectionsForMonster) {
        console.log(`Maximum of ${maxSelectionsForMonster} squares can be selected per card`);
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
    const isDiagonalAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      Math.abs(ax - bx) === 1 && Math.abs(ay - by) === 1;

    // Connectivity (per monster): subsequent squares must be adjacent to existing selections on this monster
    if (activeCard.requiresConnected && selectedForMonster.length > 0) {
      const isConnected = isCombatCard(activeCard)
        ? selectedForMonster.some(pos => isDiagonalAdjacent(x, y, pos.x, pos.y))
        : selectedForMonster.some(pos => isOrthAdjacent(x, y, pos.x, pos.y));
      if (!isConnected) {
        console.log(
          isCombatCard(activeCard)
            ? 'Monster square must be diagonally connected to selected squares'
            : 'Monster square must be orthogonally connected to selected squares'
        );
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
    const maxRoomSelections = isHeroicMoveAndFightCard(card) ? 2 : maxSelections;
    if (maxRoomSelections > 0 && selectedSquares.length >= maxRoomSelections) {
      return { valid: false, reason: `Maximum of ${maxRoomSelections} squares can be selected per card` };
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

  const getJoinErrorMessage = (error: any): string => {
    const message = typeof error?.message === 'string' ? error.message.trim() : '';
    if (message.toLowerCase().includes('seat reservation expired')) {
      return 'Reconnection window expired. Rejoin from the lobby.';
    }

    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }
    return 'Unable to join room.';
  };

  async function connectToRoom(
    joinAction: () => Promise<Room<DungeonRoomState>>,
    options?: { suppressJoinError?: boolean }
  ): Promise<boolean> {
    setIsJoiningRoom(true);
    setLobbyError(null);

    try {
      roomRef.current = await joinAction();
      const joinedRoom = roomRef.current;

      const applyStateUpdate = (state: DungeonState) => {
        if (!state) {
          return;
        }

        console.log("Full state update received");
        // Force a complete re-render when state changes
        setUpdateCounter(prev => prev + 1);

        // Update game state
        setGameState(state);

        // Keep local pending selections aligned with authoritative server state.
        prunePendingSelectionsAgainstServerState(state);

        // Update displayed rooms
        updateDisplayedRooms(state);

        // Update current player
        if (state.players && joinedRoom.sessionId) {
          const player = state.players.get(joinedRoom.sessionId);
          console.log('Updating current player:', player);
          if (player) {
            console.log('Player deck length:', player.deck.length);
            console.log('Player drawnCards length:', player.drawnCards.length);
            console.log('Player hasDrawnCard:', player.hasDrawnCard);
          }
          setCurrentPlayer(player || null);
        }
      };

      // Register state listener immediately on join to avoid missing initial state on late join.
      joinedRoom.onStateChange((state) => applyStateUpdate(state as DungeonState));
      // Apply the latest snapshot immediately (covers the case where initial state arrived before listeners were attached).
      applyStateUpdate(joinedRoom.state as DungeonState);

      setInRoom(true);
      console.log('joined successfully', roomRef);

      setSelectedSquares([]);
      setSelectedMonsterSquares([]);
      setMonsterAttackAnimations([]);
      setDeckReturnAnimations([]);
      setRoomCodeInput('');
      lastAnnouncedDayRef.current = null;
      lastGameStatusRef.current = null;
      setDayBanner(null);
      setGameResultBanner(null);

      const playerNameForReconnect = reconnectNameRef.current || normalizedName || '';
      if (playerNameForReconnect) {
        setName(playerNameForReconnect);
      }
      if (joinedRoom.reconnectionToken) {
        savePersistedReconnection(joinedRoom.reconnectionToken, playerNameForReconnect);
      }

      const $ = getStateCallbacks(joinedRoom);

      $(joinedRoom.state).players.onAdd((player, sessionId) => {
        const playerName = player?.name || '(unknown)';
        console.log(`Player added: ${playerName} (sessionId: ${sessionId})`);
        setInRoom(true);
      });

      $(joinedRoom.state).rooms.onAdd((room, index) => {
        console.log(`Room added at index ${index}, width: ${room.width}, height: ${room.height}`);

        // Listen for changes to the current room index
        $(joinedRoom.state).listen("currentRoomIndex", (currentIndex) => {
          console.log(`Current room index changed to ${currentIndex}`);
          setCurrentRoom(joinedRoom.state.rooms[currentIndex]);
          setUpdateCounter(prev => prev + 1);

          // Update displayed rooms when current room changes
          updateDisplayedRooms(joinedRoom.state);
        });

        // Set the initial current room
        if (index === joinedRoom.state.currentRoomIndex) {
          setCurrentRoom(room);
        }

        // Listen for changes to squares in the room
        $(room).squares.onChange((square, squareIndex) => {
          // console.log(`Square changed at index ${squareIndex}`);
        });
      });

      // Listen for changes to displayed room indices
      $(joinedRoom.state).displayedRoomIndices.onAdd((roomIndex, i) => {
        console.log(`Displayed room index added: ${roomIndex} at position ${i}`);
        updateDisplayedRooms(joinedRoom.state);
      });

      // Listen for changes to room positions
      $(joinedRoom.state).roomPositionsX.onChange((value, i) => {
        console.log(`Room position X changed at index ${i}: ${value}`);
        updateDisplayedRooms(joinedRoom.state);
      });

      $(joinedRoom.state).roomPositionsY.onChange((value, i) => {
        console.log(`Room position Y changed at index ${i}: ${value}`);
        updateDisplayedRooms(joinedRoom.state);
      });

      $(joinedRoom.state).players.onChange((player: Player | undefined, sessionId: string) => {
        const playerName = player?.name || '(unknown)';
        console.log(`Player changed: ${playerName} (sessionId: ${sessionId})`);
      });

      // Add message handlers
      joinedRoom.onMessage('drawCardResult', (message) => {
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
      joinedRoom.onMessage('crossSquareResult', (message) => {
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
      joinedRoom.onMessage('cancelCardActionResult', (message) => {
        console.log('Cancel card action result:', message);

        if (message.success) {
          // Card action was successfully cancelled - clear selected squares
          setSelectedSquares([]);
          setSelectedMonsterSquares([]);
        }
      });

      // Handle discard card action results
      joinedRoom.onMessage('discardCardActionResult', (message) => {
        console.log('Discard card action result:', message);

        if (message.success) {
          setSelectedSquares([]);
          setSelectedMonsterSquares([]);
        }
      });

      // Handle confirm card action results
      joinedRoom.onMessage('confirmCardActionResult', (message) => {
        console.log('Confirm card action result:', message);

        if (message.success && message.completed) {
          // Card action was successfully completed - clear selected squares
          setSelectedSquares([]);
          setSelectedMonsterSquares([]);
        }
      });

      // Handle play card results
      joinedRoom.onMessage('playCardResult', (message) => {
        console.log('Play card result:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      // Handle turn advanced results
      joinedRoom.onMessage('turnAdvanced', (message) => {
        console.log('Turn advanced:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      joinedRoom.onMessage('monsterAttackPhase', (message) => {
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
          const color =
            attack?.card?.color === 'red' || attack?.card?.color === 'blue' || attack?.card?.color === 'green'
              ? attack.card.color
              : 'clear';

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
                  name: String(attack.card.name || ''),
                  description: String(attack.card.description || ''),
                  defenseSymbol,
                  color
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
                  name: attack.card.name || '',
                  description: attack.card.description,
                  defenseSymbol: attack.card.defenseSymbol,
                  color: attack.card.color
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
      return true;
    } catch (error) {
      if (!options?.suppressJoinError) {
        console.error('join error', error);
        setLobbyError(getJoinErrorMessage(error));
      }
      setInRoom(false);
      roomRef.current = undefined;
      return false;
    } finally {
      setIsJoiningRoom(false);
    }
  }

  async function createRoom() {
    if (!clientRef.current || !canJoinLobbyActions) {
      if (!normalizedName.length) {
        setLobbyError('Enter your character name before creating a game.');
      }
      return;
    }

    setName(normalizedName);
    reconnectNameRef.current = normalizedName;
    await connectToRoom(() => clientRef.current!.create(DUNGEON_ROOM_NAME, { name: normalizedName }));
  }

  async function joinRoomByCode() {
    if (!clientRef.current || !canJoinLobbyActions) {
      if (!normalizedName.length) {
        setLobbyError('Enter your character name before joining a game.');
      }
      return;
    }

    const requestedRoomCode = roomCodeInput.trim();
    if (!requestedRoomCode) {
      setLobbyError('Enter a room code.');
      return;
    }

    setName(normalizedName);
    reconnectNameRef.current = normalizedName;
    await connectToRoom(() => clientRef.current!.joinById(requestedRoomCode, { name: normalizedName }));
  }

  async function joinLobbyRoom(roomId: string) {
    if (!clientRef.current || !canJoinLobbyActions) {
      if (!normalizedName.length) {
        setLobbyError('Enter your character name before joining a game.');
      }
      return;
    }

    setName(normalizedName);
    reconnectNameRef.current = normalizedName;
    await connectToRoom(() => clientRef.current!.joinById(roomId, { name: normalizedName }));
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

      const eligible = gameState.activeMonsters.filter(
        (m: any) => canCardTargetMonster(activeCard, m) && !isMonsterCompleted(m)
      );
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
      if (isHeroicMoveAndFightCard(activeCard)) {
        if (roomCount !== 2) return false;

        const roomIndex = selectedSquares[0]?.roomIndex;
        if (roomIndex === undefined || selectedSquares.some((s) => s.roomIndex !== roomIndex)) return false;

        const sessionId = roomRef.current?.sessionId;
        if (!sessionId || !gameState?.activeMonsters) return false;

        const eligibleMonsters = gameState.activeMonsters.filter(
          (m: any) => canCardTargetMonster(activeCard, m) && !isMonsterCompleted(m)
        );

        if (monsterCount === 0) {
          return eligibleMonsters.length === 0;
        }

        if (monsterCount > 2) return false;

        const monsterId = selectedMonsterSquares[0]?.monsterId;
        if (!monsterId || selectedMonsterSquares.some((s) => s.monsterId !== monsterId)) return false;
        if (!eligibleMonsters.some((m: any) => m.id === monsterId)) return false;

        return true;
      }

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
        <div className="flex h-full w-full items-start justify-center bg-slate-950 px-4 py-8 text-slate-100">
          <div className="w-full max-w-5xl space-y-6">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h1 className="text-2xl font-bold">Cross-Off Dungeon Lobby</h1>
              <p className="mt-1 text-sm text-slate-300">Enter your name, then create or join a game.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  className="rounded-md border border-slate-500 bg-slate-100 px-3 py-2 text-black"
                  type="text"
                  value={name}
                  placeholder="Character Name"
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  onClick={createRoom}
                  disabled={!canJoinLobbyActions}
                  className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isJoiningRoom ? 'Joining...' : 'Create Game'}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  className="rounded-md border border-slate-500 bg-slate-100 px-3 py-2 text-black"
                  type="text"
                  value={roomCodeInput}
                  placeholder="Room Code"
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
                <button
                  onClick={joinRoomByCode}
                  disabled={!canJoinLobbyActions}
                  className="rounded bg-blue-600 px-4 py-2 font-semibold text-white enabled:hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isJoiningRoom ? 'Joining...' : 'Join By Code'}
                </button>
              </div>
              {lobbyError && (
                <p className="mt-3 text-sm font-medium text-rose-300">{lobbyError}</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">Available Games</h2>
                <button
                  onClick={() => void refreshLobbyRooms()}
                  disabled={isJoiningRoom}
                  className="rounded border border-slate-500 px-3 py-1 text-sm font-medium text-slate-100 enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              {availableRooms.length === 0 && (
                <p className="text-sm text-slate-300">No joinable games yet. Create one to get started.</p>
              )}
              {availableRooms.length > 0 && (
                <div className="space-y-2">
                  {availableRooms.map((room) => {
                    const code = room.metadata?.roomCode || room.roomId;
                    const day = Number(room.metadata?.currentDay || 1);
                    const turn = Number(room.metadata?.currentTurn || 1);
                    const players = Number(room.clients || 0);
                    const isFull = players >= Number(room.maxClients || 4) || room.locked === true;

                    return (
                      <div key={room.roomId} className="grid grid-cols-1 items-center gap-3 rounded border border-slate-700 bg-slate-800 px-3 py-3 text-sm md:grid-cols-[1fr_140px_120px_120px_auto]">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Room Code</div>
                          <div className="font-mono text-base font-semibold">{code}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Players</div>
                          <div>{players}/{room.maxClients}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Day</div>
                          <div>{day}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Turn</div>
                          <div>{turn}</div>
                        </div>
                        <button
                          onClick={() => joinLobbyRoom(room.roomId)}
                          disabled={!canJoinLobbyActions || isFull}
                          className="rounded bg-cyan-600 px-3 py-2 font-semibold text-white enabled:hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isFull ? 'Full' : 'Join'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {inRoom && (
        <div className="flex h-screen w-full">
          {/* Left side panel for game information */}
          <div className="w-64 relative z-[120] flex flex-col bg-slate-800 p-4 overflow-visible border-r border-slate-700 h-[calc(100vh-20rem)]" >
            <div className="mb-4 rounded border border-slate-600 bg-slate-700 p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-300">Room Code</div>
                  <div className="font-mono text-lg font-bold text-white">{roomCode}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCardLibraryOpen(true)}
                  className="rounded border border-slate-500 bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600"
                >
                  ⚙ Settings
                </button>
              </div>
            </div>
            <span>
              <h2 className="text-xl font-bold mb-4">Players</h2>
              <ul className="space-y-2">
                {gameState?.players && Array.from(gameState.players.entries()).map(([sessionId, player]) => {
                  if (!player) {
                    return null;
                  }

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

                  const playerMonsters = monstersByPlayer.get(sessionId) || [];
                  const hasMonsters = playerMonsters.length > 0;
                  const isMonsterPopoverOpen = openMonsterPopoverFor === sessionId;
                  const canTargetAnyListedMonster = playerMonsters.some((monster: any) =>
                    canCardTargetMonster(activeCard, monster)
                  );

                  return (
                    <li key={sessionId} className="relative p-2 bg-slate-700 rounded flex justify-between items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{getStatusIcon(player.turnStatus)}</span>
                          <span className={`status-indicator text-sm font-medium ${getStatusColor(player.turnStatus)}`}>
                            {formatStatus(player.turnStatus)}
                          </span>
                        </div>

                        {hasMonsters && (
                          <div
                            className="relative"
                            onMouseEnter={() => openMonsterPopover(sessionId)}
                            onMouseLeave={closeMonsterPopoverWithDelay}
                          >
                            <div className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-amber-300 bg-amber-500/20 px-2 text-xs font-bold text-amber-100">
                              <span className="leading-none">👾</span>
                              <span>{playerMonsters.length}</span>
                            </div>

                            <div
                              className={`absolute left-full top-1/2 z-[180] ml-1 w-64 -translate-y-1/2 rounded-lg border border-slate-500 bg-slate-900/95 p-2 shadow-2xl transition-opacity duration-150 ${
                                isMonsterPopoverOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                              }`}
                            >
                              <div className="mb-2 text-xs font-semibold text-slate-300">
                                {player.name}&apos;s Monsters ({playerMonsters.length})
                              </div>

                              <div className="max-h-72 overflow-auto">
                                <div className="flex min-w-max gap-3 pr-1">
                                  {playerMonsters.map((monster: any) => (
                                    <MonsterCard
                                      key={`player-monster-${sessionId}-${monster.id}`}
                                      monster={monster}
                                      isOwnedByPlayer={monster.playerOwnerId === roomRef.current?.sessionId}
                                      canDrag={false}
                                      canSelect={canCardTargetMonster(activeCard, monster)}
                                      selectedSquares={selectedMonsterSquares
                                        .filter((pos) => pos.monsterId === monster.id)
                                        .map((pos) => ({ x: pos.x, y: pos.y }))}
                                      onSquareClick={(x, y) => handleMonsterSquareClick(monster.id, x, y)}
                                      horizontalPairPreviewEnabled={showHorizontalPairPreview}
                                      cunningStepPreviewLength={cunningPreviewStepLength}
                                      combatBlastPreviewEnabled={showCombatBlastPreview}
                                      swipePreviewEnabled={showSwipePreview}
                                      disableHoverZoom={true}
                                      className="monster-owned"
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="mt-2 text-[11px] text-slate-400">
                                {canTargetAnyListedMonster
                                  ? 'Click monster squares to target them with your active card.'
                                  : 'Play a monster-targeting card to click squares here.'}
                              </div>
                            </div>
                          </div>
                        )}
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
          <div className="flex-1 min-h-0 min-w-0 bg-slate-900 flex flex-col">
            {/* Card Action Buttons - fixed header above room scroll area */}
            <div className="z-50 shrink-0 flex w-full justify-center px-4 pt-4 pb-2 pointer-events-none">
              <div className="flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
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
                <DiscardCardButton
                  player={currentPlayer}
                  room={roomRef.current}
                  isVisible={currentPlayer?.drawnCards.some(card => card.isActive)}
                  onDiscard={handleCancelCleanup}
                />
              </div>
            </div>

            <div ref={mapScrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto relative">
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
                  horizontalPairPreviewEnabled={showHorizontalPairPreview}
                  cunningStepPreviewLength={cunningPreviewStepLength}
                  spreadOutPreviewEnabled={showSpreadOutPreview}
                />
              )}

              {/* Monsters are now displayed inside room containers */}
            </div>
          </div>

          {/* Bottom drawer for player's area */}
          <div ref={playerAreaRef} className="player-area fixed bottom-0 left-0 right-0 h-72 bg-slate-800 border-t-2 border-slate-600 p-2 z-50">
            <div className="flex flex-col h-full gap-2">
              <div className="flex-1 flex gap-4 min-h-0 items-center">
                <div className="bg-slate-700 border-2 border-slate-600 p-4 rounded flex-1 h-full flex items-center">
                  <div className="flex justify-start gap-6 items-center">
                    <CardDeck player={currentPlayer} room={roomRef.current} />
                    <DrawnCard player={currentPlayer} room={roomRef.current} key={updateCounter} />
                    <DiscardPile
                      player={currentPlayer}
                      room={roomRef.current}
                      onDiscardDrop={handleCancelCleanup}
                    />
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
                  cunningPreviewStepLength={cunningPreviewStepLength}
                  attackAnimations={monsterAttackAnimations}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <CardLibraryScreen isOpen={inRoom && isCardLibraryOpen} onClose={() => setIsCardLibraryOpen(false)} />

      {inRoom && dayBanner && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
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
          title={`${(anim.card.name || '').trim() || 'Heroic'}: ${anim.card.description}`}
        >
          <CardFaceContent
            type={anim.card.type}
            name={anim.card.name}
            description={anim.card.description}
            defenseSymbol={anim.card.defenseSymbol}
            color={anim.card.color}
          />
        </div>
      ))}
    </main>
  );
}
