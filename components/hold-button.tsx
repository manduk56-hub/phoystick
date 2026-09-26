'use client';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// Pointer capture allows independent thumbs; every exit path releases the input.
export default function HoldButton({
  children,
  onHold,
  disabled = false,
  className = '',
  label,
}: {
  children: ReactNode;
  onHold: (held: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const held = useRef(false);
  const pointer = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const notify = useEffectEvent(onHold);
  const release = useEffectEvent(() => {
    pointer.current = null;
    if (!held.current) return;
    held.current = false;
    setPressed(false);
    notify(false);
  });
  useEffect(() => {
    const stop = () => release();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hidden);
      if (held.current) notify(false);
    };
  }, []);
  useEffect(() => {
    if (disabled) release();
  }, [disabled]);
  const change = (value: boolean) => {
    if (held.current === value || (value && disabled)) return;
    held.current = value;
    setPressed(value);
    onHold(value);
  };
  return (
    <button
      type="button"
      className={`hold-button ${className}`}
      disabled={disabled}
      aria-label={label}
      data-pressed={pressed}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current !== null) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        change(true);
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        pointer.current = null;
        change(false);
      }}
      onPointerCancel={() => {
        pointer.current = null;
        change(false);
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
        change(false);
      }}
      onKeyDown={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          change(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          change(false);
        }
      }}
      onBlur={() => {
        pointer.current = null;
        change(false);
      }}
      onClick={(event) => {
        if (event.detail === 0 && !held.current) {
          onHold(true);
          onHold(false);
        }
      }}
    >
      {children}
    </button>
  );
}
