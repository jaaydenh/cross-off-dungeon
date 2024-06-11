import React, { useState } from 'react';
import Square from './square';

const Grid = (props: {
  squares: boolean[][];
  handleSquareClick: (x: number, y: number) => void;
}) => {
  const renderSquares = () => {
    const squares = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        squares.push(
          <Square
            key={`${i}-${j}`}
            x={i}
            y={j}
            checked={props.squares[i][j]}
            onClick={props.handleSquareClick}
          />
        );
      }
    }
    return squares;
  };

  return (
    <div style={{ width: '180px', display: 'flex', flexWrap: 'wrap' }}>
      {renderSquares()}
    </div>
  );
};

export default Grid;
