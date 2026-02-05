'use client';

import { useLayoutEffect, useRef } from 'react';

type CardFaceTextProps = {
  text: string;
  className?: string;
  maxFontPx?: number;
  minFontPx?: number;
};

/**
 * Fits card description text inside a fixed card face without breaking words.
 * - No mid-word wrapping (so "horizontal" never becomes "horizonta\nl")
 * - Centers vertically
 * - Shrinks font-size until it fits (instead of clipping the bottom)
 */
export default function CardFaceText({
  text,
  className = '',
  maxFontPx = 12,
  minFontPx = 7
}: CardFaceTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Reset to max size before fitting.
    let fontPx = maxFontPx;
    textEl.style.fontSize = `${fontPx}px`;
    textEl.style.lineHeight = '1.15';

    const computeAvailable = () => {
      const style = window.getComputedStyle(container);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      return {
        w: Math.max(0, container.clientWidth - padX),
        h: Math.max(0, container.clientHeight - padY)
      };
    };

    const fits = () => {
      const { w, h } = computeAvailable();
      return textEl.scrollWidth <= w && textEl.scrollHeight <= h;
    };

    // Decrease until it fits. (Low counts: only used for 1-2 cards on screen.)
    let guard = 0;
    while (!fits() && fontPx > minFontPx && guard < 50) {
      fontPx -= 1;
      textEl.style.fontSize = `${fontPx}px`;
      guard += 1;
    }
  }, [text, maxFontPx, minFontPx]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 rounded-lg overflow-hidden flex items-center justify-center p-2 ${className}`}
    >
      <div
        ref={textRef}
        className="text-center text-balance break-normal [overflow-wrap:normal] [word-break:keep-all]"
      >
        {text}
      </div>
    </div>
  );
}

