import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "opening" | "open" | "closing";

const TIMING = {
  morph: 0.72,
  settle: 0.36,
  close: 0.58,
  contentDelay: 0.22,
  stageDelay: 0.1,
  stagger: 0.05,
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;

const slides = [
  {
    label: "Suzanna",
    sub: "Finding light in fragmented times",
    image:
      "radial-gradient(110% 90% at 70% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), linear-gradient(140deg, #8c3a2f 0%, #4f1f27 42%, #1a1018 100%)",
  },
  {
    label: "Introduction",
    sub: "2024's background in sports",
    image:
      "radial-gradient(80% 80% at 62% 44%, rgba(255,255,255,0.18), rgba(255,255,255,0) 52%), linear-gradient(135deg, #2f3d51 0%, #2a1825 45%, #151015 100%)",
  },
  {
    label: "Complex",
    sub: "We need to start somewhere right?",
    image:
      "radial-gradient(120% 100% at 32% 22%, rgba(255,210,170,0.15), rgba(255,255,255,0) 48%), linear-gradient(135deg, #6d4022 0%, #3d291d 35%, #171114 100%)",
  },
];

const bodyLeft = [
  "The desert, in its silent grandeur, unfolds like a golden sea beneath the waning sun. Waves of sand roll endlessly toward the horizon, sculpted by the invisible hands of the wind.",
  "The air is dry, crisp, and faintly perfumed with sage and creosote. Heat lingers near the ground, but the sky has begun to cool, blushing pink and lavender as the sun dips lower.",
  "As night descends, the sky ignites with stars, sharp and countless. There's no haze here, no city glow just an ocean of constellations stretching above an earth that feels untouched.",
  "The desert doesn't shout. It doesn't clamor for attention. But if you listen really listen it tells stories written in sand, sun, and stars.",
];

const bodyRight = [
  "The desert, in its silent grandeur, unfolds like a golden sea beneath the waning sun. Waves of sand roll endlessly toward the horizon, sculpted by the invisible hands of the wind.",
  "The air is dry, crisp, and faintly perfumed with sage and creosote. Heat lingers near the ground, but the sky has begun to cool, blushing pink and lavender as the sun dips lower.",
  "A lone jackrabbit darts from behind a mesquite bush, its long ears alert to every movement. In the distance, a caravan of camels silhouettes itself against the fading light ghostly and graceful.",
  "At night, the desert is breathing.",
];

export default function AnimatedTransitionShell() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [contentVisible, setContentVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const closeTimerRef = useRef<number | null>(null);

  const isOpen = phase === "opening" || phase === "open" || phase === "closing";

  useEffect(() => {
    if (phase !== "idle") return;
    const id = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 780);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "opening") return;
    const revealId = window.setTimeout(() => setContentVisible(true), TIMING.contentDelay * 1000);
    const settleId = window.setTimeout(() => setPhase("open"), (TIMING.morph + TIMING.stageDelay) * 1000);
    return () => {
      window.clearTimeout(revealId);
      window.clearTimeout(settleId);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const currentSlide = useMemo(() => slides[slideIndex], [slideIndex]);

  function handleOpen() {
    setPhase("opening");
    setContentVisible(false);
  }

  function handleClose() {
    setContentVisible(false);
    setPhase("closing");
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      closeTimerRef.current = null;
    }, (TIMING.close + 0.1) * 1000);
  }

  return (
    <div className="doctrine-root">
      <div className="doctrine-grid-overlay" aria-hidden="true" />
      <div className="doctrine-arc-overlay" aria-hidden="true" />

      <div className="doctrine-top-left">
        <span className="font-semibold text-zinc-200">Studio S</span>
        <span>about</span>
        <span>studio</span>
      </div>

      <div className="doctrine-top-center">Nepta</div>

      <div className="doctrine-top-right">Welcome to my side of the internet, hope you all enjoy my weird explorations</div>

      <div className="doctrine-bottom-left">
        <span className="year">2025</span>
        <span className="date">11th June</span>
        <span className="project">Unravel</span>
      </div>

      <div className="doctrine-bottom-right">Ali Zafar Iqbal</div>

      <main className="doctrine-stage">
        <div className="doctrine-frame">
          <motion.div
            className="doctrine-blob"
            animate={{
              opacity: phase === "idle" ? 0.4 : 0.62,
              scale: phase === "opening" ? 1.1 : 1,
            }}
            transition={{ duration: 0.5, ease: EASE }}
          />

          <LayoutGroup>
            {!isOpen && (
              <motion.button
                layoutId="doctrine-card"
                type="button"
                onClick={handleOpen}
                className="doctrine-tile"
                transition={{ duration: TIMING.morph, ease: EASE }}
              >
                <motion.div layoutId="doctrine-image" className="doctrine-tile-media" style={{ backgroundImage: currentSlide.image }}>
                  <div className="doctrine-tile-lens" />
                </motion.div>
                <div className="doctrine-tile-copy">
                  <p>{currentSlide.label}</p>
                  <p>{currentSlide.sub}</p>
                </div>
                <span className="doctrine-cross" aria-hidden="true">+</span>
                <div className="doctrine-tile-shadow" />
              </motion.button>
            )}

            <AnimatePresence mode="wait">
              {isOpen && (
                <motion.div
                  key="expanded"
                  className="doctrine-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <motion.article
                    layoutId="doctrine-card"
                    className="doctrine-expanded"
                    transition={{
                      duration: phase === "closing" ? TIMING.close : TIMING.morph,
                      ease: EASE,
                    }}
                  >
                    <button type="button" onClick={handleClose} className="doctrine-close" aria-label="Close expanded card">
                      x
                    </button>

                    <div className="doctrine-expanded-inner">
                      <motion.div
                        layoutId="doctrine-image"
                        className="doctrine-left-media"
                        style={{ backgroundImage: currentSlide.image }}
                        initial={false}
                        animate={{
                          left: phase === "closing" ? "50%" : "5.5%",
                          top: phase === "closing" ? "50%" : "13%",
                          width: phase === "closing" ? "320px" : "46.5%",
                          height: phase === "closing" ? "320px" : "74%",
                          x: phase === "closing" ? "-50%" : "0%",
                          y: phase === "closing" ? "-50%" : "0%",
                          borderRadius: phase === "closing" ? "92px" : "72px",
                        }}
                        transition={{ duration: phase === "closing" ? TIMING.close : TIMING.morph, ease: EASE }}
                      >
                        <div className="doctrine-left-lens" />
                        <motion.h1
                          className="doctrine-intro-title"
                          initial={false}
                          animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 14 }}
                          transition={{ duration: TIMING.settle, ease: EASE, delay: 0.12 }}
                        >
                          Introduction
                        </motion.h1>
                      </motion.div>

                      <motion.section
                        className="doctrine-editorial"
                        initial={false}
                        animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 18 }}
                        transition={{ duration: TIMING.settle, ease: EASE, delay: 0.18 }}
                      >
                        <motion.div
                          className="doctrine-editorial-meta"
                          initial={false}
                          animate={{ opacity: contentVisible ? 1 : 0 }}
                          transition={{ duration: 0.28, delay: 0.24 }}
                        >
                          <span>February</span>
                          <span>Film</span>
                          <span>Text</span>
                          <span>Audrey Artison</span>
                        </motion.div>

                        <div className="doctrine-columns">
                          <motion.div
                            initial="hidden"
                            animate={contentVisible ? "show" : "hidden"}
                            variants={{
                              hidden: {},
                              show: { transition: { staggerChildren: TIMING.stagger } },
                            }}
                          >
                            {bodyLeft.map((paragraph, idx) => (
                              <motion.p
                                key={`left-${idx}`}
                                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                                transition={{ duration: 0.3, ease: EASE }}
                              >
                                {paragraph}
                              </motion.p>
                            ))}
                            <motion.p
                              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                              transition={{ duration: 0.3, ease: EASE }}
                              className="doctrine-quote"
                            >
                              "The Sahara is no joke"
                            </motion.p>
                            <p className="doctrine-quote-author">Ryan carmen</p>
                          </motion.div>

                          <motion.div
                            initial="hidden"
                            animate={contentVisible ? "show" : "hidden"}
                            variants={{ hidden: {}, show: { transition: { staggerChildren: TIMING.stagger, delayChildren: 0.08 } } }}
                          >
                            {bodyRight.map((paragraph, idx) => (
                              <motion.p
                                key={`right-${idx}`}
                                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                                transition={{ duration: 0.3, ease: EASE }}
                              >
                                {paragraph}
                              </motion.p>
                            ))}
                          </motion.div>
                        </div>
                      </motion.section>

                      <motion.aside
                        className="doctrine-right-media"
                        initial={false}
                        animate={{ opacity: contentVisible ? 1 : 0, x: contentVisible ? 0 : 26 }}
                        transition={{ duration: TIMING.settle, ease: EASE, delay: 0.24 }}
                      >
                        <div className="doctrine-right-media-top" style={{ backgroundImage: currentSlide.image }} />
                        <div className="doctrine-right-media-bottom" style={{ backgroundImage: currentSlide.image }} />
                      </motion.aside>
                    </div>
                  </motion.article>
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>

          <p className="doctrine-caption">Uncover the Viking innovations in waste management! Learn how these ancient seafarers combined keep their communities clean.</p>
        </div>
      </main>
    </div>
  );
}
