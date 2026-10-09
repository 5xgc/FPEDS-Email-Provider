import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { FilmTag, Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Shot06() {
  const [accountsVisible, setAccountsVisible] = useState(false);
  const [lockdownVisible, setLockdownVisible] = useState(false);
  useSceneTimer([
    { time: 2400, callback: () => setAccountsVisible(true) },
    { time: 3350, callback: () => setLockdownVisible(true) },
  ]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#0a0a0a]"
      initial={{ clipPath: 'inset(100% 0 0 0)', rotateX: 4 }}
      animate={{ clipPath: 'inset(0% 0 0 0)', rotateX: 0 }}
      exit={{ scale: 1.12, filter: 'blur(8px)', opacity: 0 }}
      transition={{ duration: 0.65, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_23%_45%,rgba(224,52,55,.14),transparent_42%)]" />
      <Stage className="grid grid-cols-[.82fr_1.18fr] items-center gap-[5vmin]">
        <div>
          <FilmTag>Settings</FilmTag>
          <motion.h2
            className="mt-[1.6vmin] font-display text-[6.6vmin] leading-[.9] tracking-[-.07em] text-white"
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
          >
            Private
            <br />
            by design.
          </motion.h2>
          <motion.p
            className="mt-[1.8vmin] max-w-[39vmin] text-[2.35vmin] leading-[1.35] text-white/48"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.4 }}
          >
            Account access and privacy controls, in one place.
          </motion.p>
          <motion.div
            className="mt-[2.2vmin] flex items-center gap-[1vmin] rounded-[1vmin] border border-primary/25 bg-primary/[.065] px-[1.2vmin] py-[1vmin]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.45, duration: 0.45, ease: EASE }}
          >
            <LockKeyhole className="h-[2vmin] w-[2vmin] text-primary" />
            <span className="font-mono text-[1.45vmin] uppercase tracking-[.11em] text-white/82">Encrypted at rest</span>
          </motion.div>
        </div>

        <motion.div
          className="relative rounded-[1.8vmin] border border-white/10 bg-[#111]/95 p-[2vmin] shadow-[0_2vmin_8vmin_rgba(0,0,0,.5)]"
          initial={{ opacity: 0, scale: 0.92, rotateY: 6 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex items-center justify-between border-b border-white/[.08] pb-[1.25vmin]">
            <div>
              <p className="font-mono text-[1.1vmin] uppercase tracking-[.17em] text-primary">Account access</p>
              <p className="mt-[.45vmin] font-display text-[2.25vmin] text-white">Your access key</p>
            </div>
            <span className="grid h-[4.3vmin] w-[4.3vmin] place-items-center rounded-[1vmin] border border-white/10 bg-black/30 text-primary"><KeyRound className="h-[2.1vmin] w-[2.1vmin]" /></span>
          </div>
          <div className="mt-[1.3vmin] flex items-center justify-between rounded-[.9vmin] border border-white/[.08] bg-black/25 px-[1.3vmin] py-[1vmin]">
            <span className="font-mono text-[1.7vmin] tracking-[.2em] text-white/50">••••••••••••••••</span>
            <span className="font-mono text-[1vmin] uppercase tracking-[.14em] text-white/25">Masked</span>
          </div>
          <motion.div
            className="mt-[1.1vmin] flex items-center justify-between border-b border-white/[.08] py-[1vmin]"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55, duration: 0.35 }}
          >
            <div><p className="text-[1.5vmin] text-white/80">Mailbox fields</p><p className="mt-[.3vmin] text-[1.1vmin] text-white/38">Encrypted at rest</p></div>
            <Check className="h-[1.8vmin] w-[1.8vmin] text-primary" />
          </motion.div>
          <div className="relative mt-[1.6vmin] rounded-[1.1vmin] border border-white/[.08] bg-black/20 p-[1.2vmin]">
            <div className="absolute left-[2.7vmin] top-[2.5vmin] h-[3.8vmin] w-[.2vmin] bg-primary/60" />
            <p className="mb-[.9vmin] font-mono text-[1.05vmin] uppercase tracking-[.15em] text-white/33">MoralTown account</p>
            {['kai@fpdf.2bd.net', 'notes@fpdf.2bd.net'].map((email, index) => (
              <motion.div
                key={email}
                className="relative z-[1] mb-[.7vmin] flex items-center gap-[.8vmin] rounded-[.7vmin] border border-white/[.06] bg-[#121212] px-[.9vmin] py-[.75vmin] last:mb-0"
                initial={{ opacity: 0, x: index === 0 ? -15 : 15, scale: 0.98 }}
                animate={{ opacity: accountsVisible ? 1 : 0.35, x: 0, scale: 1 }}
                transition={{ delay: 0.75 + index * 0.12, duration: 0.44, ease: EASE }}
              >
                <span className="grid h-[2.8vmin] w-[2.8vmin] place-items-center rounded-full bg-primary/12 text-[1.05vmin] text-primary">{index === 0 ? 'K' : 'N'}</span>
                <span className="font-mono text-[1.3vmin] text-white/66">{email}</span>
                {index === 0 && <Check className="ml-auto h-[1.4vmin] w-[1.4vmin] text-primary" />}
              </motion.div>
            ))}
          </div>
          <motion.div
            className={`mt-[1.2vmin] flex items-center gap-[.8vmin] rounded-[.8vmin] border px-[1vmin] py-[.8vmin] ${lockdownVisible ? 'border-primary/25 bg-primary/[.07]' : 'border-white/[.07] bg-white/[.025]'}`}
            initial={{ opacity: 0, y: 7 }}
            animate={lockdownVisible ? { opacity: 1, y: 0, scale: [1, 1.02, 1] } : { opacity: 0, y: 7 }}
            transition={{ duration: lockdownVisible ? 0.55 : 0.15, ease: EASE }}
          >
            <ShieldCheck className="h-[1.8vmin] w-[1.8vmin] text-primary" />
            <span className="font-mono text-[1.15vmin] uppercase tracking-[.13em] text-white/68">Admin-only lockdown</span>
          </motion.div>
          <motion.div
            className="absolute -right-[3vmin] -top-[2.5vmin] h-[8vmin] w-[8vmin] rounded-full border border-primary/45"
            animate={{ rotate: [0, 35, 65], scale: [0.9, 1.08, 0.84] }}
            transition={{ delay: 0.25, duration: 4.35, ease: EASE }}
          />
        </motion.div>
      </Stage>
      <motion.div
        className="absolute bottom-[2vmin] right-[7vmin] font-mono text-[1vmin] uppercase tracking-[.16em] text-white/27"
        animate={{ opacity: [0.25, 0.55, 0.3] }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      >
        Separate mailboxes · one original access key
      </motion.div>
    </motion.section>
  );
}
