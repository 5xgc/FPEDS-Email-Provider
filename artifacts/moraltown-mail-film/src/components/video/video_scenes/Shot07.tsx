import { motion } from 'framer-motion';
import { Download, MonitorDown } from 'lucide-react';
import { BrandLogo, Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot07() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#e9e5e0]"
      initial={{ clipPath: 'circle(0% at 50% 50%)', scale: 0.95 }}
      animate={{ clipPath: 'circle(145% at 50% 50%)', scale: 1 }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', scale: 1.08, opacity: 0.4 }}
      transition={{ duration: 0.74, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,#fff_0%,#e9e5e0_58%,#d9d4cf_100%)]" />
      <Stage className="relative grid grid-cols-[1.05fr_.95fr] items-center gap-[4vmin]">
        <div className="relative z-10">
          <motion.div
            className="mb-[1.6vmin] inline-flex items-center gap-[.8vmin] rounded-full border border-black/10 bg-white/65 px-[1.2vmin] py-[.75vmin] font-mono text-[1.15vmin] uppercase tracking-[.15em] text-black/55"
            initial={{ opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <MonitorDown className="h-[1.6vmin] w-[1.6vmin] text-primary" /> Windows desktop app
          </motion.div>
          <motion.h2
            className="font-display text-[6.5vmin] font-semibold leading-[.92] tracking-[-.07em] text-[#111]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: EASE }}
          >
            MoralTown Mail.
            <br />
            <span className="text-primary">At your desk.</span>
          </motion.h2>
          <motion.p
            className="mt-[1.6vmin] max-w-[39vmin] text-[2.15vmin] leading-[1.35] text-black/56"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            Your mailbox, now with a Windows desktop setup.
          </motion.p>
          <motion.div
            className="mt-[2.2vmin] inline-flex items-center gap-[.9vmin] rounded-[1vmin] bg-primary px-[1.5vmin] py-[1.05vmin] text-[1.5vmin] font-semibold text-white shadow-[0_1vmin_3vmin_rgba(180,36,39,.18)]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.05, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <Download className="h-[1.7vmin] w-[1.7vmin]" /> MoralTown Mail Setup · 134 MB
          </motion.div>
          <motion.div
            className="mt-[2.5vmin] h-px w-[30vmin] origin-left bg-black/20"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.4, duration: 0.55, ease: EASE }}
          />
          <motion.p
            className="mt-[1.6vmin] font-mono text-[1.35vmin] uppercase tracking-[.16em] text-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7, duration: 0.35 }}
          >
            Built and owned by MoralTown
          </motion.p>
        </div>
        <motion.div
          className="relative flex h-[50vmin] items-center justify-center"
          initial={{ scale: 0.9, rotate: 3, opacity: 0.65 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="absolute h-[39vmin] w-[39vmin] rounded-full border border-primary/25"
            animate={{ scale: [0.92, 1.06, 0.98], rotate: [0, 38, 70] }}
            transition={{ delay: 0.2, duration: 4.2, ease: EASE }}
          />
          <motion.div
            className="absolute right-[4%] top-[13%] h-[31vmin] w-[40vmin] max-w-[90%] rounded-[1.2vmin] border border-black/15 bg-[#101010] p-[1vmin] shadow-[0_2.7vmin_8vmin_rgba(0,0,0,.22)]"
            initial={{ opacity: 0, x: 15, rotateY: 12 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ delay: 0.55, duration: 0.7, ease: EASE }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[.6vmin] border border-white/[.07]">
              <div className="flex items-center justify-between border-b border-white/[.08] px-[1.4vmin] py-[1vmin]">
                <span className="font-display text-[1.3vmin] text-white/80">MoralTown Mail</span>
                <span className="flex gap-[.4vmin]"><i className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" /><i className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" /><i className="h-[.55vmin] w-[.55vmin] rounded-full bg-white/20" /></span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <div className="w-[68%] rounded-[.8vmin] border border-primary/20 bg-primary/[.06] p-[1.3vmin]">
                  <p className="font-mono text-[1vmin] uppercase tracking-[.15em] text-primary">Inbox</p>
                  <p className="mt-[.8vmin] text-[1.65vmin] font-medium text-white/85">Welcome to MoralTown</p>
                  <p className="mt-[.5vmin] text-[1.15vmin] text-white/40">Your mailbox is ready.</p>
                </div>
              </div>
            </div>
          </motion.div>
          <BrandLogo className="relative z-10 mt-[13vmin] h-[27vmin] w-[29vmin] rounded-[1vmin] border border-white/10 shadow-[0_1.7vmin_4vmin_rgba(0,0,0,.2)]" />
        </motion.div>
      </Stage>
      <motion.div
        className="absolute bottom-[2.5vmin] right-[6vmin] font-mono text-[1vmin] uppercase tracking-[.16em] text-black/35"
        animate={{ opacity: [0.35, 0.58, 0.32], scale: [1, 1.015, 1] }}
        transition={{ delay: 2, duration: 2.8, ease: 'easeInOut' }}
      >
        MoralTown Mail · Web and Windows
      </motion.div>
    </motion.section>
  );
}
