import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStrike, toPath, mulberry32, hashStep } from '../lib/rng';
import { luffyLayout } from '../lib/luffyLayout';
import { impactT } from '../lib/timeline';
import { clamp, lerp, pulse, range, smoothstep } from '../lib/math';

/**
 * The Gear Second impact: bolts, screen flash, layered steam, crawling arcs and
 * lingering embers.
 *
 * REVERSIBILITY: the reference implementation fires its strike sequence with
 * chained setTimeout()s. That can't be rewound. Here every value is a pure
 * function of scroll progress (`ip`), with flicker coming from hashStep() on a
 * quantised progress step rather than from Math.random() or a clock. Scrubbing
 * back up the page therefore replays the burst exactly in reverse.
 *
 * The only clock-driven terms are the drift of the steam and embers, scaled by a
 * progress-driven intensity — so the aftermath breathes while it's on screen,
 * but whether it's on screen at all is entirely scroll-controlled.
 */

// Heavy strike: a dense curtain of bolts rather than a handful. These only cost
// anything while the impact is actually on screen — the whole SVG is gated to
// `visibility: hidden` outside it (see the rAF loop below).
const BOLT_COUNT = 20;
const ARC_COUNT = 18;
const SMOKE_COUNT = 46;
const EMBER_COUNT = 72;

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

/** Main bolts: sky → Luffy's head. Regenerated only when the viewport changes. */
function useBolts(w, h) {
  return useMemo(() => {
    const L = luffyLayout(w, h);
    const rand = mulberry32(0x5eed);
    return Array.from({ length: BOLT_COUNT }, (_, i) => {
      // Converge on the point of contact — where the hat actually seats — so the
      // strike and the landing are visibly the same event.
      const targetX = L.backX + (rand() - 0.5) * L.imgW * 0.16;
      const targetY = L.backY + (rand() - 0.5) * h * 0.1;
      const originX = L.backX + (rand() - 0.5) * w * 0.9;
      const strike = buildStrike(originX, -20, targetX, targetY, w * 0.13, rand);
      return {
        id: i,
        d: toPath(strike.main),
        branches: strike.branches.map(toPath),
        // The first four all land on frame zero: a single fat bolt reads thin,
        // four simultaneous ones read as a detonation.
        onset: i < 4 ? 0 : rand() * 0.24,
        width: i < 4 ? lerp(5.2, 7.4, rand()) : lerp(1.6, 3.8, rand()),
        seed: 100 + i * 37,
      };
    });
  }, [w, h]);
}

/** Short arcs crawling across Luffy's silhouette. */
function useArcs(w, h) {
  return useMemo(() => {
    const L = luffyLayout(w, h);
    const rand = mulberry32(0xc0ffee);
    return Array.from({ length: ARC_COUNT }, (_, i) => {
      const ang = rand() * Math.PI * 2;
      const r0 = L.imgH * (0.06 + rand() * 0.1);
      const r1 = L.imgH * (0.18 + rand() * 0.16);
      const cxp = L.headX + (rand() - 0.5) * L.imgW * 0.1;
      const cyp = L.top + L.imgH * (0.45 + (rand() - 0.5) * 0.3);
      const p0 = { x: cxp + Math.cos(ang) * r0, y: cyp + Math.sin(ang) * r0 * 0.9 };
      const p1 = { x: cxp + Math.cos(ang) * r1, y: cyp + Math.sin(ang) * r1 * 0.9 };
      const s = buildStrike(p0.x, p0.y, p1.x, p1.y, h * 0.035, rand);
      return { id: i, d: toPath(s.main), width: lerp(0.7, 1.6, rand()), seed: 400 + i * 53 };
    });
  }, [w, h]);
}

/**
 * Flicker for one bolt. `pulse` gives the envelope; hashStep gives a strobe that
 * looks chaotic but is identical every replay, forwards or backwards.
 */
function boltAlpha(ip, onset, seed) {
  const env = pulse(ip, onset, 0.004, 0.012, 0.075);
  if (env <= 0.001) return 0;
  const step = Math.floor(ip * 520);
  const strobe = hashStep(step, seed) > 0.34 ? 1 : 0.22;
  const restrike = 0.55 + 0.45 * hashStep(step >> 1, seed + 7);
  return env * strobe * restrike;
}

