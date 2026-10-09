import { motion } from 'framer-motion';
import { Stage, BrandLogo } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot01() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#080808]"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'circle(0% at 67% 49%)', opacity: 0.2, scale: 1.06 }}
      transition={{ duration: 0.72, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(224,52,55,.15),transparent_38%)]" />
      <div className="absolute left-[48%] top-0 h-full w-px origin-top bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
      <Stage className="grid grid-cols-[1fr_.92fr] items-center gap-[5vmin]">
        <div className="relative z-10">
          <motion.p
            className="mb-[2.2vmin] font-mono text-[1.8vmin] uppercase tracking-[.26em] text-primary"
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.4, ease: EASE }}
          >
            MORALTOWN MAIL
          </motion.p>
          <motion.h1
            className="font-display text-[7.3vmin] font-semibold leading-[.93] tracking-[-.075em] text-[#f3f0ed]"
            initial={{ opacity: 0, y: 24, skewY: 2 }}
            animate={{ opacity: 1, y: 0, skewY: 0 }}
            transition={{ delay: 0.34, duration: 0.55, ease: EASE }}
          >
            MAIL THAT
            <br />
            <span className="text-primary">BELONGS TO YOU.</span>
          </motion.h1>
          <motion.div
            className="mt-[3vmin] h-[.3vmin] origin-left bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.56, ease: EASE }}
          />
        </div>
        <motion.div
          className="relative flex items-center justify-center"
          initial={{ scale: 0.92, rotate: -2, opacity: 0.7 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.14 }}
        >
          <motion.div
            className="absolute h-[41vmin] w-[41vmin] rounded-full border border-primary/45"
            initial={{ scale: 0.78, opacity: 0.35 }}
            animate={{ scale: [0.78, 1.04, 1], opacity: [0.35, 0.8, 0.48] }}
            transition={{ duration: 2.6, times: [0, 0.42, 1], ease: EASE }}
          />
          <div className="absolute h-[32vmin] w-[32vmin] rounded-full border border-white/[.08]" />
          <BrandLogo className="relative z-10 h-[34vmin] w-[37vmin] max-w-full" />
          <motion.div
            className="absolute right-[12%] top-[49%] z-20 h-[7vmin] w-[7vmin] rounded-full border-[.45vmin] border-primary shadow-[0_0_3vmin_rgba(224,52,55,.45)]"
            animate={{ scale: [1, 1.12, 0.65], x: [0, 0, 30], opacity: [0.75, 1, 0.9] }}
            transition={{ duration: 3.25, times: [0, 0.66, 1], ease: EASE }}
          />
        </motion.div>
      </Stage>
    </motion.section>
  );
}
