import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderInput, Star, X } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { FilmTag, Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot04() {
  const [moved, setMoved] = useState(false);
  useSceneTimer([{ time: 2200, callback: () => setMoved(true) }]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#0c0c0c]"
      initial={{ clipPath: 'circle(0% at 59% 48%)', scale: 0.96 }}
      animate={{ clipPath: 'circle(145% at 59% 48%)', scale: 1 }}
      exit={{ clipPath: 'inset(0 0 0 100%)', rotateY: 10, opacity: 0.2 }}
      transition={{ duration: 0.65, ease: EASE }}
    >
      <div className="absolute inset-y-0 left-0 w-[31%] bg-[linear-gradient(90deg,rgba(224,52,55,.08),transparent)]" />
      <Stage className="grid grid-cols-[.82fr_1.18fr] items-center gap-[5vmin]">
        <div>
          <motion.p
            className="font-mono text-[1.35vmin] uppercase tracking-[.2em] text-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.3 }}
          >
            Read. Organize. Move on.
          </motion.p>
          <motion.h2
            className="mt-[1.5vmin] font-display text-[5.8vmin] leading-[.95] tracking-[-.065em] text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5, ease: EASE }}
          >
            Your email.
            <br />
            Where it belongs.
          </motion.h2>
          <motion.div
            className="mt-[2.2vmin] flex items-center gap-[1vmin] text-[1.75vmin] text-white/46"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.35 }}
          >
            <span className="grid h-[3.7vmin] w-[3.7vmin] place-items-center rounded-full bg-primary/15 text-[1.35vmin] font-semibold text-primary">R</span>
            Rowan · today
          </motion.div>
        </div>

        <motion.article
          className="relative overflow-hidden rounded-[1.8vmin] border border-white/10 bg-[#111]/95 shadow-[0_2vmin_7vmin_rgba(0,0,0,.55)]"
          initial={{ opacity: 0, x: 36, rotateY: -5 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-black/35 px-[1.7vmin] py-[1.2vmin]">
            <div className="flex items-center gap-[.8vmin] text-[1.35vmin] text-white/45">
              <ArrowLeft className="h-[1.7vmin] w-[1.7vmin]" /> All messages
            </div>
            <div className="flex gap-[.75vmin]">
              <motion.span
                className="grid h-[3.5vmin] w-[3.5vmin] place-items-center rounded-[.8vmin] border border-white/10 text-primary"
                animate={{ borderColor: ['rgba(255,255,255,.1)', 'rgba(224,52,55,.65)', 'rgba(255,255,255,.1)'] }}
                transition={{ delay: 1.15, duration: 1.1, ease: EASE }}
              >
                <Star className="h-[1.7vmin] w-[1.7vmin]" />
              </motion.span>
              <motion.span
                className={`grid h-[3.5vmin] w-[3.5vmin] place-items-center rounded-[.8vmin] border ${moved ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-white/55'}`}
                animate={moved ? { scale: [1, 1.12, 1], backgroundColor: ['rgba(224,52,55,0)', 'rgba(224,52,55,.18)', 'rgba(224,52,55,.1)'] } : { scale: 1 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <FolderInput className="h-[1.7vmin] w-[1.7vmin]" />
              </motion.span>
              <span className="grid h-[3.5vmin] w-[3.5vmin] place-items-center rounded-[.8vmin] border border-white/10 text-white/45"><X className="h-[1.7vmin] w-[1.7vmin]" /></span>
            </div>
          </div>
          <div className="px-[2.4vmin] pb-[2.4vmin] pt-[2vmin]">
            <div className="mb-[1vmin] flex items-center gap-[.8vmin]">
              <FilmTag className="transition-colors">{moved ? 'Projects' : 'Inbox'}</FilmTag>
              <span className="font-mono text-[1.1vmin] uppercase tracking-[.14em] text-white/30">Personal</span>
            </div>
            <h3 className="font-display text-[3.5vmin] leading-[1.05] tracking-[-.05em] text-white">A note for today</h3>
            <p className="mt-[1.3vmin] font-mono text-[1.25vmin] text-white/45">from Rowan · to kai@fpdf.2bd.net · 9:42 AM</p>
            <motion.div
              className="mt-[1.9vmin] space-y-[.8vmin] border-t border-white/[.09] pt-[1.7vmin]"
              initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
              transition={{ delay: 0.65, duration: 0.55, ease: EASE }}
            >
              <p className="text-[1.85vmin] leading-[1.5] text-white/72">The quiet work is still moving forward.</p>
              <p className="text-[1.85vmin] leading-[1.5] text-white/72">Keep a place for the things worth keeping.</p>
            </motion.div>
            <motion.div
              className="mt-[1.7vmin] flex items-center gap-[.8vmin] border-t border-white/[.08] pt-[1.2vmin] font-mono text-[1.05vmin] uppercase tracking-[.12em] text-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.6, duration: 0.3 }}
            >
              <span className="h-[.65vmin] w-[.65vmin] rounded-full bg-primary" />
              Message saved in {moved ? 'Projects' : 'Inbox'}
            </motion.div>
          </div>
        </motion.article>
      </Stage>
    </motion.section>
  );
}
