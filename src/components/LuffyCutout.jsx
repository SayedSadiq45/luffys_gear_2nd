import { useEffect, useRef, useState } from 'react';
import { LUFFY_IMG, GEAR2_SRC, luffyLayout } from '../lib/luffyLayout';

/**
 * The pinned Gear Second cutout. Position comes from luffyLayout() rather than a
 * plain `centre it` so that Luffy — who sits off-centre inside his own PNG —
 * lands in the middle of the screen, and so Scene3D can aim the hat at his head.
 *
 * Opacity/glow are driven by the master GSAP timeline via the `data-luffy` hook.
 */
export default function LuffyCutout() {
  const wrapRef = useRef(null);
  const [box, setBox] = useState(() =>
    typeof window === 'undefined'
      ? { imgW: 0, imgH: 0, left: 0, top: 0 }
      : luffyLayout(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    const onResize = () => setBox(luffyLayout(window.innerWidth, window.innerHeight));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="luffy" ref={wrapRef} data-luffy aria-hidden="true">
      {/* depth fog / vignette pooled behind him for cinematic separation */}
      <div className="luffy__fog" data-luffy-fog />

      <div
        className="luffy__inner"
        style={{
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.imgW}px`,
          height: `${box.imgH}px`,
        }}
      >
        {/* First (calm) state — a.png. */}
        <img
          className="luffy__img"
          src={LUFFY_IMG.src}
          alt="Monkey D. Luffy"
          draggable="false"
          data-luffy-img
        />
        {/* Gear Second reveal — same figure erupting with steam. Hidden until the
            hat lands, then crossfades in under the lightning flash. */}
        <img
          className="luffy__gear2"
          src={GEAR2_SRC}
          alt="Monkey D. Luffy in Gear Second"
          draggable="false"
          data-luffy-gear2
        />
        {/* red Gear Second heat, masked to his silhouette by the same PNG alpha */}
        <img
          className="luffy__heat"
          src={GEAR2_SRC}
          alt=""
          aria-hidden="true"
          draggable="false"
          data-luffy-heat
        />
        {/* constant thunder pulse over the Gear Second figure. The wrapper opacity
            is driven by the master timeline (revealed once he transforms), while
            the inner img strobes on a fixed 1s CSS clock so lightning keeps
            cracking across his silhouette. Same PNG alpha = free silhouette mask. */}
        <div className="luffy__thunder" data-luffy-thunder>
          <img
            className="luffy__thunder-flash"
            src={GEAR2_SRC}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}
