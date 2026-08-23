// ============================================
// ARCANE VISUALS
// Pure SVG + CSS artwork for the magic world: summoning circles (วงเวท)
// and portal gates (ประตูเวท).
//
// Ambient rotation is done with CSS keyframes rather than JS animation —
// these loop forever, so keeping them off the main thread matters. Framer
// Motion is layered on top by the caller for scroll-driven transforms.
// ============================================

import { useId } from 'react';
import type { CSSProperties } from 'react';

const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];

/**
 * Traces an {n/step} star polygon — the geometric heart of a summoning circle.
 * Requires gcd(n, step) === 1 to close in a single unbroken stroke.
 */
function polygram(cx: number, cy: number, r: number, n: number, step: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (((i * step) % n) / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

// Arch geometry: arc centred at (120,150), outer r=84, inner r=62, base at y=306.
const GATE_FRAME =
  'M36 306L36 150A84 84 0 0 1 204 150L204 306L182 306L182 150A62 62 0 0 0 58 150L58 306Z';
const GATE_PORTAL = 'M58 306L58 150A62 62 0 0 1 182 150L182 306Z';

/** Renders once per page — shared keyframes for every arcane visual. */
export function MagicVisualStyles() {
  return (
    <style>{`
      .mv-circle { display: block; overflow: visible; }
      .mv-gate { display: block; height: auto; overflow: visible; }

      .mv-spin { transform-origin: 100px 100px; animation: mvSpin var(--mv-dur, 54s) linear infinite; }
      .mv-rev { animation-direction: reverse; }
      @keyframes mvSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      .mv-rune { font-family: var(--mono); user-select: none; }

      /* Portal energy rippling up through the gate mouth. */
      .mv-wave { transform-origin: 120px 250px; animation: mvWave 5.6s ease-out infinite; }
      @keyframes mvWave {
        0%   { transform: scale(0.35); opacity: 0; }
        30%  { opacity: 0.55; }
        100% { transform: scale(1.75); opacity: 0; }
      }

      .mv-breathe { animation: mvBreathe 7s ease-in-out infinite; }
      @keyframes mvBreathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .mv-spin, .mv-wave, .mv-breathe { animation: none; }
      }
    `}</style>
  );
}

interface MagicCircleProps {
  /** Any CSS length — `min(90vmin, 760px)` is fine. */
  size?: number | string;
  color?: string;
  /** Seconds for one rotation of the outer ring; inner rings derive from it. */
  spin?: number;
  opacity?: number;
  runes?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function MagicCircle({
  size = 420,
  color = '#7fb0ff',
  spin = 54,
  opacity = 1,
  runes = true,
  className = '',
  style,
}: MagicCircleProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`mv-circle ${className}`}
      style={{ width: size, height: size, opacity, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {/* outer bezel + cardinal ticks */}
      <g className="mv-spin" style={{ '--mv-dur': `${spin}s` } as CSSProperties}>
        <circle cx="100" cy="100" r="97" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="0.8 4" />
        <circle cx="100" cy="100" r="93" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.7" />
        {[0, 90, 180, 270].map((d) => (
          <rect key={d} x="99.1" y="1.5" width="1.8" height="9" fill={color} fillOpacity="0.65" transform={`rotate(${d} 100 100)`} />
        ))}
      </g>

      {/* rune band, counter-rotating */}
      <g className="mv-spin mv-rev" style={{ '--mv-dur': `${(spin * 0.74).toFixed(1)}s` } as CSSProperties}>
        {runes &&
          RUNES.map((r, i) => (
            <text
              key={`${r}-${i}`}
              x="100"
              y="16"
              className="mv-rune"
              fill={color}
              fillOpacity="0.78"
              fontSize="9.5"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${i * 30} 100 100)`}
            >
              {r}
            </text>
          ))}
        <circle cx="100" cy="100" r="76" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.6" strokeDasharray="9 5" />
      </g>

      {/* {12/5} star sigil */}
      <g className="mv-spin" style={{ '--mv-dur': `${(spin * 1.9).toFixed(1)}s` } as CSSProperties}>
        <circle cx="100" cy="100" r="66" fill="none" stroke={color} strokeOpacity="0.42" strokeWidth="0.7" />
        <path d={polygram(100, 100, 66, 12, 5)} fill="none" stroke={color} strokeOpacity="0.42" strokeWidth="0.6" strokeLinejoin="round" />
      </g>

      {/* hexagram */}
      <g className="mv-spin mv-rev" style={{ '--mv-dur': `${(spin * 2.6).toFixed(1)}s` } as CSSProperties}>
        <path d={polygram(100, 100, 45, 3, 1)} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.7" strokeLinejoin="round" />
        <path d={polygram(100, 100, 45, 3, 1)} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.7" strokeLinejoin="round" transform="rotate(180 100 100)" />
      </g>

      <circle cx="100" cy="100" r="30" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="3.5" fill={color} fillOpacity="0.9" className="mv-breathe" />
    </svg>
  );
}

interface MagicGateProps {
  /** Any CSS length; height follows the 240×330 aspect ratio. */
  width?: number | string;
  color?: string;
  /** 0 = dormant stone, 1 = fully charged portal. */
  intensity?: number;
  className?: string;
  style?: CSSProperties;
}

export function MagicGate({
  width = 300,
  color = '#7fb0ff',
  intensity = 0.7,
  className = '',
  style,
}: MagicGateProps) {
  // useId keeps gradient/clip ids unique when several gates share a page.
  const uid = useId().replace(/:/g, '');
  const voidId = `mv-void-${uid}`;
  const stoneId = `mv-stone-${uid}`;
  const clipId = `mv-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 240 330"
      className={`mv-gate ${className}`}
      style={{ width, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={voidId} cx="50%" cy="64%" r="64%">
          <stop offset="0%" stopColor={color} stopOpacity={0.6 * intensity} />
          <stop offset="42%" stopColor={color} stopOpacity={0.2 * intensity} />
          <stop offset="100%" stopColor="#03040a" stopOpacity="0.96" />
        </radialGradient>
        <linearGradient id={stoneId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2745" />
          <stop offset="55%" stopColor="#111a30" />
          <stop offset="100%" stopColor="#070b18" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={GATE_PORTAL} />
        </clipPath>
      </defs>

      {/* the void beyond the threshold */}
      <path d={GATE_PORTAL} fill={`url(#${voidId})`} />

      {/* energy rippling up out of the portal */}
      <g clipPath={`url(#${clipId})`} style={{ opacity: intensity }}>
        {[0, 1.9, 3.7].map((delay, i) => (
          <ellipse
            key={i}
            className="mv-wave"
            cx="120"
            cy="250"
            rx="62"
            ry="15"
            fill="none"
            stroke={color}
            strokeOpacity="0.5"
            strokeWidth="1.2"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        <ellipse cx="120" cy="306" rx="62" ry="20" fill={color} fillOpacity={0.28 * intensity} />
      </g>

      {/* stone arch */}
      <path d={GATE_FRAME} fill={`url(#${stoneId})`} stroke={color} strokeOpacity="0.32" strokeWidth="1" strokeLinejoin="round" />

      {/* rim light along the threshold */}
      <path d={GATE_PORTAL} fill="none" stroke={color} strokeOpacity={0.35 + 0.55 * intensity} strokeWidth="1.6" />

      {/* runes carved along the arch */}
      {Array.from({ length: 7 }).map((_, i) => {
        const a = Math.PI + (i / 6) * Math.PI;
        const x = 120 + Math.cos(a) * 73;
        const y = 150 + Math.sin(a) * 73;
        const deg = (a * 180) / Math.PI + 90;
        return (
          <text
            key={i}
            x={x}
            y={y}
            className="mv-rune"
            fill={color}
            fillOpacity="0.6"
            fontSize="8"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${deg.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`}
          >
            {RUNES[i]}
          </text>
        );
      })}

      {/* keystone */}
      <path d="M120 50l11 13-11 13-11-13z" fill={`url(#${stoneId})`} stroke={color} strokeOpacity={0.4 + 0.4 * intensity} strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="120" cy="63" r="2.6" fill={color} fillOpacity={0.5 + 0.5 * intensity} className="mv-breathe" />

      {/* pillar coursing */}
      {[186, 226, 266].map((y) => (
        <g key={y}>
          <line x1="36" y1={y} x2="58" y2={y} stroke={color} strokeOpacity="0.18" strokeWidth="0.8" />
          <line x1="182" y1={y} x2="204" y2={y} stroke={color} strokeOpacity="0.18" strokeWidth="0.8" />
        </g>
      ))}

      {/* plinth */}
      <rect x="22" y="306" width="196" height="13" rx="2.5" fill={`url(#${stoneId})`} stroke={color} strokeOpacity="0.28" strokeWidth="0.9" />
    </svg>
  );
}