export default function LightningSmokeFX({ progressRef }) {
  const vp = useViewport();
  const bolts = useBolts(vp.w, vp.h);
  const arcs = useArcs(vp.w, vp.h);

  const boltRefs = useRef([]);
  const arcRefs = useRef([]);
  const flashRef = useRef(null);
  const shockRef = useRef(null);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);

  // Deterministic particle definitions for steam + embers.
  const particles = useMemo(() => {
    const L = luffyLayout(vp.w, vp.h);
    const rand = mulberry32(0x5d00e5);
    const smoke = Array.from({ length: SMOKE_COUNT }, () => {
      const ang = rand() * Math.PI * 2;
      return {
        ang,
        // radiate from the body, biased outward and upward
        spread: lerp(0.1, 1, rand()),
        r: lerp(0.05, 0.62, rand()),
        size: lerp(0.09, 0.3, rand()) * L.imgH,
        delay: rand() * 0.22,
        life: lerp(0.45, 1, rand()),
        hue: rand(),
        drift: (rand() - 0.5) * 2,
        rise: lerp(0.25, 0.95, rand()),
        seed: rand() * 100,
      };
    });
    const embers = Array.from({ length: EMBER_COUNT }, () => ({
      ang: rand() * Math.PI * 2,
      r: lerp(0.05, 0.5, rand()),
      size: lerp(1.2, 3.6, rand()),
      delay: rand() * 0.3,
      rise: lerp(0.4, 1.5, rand()),
      drift: (rand() - 0.5) * 3,
      seed: rand() * 100,
    }));
    return { smoke, embers, L };
  }, [vp.w, vp.h]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = vp.w * dpr;
    canvas.height = vp.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf;
    const { smoke, embers, L } = particles;
    const originX = L.headX;
    const originY = L.top + L.imgH * 0.5;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ip = impactT(progressRef.current);

      // Keep the blur-filtered bolt SVG out of the compositor until the impact
      // actually needs it — otherwise its feGaussianBlur filters cost paint on
      // every frame of the (long) hero + fall scroll for nothing. The loop below
      // still runs (setting everything to 0) so reverse-scroll stays exact.
      const svg = svgRef.current;
      if (svg) {
        const vis = ip > 0.001 ? 'visible' : 'hidden';
        if (svg.style.visibility !== vis) svg.style.visibility = vis;
      }

      // --- SVG bolts -------------------------------------------------------
      for (let i = 0; i < bolts.length; i++) {
        const el = boltRefs.current[i];
        if (!el) continue;
        el.style.opacity = boltAlpha(ip, bolts[i].onset, bolts[i].seed).toFixed(3);
      }

      // --- arcs: persistent crackle that decays over the aftermath ----------
      const arcBase = smoothstep(0.02, 0.09, ip) * (1 - smoothstep(0.35, 1, ip) * 0.72);
      for (let i = 0; i < arcs.length; i++) {
        const el = arcRefs.current[i];
        if (!el) continue;
        const step = Math.floor(ip * 300);
        const on = hashStep(step + i * 11, arcs[i].seed) > 0.55 ? 1 : 0.08;
        el.style.opacity = (arcBase * on).toFixed(3);
      }

      // --- screen flash ----------------------------------------------------
      // A strong, sustained white-out that peaks with the strike and holds long
      // enough to hide the a.png -> Gear Second crossfade, then flickers out.
      if (flashRef.current) {
        const f =
          // near-instant attack, long sustain: a genuine white-out
          pulse(ip, 0, 0.004, 0.34, 0.16) * 1.9 +
          pulse(ip, 0.05, 0.003, 0.012, 0.06) * 0.85 +
          pulse(ip, 0.13, 0.003, 0.012, 0.06) * 0.7 +
          pulse(ip, 0.24, 0.004, 0.014, 0.07) * 0.45;
        flashRef.current.style.opacity = clamp(f).toFixed(3);
      }

      // --- shockwave: one hard ring blown out of the point of contact -------
      if (shockRef.current) {
        const s = range(ip, 0, 0.32);
        if (s <= 0) {
          shockRef.current.style.opacity = '0';
        } else {
          const e = 1 - Math.pow(1 - s, 3); // ease-out: fast out, then coast
          shockRef.current.style.transform = `translate(-50%,-50%) scale(${(0.05 + e * 3.1).toFixed(3)})`;
          shockRef.current.style.opacity = ((1 - s) * (1 - s) * 0.85).toFixed(3);
        }
      }

      // --- steam + embers --------------------------------------------------
      ctx.clearRect(0, 0, vp.w, vp.h);
      if (ip <= 0.0005) return;

      const now = performance.now() * 0.001;
      ctx.globalCompositeOperation = 'lighter';

      for (const s of smoke) {
        // progress-driven expansion...
        const t = range(ip, s.delay, s.delay + s.life);
        if (t <= 0) continue;
        // ...with a clock-driven curl so the aftermath keeps breathing.
        const curl = Math.sin(now * 0.5 + s.seed) * 0.04;
        const rr = (s.r + t * 0.55 * s.spread + curl) * L.imgH;
        const x = originX + Math.cos(s.ang) * rr * 1.5 + s.drift * t * 60;
        const y = originY + Math.sin(s.ang) * rr * 0.8 - t * s.rise * L.imgH * 0.5;
        const size = s.size * (0.5 + t * 1.5);

        // fade in fast, then linger rather than cutting off
        const a = Math.min(t * 4, 1) * (1 - smoothstep(0.55, 1, t)) * 0.5;
        if (a <= 0.002) continue;

        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        const warm = s.hue > 0.45;
        const col = warm ? '255,90,36' : '255,170,90';
        g.addColorStop(0, `rgba(${col},${(a * 0.5).toFixed(3)})`);
        g.addColorStop(0.4, `rgba(${col},${(a * 0.16).toFixed(3)})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const e of embers) {
        const t = range(ip, e.delay, 1);
        if (t <= 0) continue;
        const rr = (e.r + t * 0.4) * L.imgH;
        const x =
          originX + Math.cos(e.ang) * rr * 1.4 + e.drift * t * 90 + Math.sin(now + e.seed) * 6;
        const y = originY + Math.sin(e.ang) * rr * 0.7 - t * e.rise * L.imgH * 0.7;
        const tw = 0.55 + 0.45 * Math.sin(now * 6 + e.seed * 3);
        const a = Math.min(t * 6, 1) * (1 - smoothstep(0.6, 1, t)) * tw;
        if (a <= 0.01) continue;
        ctx.fillStyle = `rgba(255,${Math.floor(lerp(120, 220, tw))},70,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, e.size * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [vp.w, vp.h, bolts, arcs, particles, progressRef]);

  return (
    <div className="fx" aria-hidden="true">
      <canvas className="fx__canvas" ref={canvasRef} />

      <svg ref={svgRef} className="fx__svg" viewBox={`0 0 ${vp.w} ${vp.h}`} preserveAspectRatio="none">
        <defs>
          <filter id="boltGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {bolts.map((b, i) => (
          <g
            key={b.id}
            ref={(el) => (boltRefs.current[i] = el)}
            style={{ opacity: 0 }}
            filter="url(#boltGlow)"
          >
            {/* 4-layer build: corona → haze → sheath → white core */}
            <path d={b.d} stroke="rgba(255,120,40,0.10)" strokeWidth={b.width * 9} fill="none" />
            <path d={b.d} stroke="rgba(255,80,30,0.22)" strokeWidth={b.width * 3.6} fill="none" />
            <path d={b.d} stroke="rgba(255,200,150,0.6)" strokeWidth={b.width * 1.5} fill="none" />
            <path d={b.d} stroke="rgba(255,255,255,0.98)" strokeWidth={b.width * 0.55} fill="none" />
            {b.branches.map((d, j) => (
              <g key={j}>
                <path d={d} stroke="rgba(255,90,30,0.18)" strokeWidth={b.width * 1.5} fill="none" />
                <path d={d} stroke="rgba(255,210,170,0.4)" strokeWidth={b.width * 0.6} fill="none" />
                <path d={d} stroke="rgba(255,255,255,0.7)" strokeWidth={b.width * 0.26} fill="none" />
              </g>
            ))}
          </g>
        ))}

        {arcs.map((a, i) => (
          <g key={a.id} ref={(el) => (arcRefs.current[i] = el)} style={{ opacity: 0 }}>
            <path d={a.d} stroke="rgba(255,120,50,0.5)" strokeWidth={a.width * 3} fill="none" />
            <path d={a.d} stroke="rgba(255,235,210,0.95)" strokeWidth={a.width} fill="none" />
          </g>
        ))}
      </svg>

      {/* Shockwave ring, centred on the exact spot the hat makes contact. */}
      <div
        className="fx__shock"
        ref={shockRef}
        style={{
          left: `${particles.L.backX}px`,
          top: `${particles.L.backY}px`,
          width: `${particles.L.imgH * 0.5}px`,
          height: `${particles.L.imgH * 0.5}px`,
        }}
      />

      <div className="fx__flash" ref={flashRef} />
    </div>
  );
}
