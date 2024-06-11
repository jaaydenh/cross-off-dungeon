import React from 'react';

const Square = ({ x, y, checked, onClick }) => {
  return (
    <div
      onClick={() => onClick(x, y)}
      className="flex items-center justify-center text-xl"
      style={{
        width: '40px',
        height: '40px',
        border: '1px solid black',
      }}
    >
      {checked === true ? 'X' : ''}
    </div>
  );
};

export default Square;
