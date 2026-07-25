import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Scene3D from './Scene3D';
import FallingKanji from './FallingKanji';
import LightningSmokeFX from './LightningSmokeFX';
import AmbientThunder from './AmbientThunder';
import LuffyCutout from './LuffyCutout';

import Particles from '../reactbits/Particles/Particles';
import ShinyText from '../reactbits/ShinyText/ShinyText';
import BlurText from '../reactbits/BlurText/BlurText';
import SplashCursor from '../reactbits/SplashCursor/SplashCursor';

import { SCROLL_VH, LAND, IMPACT_START, HERO_END, LUFFY_IN_START, LUFFY_IN_END } from '../lib/timeline';

gsap.registerPlugin(ScrollTrigger);

/**
 * Top-level orchestrator.
 *
 * One ScrollTrigger, one scrubbed master timeline, one progress value:
 *  - DOM layers are tweened declaratively on the timeline.
 *  - Scene3D and LightningSmokeFX read `progressRef` each frame instead, because
 *    they render to canvas/WebGL. Both sources are the same number, so the 3D
 *    hat, the kanji and the FX can never desync — forwards or backwards.
 *
 * No scroll-jacking: native scroll drives everything via scrub.
 */
export default function ScrollExperience() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const progressRef = useRef(0);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const kanji = gsap.utils.toArray('[data-kanji]');

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          // Pin right to the bottom of the scene with no trailing spacer, so the
          // pinned stage (and Luffy) stays on screen through the very last scroll
          // pixel instead of scrolling away into empty space at the end.
          end: 'bottom bottom',
          pinSpacing: false,
          scrub: 0.5, // tight catch-up — smoothed but stays glued to the scrollbar
          pin: stageRef.current,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // single source of truth for the imperative (canvas/WebGL) layers
            progressRef.current = self.progress;
          },
        },
      });

      // ---- hero copy clears out as the fall begins --------------------------
      tl.to('[data-hero]', { opacity: 0, y: -60, filter: 'blur(12px)' }, 0)
        .to('[data-cue]', { opacity: 0, duration: 0.4 }, 0);

      // ---- backdrop: bg.jpg slowly pushes in through the whole descent ------
      // A very slow scale gives the sky parallax against the falling hat.
      tl.fromTo(
        '[data-bg-base]',
        { scale: 1.14, yPercent: -2 },
        { scale: 1.02, yPercent: 2, duration: LAND },
        0
      );

      // ---- backdrop swap: bg.jpg → transition.jpg ON CONTACT ----------------
      // The Gear Second plate blooms in from an overscale so the swap reads as a
      // rush toward the viewer, not a plain dissolve. It runs slightly wider than
      // the flash so the new backdrop is already there when the white-out clears.
      tl.to('[data-bg-base]', { opacity: 0, duration: 0.03 }, IMPACT_START);
      tl.fromTo(
        '[data-bg-shift]',
        { opacity: 0, scale: 1.28 },
        // Stops short of full: the Gear Second plate has to read as a backdrop
        // behind Luffy, not compete with him.
        { opacity: 0.58, scale: 1.04, duration: 0.05, ease: 'power2.out' },
        IMPACT_START
      );
      // then keep drifting in, very slowly, through the aftermath
      tl.to(
        '[data-bg-shift]',
        { scale: 1, duration: 1 - IMPACT_START - 0.05 },
        IMPACT_START + 0.05
      );

      // ---- kanji: each glyph falls its own distance (parallax by depth) -----
      kanji.forEach((el) => {
        const start = parseFloat(el.dataset.start) || 0;
        const travel = parseFloat(el.dataset.travel) || 100;
        const drift = parseFloat(el.dataset.drift) || 0;
        const depth = parseFloat(el.dataset.depth) || 0.5;

        // Stagger the window each glyph occupies, inside the fall phase.
        const from = HERO_END * 0.5 + start * 0.3;
        const dur = LAND - from;

        gsap.set(el, { yPercent: -140, opacity: 0 });

        tl.fromTo(
          el,
          { yPercent: -140, xPercent: 0 },
          { yPercent: travel * 1.6, xPercent: drift, ease: 'none', duration: dur },
          from
        );
        // fade in, hold, fade out — scaled by the glyph's depth opacity
        tl.fromTo(
          el,
          { opacity: 0 },
          { opacity: 1, duration: dur * 0.18 },
          from
        ).to(el, { opacity: 0, duration: dur * 0.25 }, from + dur * 0.75);
      });

      // ---- Luffy rises out of the fog before the hat arrives ---------------
      // Opacity + scale only (no animated blur filter) so the entry stays smooth.
      tl.fromTo(
        '[data-luffy-img]',
        { opacity: 0, scale: 1.06 },
        { opacity: 1, scale: 1, duration: LUFFY_IN_END - LUFFY_IN_START },
        LUFFY_IN_START
      );
      tl.fromTo(
        '[data-luffy-fog]',
        { opacity: 0 },
        { opacity: 1, duration: LUFFY_IN_END - LUFFY_IN_START },
        LUFFY_IN_START
      );

      // ---- transformation: calm Luffy dissolves into Gear Second ------------
      // Fires at IMPACT_START (a hair before the hat seats) so it sits fully
      // inside the white-out of the flash.
      const XFADE = 0.022;
      tl.to('[data-luffy-img]', { opacity: 0, duration: XFADE }, IMPACT_START);
      tl.fromTo(
        '[data-luffy-gear2]',
        { opacity: 0 },
        { opacity: 1, duration: XFADE },
        IMPACT_START
      );
      // reveal the constant 1s thunder strobe once he's in Gear Second
      tl.fromTo(
        '[data-luffy-thunder]',
        { opacity: 0 },
        { opacity: 1, duration: XFADE },
        IMPACT_START
      );

      // ---- Gear Second heat blooms out of his silhouette on impact ---------
      tl.fromTo(
        '[data-luffy-heat]',
        { opacity: 0 },
        { opacity: 0.9, duration: 0.012 },
        IMPACT_START
      ).to(
        '[data-luffy-heat]',
        { opacity: 0.32, duration: 1 - IMPACT_START - 0.012 },
        IMPACT_START + 0.012
      );

      // ---- camera shake ----------------------------------------------------
      // Built as real keyframes on the scrubbed timeline (not a rAF burst) so it
      // rewinds cleanly when you scroll back up.
      // A heavy hit: a hard initial kick, then 22 damped oscillations. The first
      // frame is the biggest displacement — that's what sells weight.
      const shake = gsap.timeline();
      const AMP = 58;
      const STEPS = 22;
      shake.to(stageRef.current, { x: -AMP * 0.5, y: AMP * 0.62, rotation: -1.6, duration: 0.5 / STEPS });
      for (let i = 0; i < STEPS; i++) {
        const damp = Math.pow(1 - i / STEPS, 1.6);
        shake.to(stageRef.current, {
          x: (Math.random() - 0.5) * AMP * damp,
          y: (Math.random() - 0.5) * AMP * damp,
          rotation: (Math.random() - 0.5) * 2.4 * damp,
          duration: 0.5 / STEPS,
        });
      }
      shake.to(stageRef.current, { x: 0, y: 0, rotation: 0, duration: 0.05 });
      tl.add(shake, IMPACT_START);

      // ---- 「二段」 impact stamp: slams on, holds, then burns off -----------
      tl.fromTo(
        '[data-stamp]',
        { opacity: 0, scale: 2.6, letterSpacing: '0.6em' },
        { opacity: 1, scale: 1, letterSpacing: '0.14em', duration: 0.022, ease: 'power4.out' },
        IMPACT_START
      ).to('[data-stamp]', { opacity: 0, scale: 1.14, duration: 0.05 }, IMPACT_START + 0.035);

      // ---- aftermath: settle into a moody glow -----------------------------
      tl.fromTo(
        '[data-aftermath]',
        { opacity: 0 },
        { opacity: 1, duration: 0.06 },
        IMPACT_START + 0.04
      );
      tl.fromTo(
        '[data-vignette]',
        { opacity: 0.35 },
        { opacity: 0.85, duration: 1 - IMPACT_START },
        IMPACT_START
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Recalculate pinning once fonts/images have settled.
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 350);
    window.addEventListener('load', ScrollTrigger.refresh);
    return () => {
      clearTimeout(id);
      window.removeEventListener('load', ScrollTrigger.refresh);
    };
  }, []);

  return (
    <>
      {/* red fluid splash cursor — fixed above everything, follows the pointer.
          Kept outside the pinned/shaking .stage so it tracks the real cursor. */}
      <SplashCursor
        RAINBOW_MODE={false}
        COLOR="#ff2412"
        BACK_COLOR={{ r: 0.35, g: 0, b: 0 }}
        SPLAT_RADIUS={0.28}
        SPLAT_FORCE={7200}
        CURL={3.5}
        DENSITY_DISSIPATION={3}
      />

      <div className="exp" ref={rootRef} style={{ height: `${SCROLL_VH}vh` }}>
        <div className="stage" ref={stageRef}>
        {/* deepest layer: the painted backdrop. bg.jpg sits heavily faded behind
            everything, then swaps to the Gear Second plate on contact. */}
        <div className="layer layer--bg">
          <div className="bgplate bgplate--base" data-bg-base />
          <div className="bgplate bgplate--shift" data-bg-shift />
          <div className="bgplate__scrim" />
        </div>

        {/* far depth: React Bits starfield */}
        <div className="layer layer--stars">
          <Particles
            particleCount={220}
            particleColors={['#ffd9c0', '#ff7a45', '#ffffff', '#8fb6ff']}
            particleSpread={16}
            speed={0.06}
            particleBaseSize={70}
            sizeRandomness={1.2}
            alphaParticles
            cameraDistance={22}
          />
        </div>

        {/* drifting clouds / nebula */}
        <div className="layer layer--clouds">
          <span className="cloud cloud--1" />
          <span className="cloud cloud--2" />
          <span className="cloud cloud--3" />
        </div>

        {/* mid depth: kanji trail */}
        <div className="layer layer--kanji">
          <FallingKanji />
        </div>

        {/* mid depth: the 3D hat */}
        <div className="layer layer--hat">
          <Scene3D progressRef={progressRef} />
        </div>
           <div className="layer layer--fx">
          <LightningSmokeFX progressRef={progressRef} />
        </div>

        {/* foreground: Luffy */}
        <div className="layer layer--luffy">
          <LuffyCutout />
        </div>

        {/* impact FX sit above Luffy */}
     

        {/* aftermath glow */}
        <div className="aftermath" data-aftermath />
        <div className="vignette" data-vignette />

        {/* ambient thunder: real red lightning bolts strike across the whole
            scene at random intervals, independent of scroll. */}
        <AmbientThunder />

        {/* 「二段」 slams across the screen the instant the hat connects */}
        <div className="stamp" data-stamp aria-hidden="true">
          <span className="stamp__jp">二段</span>
          <span className="stamp__en">GEAR SECOND</span>
        </div>

        {/* vertical tategaki rails — set in the margins like a manga page */}
        <div className="rail rail--left" aria-hidden="true">
          <span className="rail__jp">海賊王に俺はなる</span>
          <span className="rail__dot" />
          <span className="rail__jp rail__jp--dim">ゴムゴムの実</span>
        </div>
        <div className="rail rail--right" aria-hidden="true">
          <span className="rail__jp rail__jp--dim">麦わらの一味</span>
          <span className="rail__dot" />
          <span className="rail__jp">ギアセカンド発動</span>
        </div>

        {/* ---- UI (Framer Motion micro-interactions) ---- */}
        <div className="hero" data-hero>
          <motion.span
            className="hero__kanji"
            initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            ギアセカンド
          </motion.span>

          <BlurText
            text="GEAR SECOND"
            delay={90}
            animateBy="letters"
            direction="top"
            className="hero__title"
            stepDuration={0.4}
          />

          <motion.p
            className="hero__sub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            MONKEY D. LUFFY — 麦わらの一味
          </motion.p>

          <motion.p
            className="hero__jp"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.3 }}
          >
            <span>鼓動</span>
            <i />
            <span>蒸気</span>
            <i />
            <span>解放</span>
          </motion.p>
        </div>

        <motion.div
          className="cue"
          data-cue
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          <span className="cue__jp">下へスクロール</span>
          <ShinyText
            text="SCROLL TO BEGIN"
            speed={2.6}
            color="#7d6a63"
            shineColor="#ff8a4c"
            className="cue__text"
          />
          <motion.span
            className="cue__arrow"
            animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            ↓
          </motion.span>
        </motion.div>

        {/* HUD */}
        <div className="hud hud--top">
          <span>
            GEAR: <b>SECOND</b> <em className="hud__jp">／ 二段</em>
          </span>
          <span className="hud__jp hud__jp--big">覇気解放</span>
        </div>
        <div className="hud hud--bottom">
          <span data-readout>
            STATE: DESCENDING <em className="hud__jp">／ 降下中</em>
          </span>
          <span>
            HAT: <b>麦わら帽子</b> <em className="hud__jp">／ 生命の帽子</em>
          </span>
        </div>

        <div className="grain" />
      </div>
      </div>
    </>
  );
}
