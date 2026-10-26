'use client';

import React from 'react';

export interface Wipe {
  id: number;
  label: string;
  colors: string[];
}

/** Four NBA colors cascade across the screen, then a black layer carrying the page label. */
export function PageWipe({ wipe }: { wipe: Wipe | null }) {
  const vars = wipe
    ? ({
        '--wipe-c1': wipe.colors[0],
        '--wipe-c2': wipe.colors[1],
        '--wipe-c3': wipe.colors[2],
        '--wipe-c4': wipe.colors[3],
      } as React.CSSProperties)
    : undefined;

  return (
    <div key={wipe?.id ?? 'idle'} className={`page-wipe-overlay ${wipe ? 'is-wiping' : ''}`} style={vars} aria-hidden="true">
      <div className="wipe-layer c1" />
      <div className="wipe-layer c2" />
      <div className="wipe-layer c3" />
      <div className="wipe-layer c4" />
      <div className="wipe-layer black-final">
        <div className="wipe-center-badge">{wipe?.label ?? ''}</div>
      </div>
    </div>
  );
}
