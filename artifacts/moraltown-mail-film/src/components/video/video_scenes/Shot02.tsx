import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot02() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#101010]"
      initial={{ clipPath: 'circle(0% at 66% 50%)', rotateY: -8 }}
      animate={{ clipPath: 'circle(150% at 66% 50%)', rotateY: 0 }}
      exit={{ clipPath: 'polygon(0 0,100% 0,60% 100%,0 100%)', x: '-4vw', opacity: 0.35 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#080808_0%,#111_53%,#1b1010_100%)]" />
      <div className="absolute right-[-5vw] top-[18%] font-display text-[30vmin] font-bold leading-none tracking-[-.11em] text-white/[.025]">KEY</div>
      <Stage className="relative grid grid-cols-[.8fr_1.2fr] items-center gap-[7vmin]">
        <div>
          <motion.div
            className="mb-[2vmin] grid h-[6vmin] w-[6vmin] place-items-center rounded-[1.5vmin] border border-primary/25 bg-primary/[.08] text-primary"
            initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.2 }}
          >
            <LockKeyhole className="h-[3vmin] w-[3vmin]" />
          </motion.div>
          <motion.h2
            className="font-display text-[6vmin] leading-[.98] tracking-[-.065em] text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.45, ease: EASE }}
          >
            ONE KEY.
            <br />
            YOUR MAILBOX.
          </motion.h2>
          <motion.p
            className="mt-[2vmin] max-w-[42vmin] text-[2.5vmin] leading-[1.35] text-white/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.72, duration: 0.4 }}
          >
            A focused, access-key sign-in for MoralTown Mail.
          </motion.p>
        </div>
        <motion.div
          className="relative rounded-[2vmin] border border-white/10 bg-[#0b0b0b]/90 p-[3.4vmin] shadow-[0_2vmin_7vmin_rgba(0,0,0,.45)]"
          initial={{ opacity: 0, scale: 0.93, rotateY: 7 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 0.18, duration: 0.68, ease: EASE }}
        >
          <div className="absolute -left-[1.3vmin] top-[3vmin] h-[7vmin] w-[7vmin] rounded-full border-[.45vmin] border-primary bg-[#111]" />
          <p className="font-display text-[4vmin] tracking-[-.06em] text-white">Welcome back.</p>
          <p className="mt-[2.2vmin] font-mono text-[1.2vmin] uppercase tracking-[.17em] text-white/35">50-character access key</p>
          <div className="mt-[1vmin] flex items-center gap-[1.5vmin] rounded-[1.2vmin] border border-primary/35 bg-white/[.035] px-[1.6vmin] py-[1.4vmin] shadow-[0_0_3vmin_rgba(224,52,55,.09)]">
            <KeyRound className="h-[2.1vmin] w-[2.1vmin] shrink-0 text-primary" />
            <span className="font-mono text-[2.25vmin] tracking-[.28em] text-white/72">••••••••••••••••••</span>
            <span className="ml-auto h-[2.2vmin] w-[.2vmin] animate-pulse bg-primary" />
          </div>
          <motion.div
            className="mt-[1.6vmin] flex items-center justify-between rounded-[1vmin] bg-primary px-[1.7vmin] py-[1.3vmin] text-[1.6vmin] font-semibold text-white"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.36, ease: EASE }}
          >
            <span>Enter mailbox</span><ArrowRight className="h-[1.8vmin] w-[1.8vmin]" />
          </motion.div>
          <p className="mt-[1.7vmin] text-center font-mono text-[1.05vmin] uppercase tracking-[.18em] text-white/30">Key-based account access</p>
        </motion.div>
      </Stage>
    </motion.section>
  );
}
