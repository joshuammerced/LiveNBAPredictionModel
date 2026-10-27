'use client';

import React, { Fragment, useEffect, useRef, useState } from 'react';
import { pairColors, teamStyle } from '@/lib/teams';

const MAX_TILT_DEG = 4; // subtle: stronger tilts made card text hard to read

export function teamVars(abbr: string | null | undefined): React.CSSProperties {
  const s = teamStyle(abbr);
  return { '--team-color': s.color, '--team-secondary': s.secondary } as React.CSSProperties;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** False on first paint, true two frames later, so CSS transitions run from the zero state. */
export function useGrown() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return grown;
}

export function GrowBar({ pct, color, className = 'm-bar-fill', delay = 0 }: {
  pct: number; color: string; className?: string; delay?: number;
}) {
  const grown = useGrown();
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`${className} grow-bar`}
      style={{ width: grown ? `${width}%` : '0%', background: color, transitionDelay: `${delay}ms` }}
    />
  );
}

export function CountUp({ value, decimals = 1, prefix = '', suffix = '', signed = false }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; signed?: boolean;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : 860;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = duration ? Math.min(1, (now - start) / duration) : 1;
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const sign = signed && value > 0 ? '+' : '';
  return <>{prefix}{sign}{shown.toFixed(decimals)}{suffix}</>;
}

export function TiltCard({ className = '', style, onClick, label, children }: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = ref.current;
    if (!card || prefersReducedMotion()) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const nx = (x - rect.width / 2) / (rect.width / 2);
    const ny = (y - rect.height / 2) / (rect.height / 2);
    card.style.transform =
      `perspective(950px) rotateX(${(-ny * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(nx * MAX_TILT_DEG).toFixed(2)}deg) scale3d(1.008, 1.008, 1.008)`;
    card.style.setProperty('--glare-x', `${x}px`);
    card.style.setProperty('--glare-y', `${y}px`);
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  const interactive = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      ref={ref}
      className={`tilt-card ${onClick ? 'is-clickable' : ''} ${className}`}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...interactive}
    >
      {children}
    </div>
  );
}

export function RectTag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="rect-tag" style={color ? ({ '--team-color': color } as React.CSSProperties) : undefined}>
      <span>{children}</span>
    </div>
  );
}

export function TeamLogo({ abbr, size = 'md' }: { abbr: string; size?: 'md' | 'lg' | 'sm' }) {
  return (
    <div className={`team-rect-logo size-${size}`} style={{ background: teamStyle(abbr).color }} aria-hidden="true">
      <span>{abbr}</span>
    </div>
  );
}

export function Divider({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="broadcast-divider">
      <h2><span className="rect-pip" />{title}</h2>
      {sub && <span className="broadcast-divider-sub">{sub}</span>}
    </div>
  );
}

export function SlashButton({ children, onClick, variant = 'primary' }: {
  children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'secondary';
}) {
  return (
    <button type="button" className={`${variant}-slash-btn`} onClick={onClick}>
      <span>{children}</span>
    </button>
  );
}

export function Donut({ pct, color, label, size = 150 }: { pct: number; color: string; label: string; size?: number }) {
  const grown = useGrown();
  const r = 56;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" role="img" aria-label={`${label}: ${pct.toFixed(0)}%`}>
      <circle cx="75" cy="75" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      <circle
        className="donut-progress-arc"
        cx="75" cy="75" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={circ}
        strokeDashoffset={grown ? circ * (1 - pct / 100) : circ}
        transform="rotate(-90 75 75)"
      />
      <text x="75" y="73" textAnchor="middle" fill="#0a0f1d" fontSize="24" fontWeight="900">
        <CountUp value={pct} decimals={0} suffix="%" />
      </text>
      <text x="75" y="92" textAnchor="middle" fill="#475569" fontSize="9.5" fontWeight="800">{label}</text>
    </svg>
  );
}

/** Two-sided probability bar: away fills from the left, home from the right. */
export function ProbBar({ homeProb, homeAbbr, awayAbbr, tall = false }: {
  homeProb: number; homeAbbr: string; awayAbbr: string; tall?: boolean;
}) {
  const grown = useGrown();
  const home = homeProb * 100;
  const colors = pairColors(awayAbbr, homeAbbr);
  return (
    <div className={`prob-bar ${tall ? 'tall' : ''}`} role="img"
         aria-label={`${awayAbbr} ${(100 - home).toFixed(0)}%, ${homeAbbr} ${home.toFixed(0)}%`}>
      <div className="prob-side away grow-bar" style={{ width: grown ? `${100 - home}%` : '0%', background: colors.away }} />
      <div className="prob-side home grow-bar" style={{ width: grown ? `${home}%` : '0%', background: colors.home }} />
    </div>
  );
}

/**
 * Fades its content out when `valueKey` changes, swaps to the new value, then fades back in.
 * Children remount on each swap, so bars and counters grow from zero again.
 */
export function FadeZone<T>({ value, valueKey, render }: {
  value: T; valueKey: string; render: (value: T) => React.ReactNode;
}) {
  const [shown, setShown] = useState({ key: valueKey, value });
  // Fading out = a new key has arrived but the old content is still on screen.
  const fading = valueKey !== shown.key;

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setShown({ key: valueKey, value }), 210);
    return () => clearTimeout(t);
  }, [fading, valueKey, value]);

  const current = fading ? shown.value : value;
  return (
    <div className={`sub-fade-zone ${fading ? 'fading-out' : ''}`}>
      <Fragment key={shown.key}>{render(current)}</Fragment>
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="loading-panel" role="status">
      <span className="loading-pip" />
      {label}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="error-panel" role="alert">
      <strong>Couldn&apos;t load data.</strong> {message}
    </div>
  );
}
