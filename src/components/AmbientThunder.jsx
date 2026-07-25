import { useEffect, useRef, useState } from 'react';
import { buildStrike, toPath } from '../lib/rng';

/**
 * App-wide storm: real red lightning bolts that strike at random intervals,
 * independent of scroll. Each strike forks from the top of the screen down to a
 * ground point, flickers with a couple of restrikes, and throws a red flash
 * across the whole scene — a genuine "hit", not just a CSS opacity pulse.
 *
 * This one is deliberately clock-driven (the scroll timeline owns the *impact*
 * lightning in LightningSmokeFX; this is ambient weather on top of it), so it
 * uses Math.random freely and does not need to be reversible.
 */

const MIN_GAP = 2200; // ms between strikes (min)
const MAX_GAP = 4800; // ms between strikes (max)
const LIFE = 340; // ms a single strike stays alive

// A short burst envelope: hard hit, a dark beat, a restrike, then fade.
function boltEnv(age) {
  if (age < 0 || age > LIFE) return 0;
  const t = age / LIFE;
  if (t < 0.16) return 1; // first crack
  if (t < 0.24) return 0.12; // dark beat
  if (t < 0.4) return 0.9; // restrike
  return Math.max(0, 1 - (t - 0.4) / 0.6) * 0.7; // fade out
}

// Red screen flash: instant attack, longer decay, small afterglow.
function flashEnv(age) {
  if (age < 0 || age > LIFE) return 0;
  const t = age / LIFE;
  const main = Math.max(0, 1 - t / 0.5) * (t < 0.06 ? t / 0.06 : 1);
  const after = t > 0.35 && t < 0.55 ? 0.3 : 0;
  return Math.min(1, main + after);
}

function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 1440 : window.innerWidth,
    h: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

function makeBolt(w, h) {
  const originX = w * (0.15 + Math.random() * 0.7);
  const targetX = originX + (Math.random() - 0.5) * w * 0.4;
  const targetY = h * (0.6 + Math.random() * 0.38);
  const strike = buildStrike(originX, -20, targetX, targetY, w * 0.12, Math.random);
  return {
    id: Math.random(),
    d: toPath(strike.main),
    branches: strike.branches.map(toPath),
    hitX: targetX,
    hitY: targetY,
    width: 2.4 + Math.random() * 2.6,
  };
}

export default function AmbientThunder() {
  const vp = useViewport();
  const [bolt, setBolt] = useState(null);

  const groupRef = useRef(null);
  const flashRef = useRef(null);
  const hitRef = useRef(null);
  const startRef = useRef(-1);
  const nextAtRef = useRef(0);
  const vpRef = useRef(vp);
  vpRef.current = vp;

  useEffect(() => {
    let raf;
    nextAtRef.current = performance.now() + 700; // first strike shortly after load

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();

      // time to fire a new strike?
      if (now >= nextAtRef.current) {
        setBolt(makeBolt(vpRef.current.w, vpRef.current.h));
        startRef.current = now;
        nextAtRef.current = now + MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
      }

      const age = startRef.current < 0 ? Infinity : now - startRef.current;
      const be = boltEnv(age);
      const fe = flashEnv(age);
      // a fast flicker on top of the envelope so it reads as electricity
      const flick = 0.55 + 0.45 * (Math.sin(now * 0.09) > 0 ? 1 : 0.4);

      if (groupRef.current) groupRef.current.style.opacity = (be * flick).toFixed(3);
      if (flashRef.current) flashRef.current.style.opacity = (fe * 0.75).toFixed(3);
      if (hitRef.current) hitRef.current.style.opacity = (be * 0.9).toFixed(3);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="thunder" aria-hidden="true">
      {/* red screen flash the strike throws across the whole scene */}
      <div className="thunder__flash" ref={flashRef} />

      <svg
        className="thunder__svg"
        viewBox={`0 0 ${vp.w} ${vp.h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="thunderGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {bolt && (
          <g key={bolt.id} ref={groupRef} style={{ opacity: 0 }} filter="url(#thunderGlow)">
            {/* heavy red build: corona → body → white-hot core */}
            <path d={bolt.d} stroke="rgba(255,40,10,0.16)" strokeWidth={bolt.width * 9} fill="none" />
            <path d={bolt.d} stroke="rgba(255,30,14,0.5)" strokeWidth={bolt.width * 3.4} fill="none" />
            <path d={bolt.d} stroke="rgba(255,120,80,0.85)" strokeWidth={bolt.width * 1.4} fill="none" />
            <path d={bolt.d} stroke="rgba(255,236,224,0.98)" strokeWidth={bolt.width * 0.5} fill="none" />
            {bolt.branches.map((d, j) => (
              <g key={j}>
                <path d={d} stroke="rgba(255,40,14,0.35)" strokeWidth={bolt.width * 1.5} fill="none" />
                <path d={d} stroke="rgba(255,150,110,0.5)" strokeWidth={bolt.width * 0.55} fill="none" />
                <path d={d} stroke="rgba(255,240,230,0.8)" strokeWidth={bolt.width * 0.24} fill="none" />
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* molten red bloom where the bolt hits the ground */}
      {bolt && (
        <div
          className="thunder__hit"
          ref={hitRef}
          style={{ left: `${bolt.hitX}px`, top: `${bolt.hitY}px` }}
        />
      )}
    </div>
  );
}
