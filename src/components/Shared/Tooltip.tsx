'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ content, shortcut, children, position = 'bottom', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState<React.CSSProperties>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const adjustPosition = useCallback(() => {
    if (!tipRef.current || !wrapRef.current) return;
    const tipRect = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const style: React.CSSProperties = {};

    // If overflowing right edge
    if (tipRect.right > vw - 8) {
      style.left = 'auto';
      style.right = '0';
      style.transform = position === 'bottom' ? 'translateY(6px)' : position === 'top' ? 'translateY(-6px)' : undefined;
    }
    // If overflowing left edge
    if (tipRect.left < 8) {
      style.left = '0';
      style.right = 'auto';
      style.transform = position === 'bottom' ? 'translateY(6px)' : position === 'top' ? 'translateY(-6px)' : undefined;
    }

    setAdjustedPos(style);
  }, [position]);

  useEffect(() => {
    if (visible) {
      // Wait one frame for the tooltip to render
      requestAnimationFrame(adjustPosition);
    }
  }, [visible, adjustPosition]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const basePos: React.CSSProperties = (() => {
    switch (position) {
      case 'top': return { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-6px)' };
      case 'bottom': return { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(6px)' };
      case 'left': return { right: '100%', top: '50%', transform: 'translateY(-50%) translateX(-6px)' };
      case 'right': return { left: '100%', top: '50%', transform: 'translateY(-50%) translateX(6px)' };
    }
  })();

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          ref={tipRef}
          style={{
            position: 'absolute',
            ...basePos,
            ...adjustedPos,
            whiteSpace: 'nowrap',
            background: 'var(--text)',
            color: 'var(--bg)',
            fontFamily: "'Source Serif 4', serif",
            fontSize: 12,
            lineHeight: 1.4,
            padding: '6px 12px',
            borderRadius: 6,
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)',
            animation: 'fadeIn .15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{content}</span>
          {shortcut && (
            <span
              style={{
                background: 'rgba(255,255,255,.15)',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10.5,
                fontFamily: 'monospace',
                letterSpacing: '.04em',
              }}
            >
              {shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
