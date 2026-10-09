import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Inbox, Send } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { AppWindow, FilmTag, Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot05() {
  const [sent, setSent] = useState(false);
  const [arrived, setArrived] = useState(false);
  useSceneTimer([
    { time: 1350, callback: () => setSent(true) },
    { time: 2200, callback: () => setArrived(true) },
  ]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#111]"
      initial={{ clipPath: 'polygon(0 0,100% 0,100% 0,0 100%)' }}
      animate={{ clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)', y: '-3vh', opacity: 0.25 }}
      transition={{ duration: 0.68, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(108deg,rgba(224,52,55,.12)_0%,transparent_42%,transparent_65%,rgba(255,255,255,.025)_100%)]" />
      <Stage className="flex flex-col justify-center">
        <div className="mb-[1.4vmin] flex items-end justify-between">
          <div>
            <FilmTag>Mail flow</FilmTag>
            <h2 className="mt-[1vmin] font-display text-[4.2vmin] tracking-[-.055em] text-white">Send out. Receive here.</h2>
          </div>
          <motion.p
            className="mb-[.4vmin] font-mono text-[1.35vmin] uppercase tracking-[.15em] text-white/35"
            animate={{ opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 2.3, repeat: 1, ease: 'easeInOut' }}
          >
            Your mailbox, at the center
          </motion.p>
        </div>
        <div className="grid grid-cols-[1fr_.22fr_1fr] items-center gap-[2vmin]">
          <AppWindow label="Compose" className="h-[47vmin] max-h-[53vh] min-h-[32vmin]">
            <div className="p-[2vmin]">
              <p className="font-display text-[2.2vmin] tracking-[-.03em] text-white">New message</p>
              <div className="mt-[1.4vmin] space-y-[.65vmin]">
                <div className="flex gap-[1vmin] border-b border-white/[.08] py-[1vmin] text-[1.5vmin]"><span className="w-[7vmin] text-white/35">To</span><span className="text-white/75">hello@example.com</span></div>
                <div className="flex gap-[1vmin] border-b border-white/[.08] py-[1vmin] text-[1.5vmin]"><span className="w-[7vmin] text-white/35">Subject</span><span className="text-white/75">A quick hello</span></div>
              </div>
              <motion.div
                className="mt-[1.5vmin] min-h-[14vmin] rounded-[.8vmin] border border-white/[.08] bg-black/20 p-[1.2vmin] text-[1.55vmin] leading-[1.45] text-white/55"
                initial={{ opacity: 0.25, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
              >
                Checking in from MoralTown.
              </motion.div>
              <div className="mt-[1.4vmin] flex items-center justify-between">
                <motion.span
                  className={`inline-flex items-center gap-[.7vmin] rounded-[.75vmin] px-[1.3vmin] py-[.9vmin] text-[1.4vmin] font-semibold ${sent ? 'bg-white/[.08] text-white/65' : 'bg-primary text-white'}`}
                  animate={sent ? { scale: [1, 0.97, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {sent ? <><Check className="h-[1.5vmin] w-[1.5vmin]" /> Sent</> : <><Send className="h-[1.5vmin] w-[1.5vmin]" /> Send</>}
                </motion.span>
                <span className="font-mono text-[1vmin] uppercase tracking-[.12em] text-white/25">Visual demo</span>
              </div>
            </div>
          </AppWindow>
          <div className="relative flex h-[21vmin] items-center justify-center">
            <motion.div
              className="absolute h-[.22vmin] w-full bg-primary/50"
              initial={{ scaleX: 0.2 }}
              animate={{ scaleX: [0.2, 1, 0.2] }}
              transition={{ duration: 2.2, repeat: 1, ease: EASE }}
            />
            <motion.span
              className="relative grid h-[7vmin] w-[7vmin] place-items-center rounded-full border border-primary/40 bg-[#141010] text-primary shadow-[0_0_2.8vmin_rgba(224,52,55,.25)]"
              animate={{ x: [-30, 20, -20], rotate: [0, 14, 0], scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 3.3, ease: EASE }}
            >
              <ArrowUpRight className="h-[3vmin] w-[3vmin]" />
            </motion.span>
            <motion.span
              className="absolute right-[-5%] top-[18%] h-[1.2vmin] w-[1.2vmin] rounded-full bg-white"
              animate={{ x: [0, 28, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ delay: 0.5, duration: 2.7, ease: EASE }}
            />
          </div>
          <AppWindow label="Inbox" className="h-[47vmin] max-h-[53vh] min-h-[32vmin]">
            <div className="p-[1.8vmin]">
              <div className="mb-[1.5vmin] flex items-center justify-between">
                <p className="font-display text-[2.2vmin] text-white">Inbox</p>
                <FilmTag>1 new</FilmTag>
              </div>
              <motion.div
                className={`flex items-start gap-[1.2vmin] rounded-[1vmin] border p-[1.4vmin] ${arrived ? 'border-primary/30 bg-primary/[.07]' : 'border-white/[.08] bg-white/[.02]'}`}
                initial={{ opacity: 0.15, x: 30, scale: 0.97 }}
                animate={{ opacity: arrived ? 1 : 0.6, x: 0, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
              >
                <span className="grid h-[3.4vmin] w-[3.4vmin] shrink-0 place-items-center rounded-full bg-primary/15 text-[1.4vmin] font-semibold text-primary">M</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[1.6vmin] font-semibold text-white/85">MoralTown</p>
                    {arrived && <span className="h-[.75vmin] w-[.75vmin] rounded-full bg-primary" />}
                  </div>
                  <p className="mt-[.45vmin] truncate text-[1.5vmin] text-white/70">Welcome to your inbox</p>
                  <p className="mt-[.45vmin] text-[1.25vmin] text-white/38">Your mailbox is ready.</p>
                </div>
              </motion.div>
              <div className="mt-[1.2vmin] rounded-[1vmin] border border-white/[.07] p-[1.3vmin] opacity-55">
                <div className="flex items-center gap-[.9vmin] text-[1.5vmin] text-white/65"><Inbox className="h-[1.6vmin] w-[1.6vmin]" /> Separate folders</div>
                <p className="mt-[.8vmin] font-mono text-[1vmin] uppercase tracking-[.12em] text-white/30">Inbox · Sent · Projects</p>
              </div>
            </div>
          </AppWindow>
        </div>
        <motion.div
          className="mt-[1.3vmin] flex justify-center font-mono text-[1.3vmin] uppercase tracking-[.18em] text-white/45"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 1.4, repeat: 1, ease: 'easeInOut' }}
        >
          {sent && arrived ? 'Sent out. Received here.' : 'Send out. Receive here.'}
        </motion.div>
      </Stage>
    </motion.section>
  );
}
