import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmMoveButton from '../ConfirmMoveButton';
import { Player } from '@/types/Player';

describe('ConfirmMoveButton', () => {
  it('submits pending room selections only on confirm', () => {
    const send = jest.fn();
    const room: any = {
      send,
      state: {
        displayedRoomIndices: [10, 11, 12],
        currentRoomIndex: 10
      }
    };

    render(
      <ConfirmMoveButton
        player={{} as Player}
        room={room}
        selectedCount={3}
        isVisible={true}
        isReady={true}
        selectedSquares={[
          { roomIndex: 0, x: 1, y: 2 },
          { roomIndex: 0, x: 1, y: 3 },
          { roomIndex: 1, x: 2, y: 3 }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('confirmCardAction', {
      roomSquares: [
        { roomIndex: 10, x: 1, y: 2 },
        { roomIndex: 10, x: 1, y: 3 },
        { roomIndex: 11, x: 2, y: 3 }
      ]
    });
  });

  it('prefers serverRoomIndex when provided', () => {
    const send = jest.fn();
    const room: any = {
      send,
      state: {
        displayedRoomIndices: [10, 11, 12],
        currentRoomIndex: 10
      }
    };

    render(
      <ConfirmMoveButton
        player={{} as Player}
        room={room}
        selectedCount={1}
        isVisible={true}
        isReady={true}
        selectedSquares={[{ roomIndex: 1, serverRoomIndex: 999, x: 2, y: 3 }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('confirmCardAction', {
      roomSquares: [{ roomIndex: 999, x: 2, y: 3 }]
    });
  });

  it('submits pending monster selections only on confirm', () => {
    const send = jest.fn();
    const room: any = {
      send,
      state: {
        displayedRoomIndices: [0],
        currentRoomIndex: 0
      }
    };

    render(
      <ConfirmMoveButton
        player={{} as Player}
        room={room}
        selectedCount={2}
        isVisible={true}
        isReady={true}
        selectedMonsterSquares={[
          { monsterId: 'slime_1', x: 0, y: 0 },
          { monsterId: 'slime_1', x: 1, y: 0 }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('confirmCardAction', {
      monsterSquares: [
        { monsterId: 'slime_1', x: 0, y: 0 },
        { monsterId: 'slime_1', x: 1, y: 0 }
      ]
    });
  });

  it('submits horizontal pair room anchors for Heroic Double Sweep', () => {
    const send = jest.fn();
    const room: any = {
      send,
      state: {
        displayedRoomIndices: [10],
        currentRoomIndex: 10
      }
    };
    const player: any = {
      drawnCards: [
        {
          id: 'heroic-double-sweep',
          isActive: true,
          selectionMode: 'horizontal_pair_twice'
        }
      ]
    };

    render(
      <ConfirmMoveButton
        player={player}
        room={room}
        selectedCount={4}
        isVisible={true}
        isReady={true}
        selectedSquares={[
          { roomIndex: 0, x: 0, y: 0 },
          { roomIndex: 0, x: 1, y: 0 },
          { roomIndex: 0, x: 3, y: 0 },
          { roomIndex: 0, x: 4, y: 0 }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('confirmCardAction', {
      roomSquares: [
        { roomIndex: 10, x: 0, y: 0 },
        { roomIndex: 10, x: 3, y: 0 }
      ]
    });
  });

  it('submits horizontal pair monster anchors for Heroic Double Sweep', () => {
    const send = jest.fn();
    const room: any = {
      send,
      state: {
        displayedRoomIndices: [0],
        currentRoomIndex: 0
      }
    };
    const player: any = {
      drawnCards: [
        {
          id: 'heroic-double-sweep',
          isActive: true,
          selectionMode: 'horizontal_pair_twice'
        }
      ]
    };

    render(
      <ConfirmMoveButton
        player={player}
        room={room}
        selectedCount={4}
        isVisible={true}
        isReady={true}
        selectedMonsterSquares={[
          { monsterId: 'slime_1', x: 0, y: 0 },
          { monsterId: 'slime_1', x: 1, y: 0 },
          { monsterId: 'slime_1', x: 2, y: 1 },
          { monsterId: 'slime_1', x: 3, y: 1 }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm move/i }));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('confirmCardAction', {
      monsterSquares: [
        { monsterId: 'slime_1', x: 0, y: 0 },
        { monsterId: 'slime_1', x: 2, y: 1 }
      ]
    });
  });
});
