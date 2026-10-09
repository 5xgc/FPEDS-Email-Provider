import { motion } from 'framer-motion';
import { Archive, FileText, Inbox, Search, Send, Star } from 'lucide-react';
import { AppWindow, FilmTag, Stage } from '../film-primitives';

const EASE = [0.22, 1, 0.36, 1] as const;

const messages = [
  { initials: 'R', from: 'Rowan', subject: 'A note for today', preview: 'The quiet work is still moving forward.', unread: true },
  { initials: 'M', from: 'MoralTown', subject: 'Welcome to your private inbox', preview: 'Your mailbox is ready.', unread: true },
  { initials: 'S', from: 'Studio', subject: 'A small update', preview: 'Everything is organized for the week.', unread: false },
];

export function Shot03() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#090909]"
      initial={{ clipPath: 'inset(0 100% 0 0)', rotateY: -5 }}
      animate={{ clipPath: 'inset(0 0% 0 0)', rotateY: 0 }}
      exit={{ clipPath: 'circle(0% at 59% 48%)', scale: 1.12, opacity: 0.2 }}
      transition={{ duration: 0.68, ease: EASE }}
    >
      <div className="absolute inset-y-0 left-0 w-[32%] bg-primary/[.08]" />
      <div className="absolute inset-y-0 right-0 w-[28%] bg-[linear-gradient(145deg,rgba(224,52,55,.09),transparent_58%)]" />
      <Stage className="flex flex-col justify-center">
        <motion.div
          className="mb-[1.8vmin] flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.36 }}
        >
          <div>
            <FilmTag>Inbox</FilmTag>
            <h2 className="mt-[1vmin] font-display text-[4.2vmin] tracking-[-.055em] text-white">A quieter kind of inbox.</h2>
          </div>
          <span className="font-mono text-[1.4vmin] uppercase tracking-[.16em] text-white/35">3 conversations</span>
        </motion.div>
        <motion.div
          className="w-full"
          initial={{ scale: 1, x: 0 }}
          animate={{ scale: [1, 1.015, 1.055], x: [0, 0, -14] }}
          transition={{ delay: 1.45, duration: 2.8, ease: EASE }}
        >
        <AppWindow className="h-[60vmin] max-h-[67vh] min-h-[36vmin] -rotate-[.5deg]">
          <div className="flex h-full min-h-0">
            <aside className="w-[22%] shrink-0 border-r border-white/[.08] bg-black/20 px-[1.5vmin] py-[1.5vmin]">
              <div className="mb-[1.2vmin] flex items-center gap-[.7vmin] rounded-[.8vmin] bg-primary/10 px-[1vmin] py-[1vmin] text-[1.7vmin] text-primary">
                <Inbox className="h-[1.8vmin] w-[1.8vmin]" /> Inbox
              </div>
              {[
                { name: 'Sent', icon: Send },
                { name: 'Drafts', icon: FileText },
                { name: 'Projects', icon: Archive },
              ].map(({ name, icon: Icon }, index) => (
                <motion.div
                  key={name}
                  className="mb-[.6vmin] flex items-center gap-[.7vmin] rounded-[.8vmin] px-[1vmin] py-[.85vmin] text-[1.55vmin] text-white/42"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.13, duration: 0.3 }}
                >
                  <Icon className="h-[1.7vmin] w-[1.7vmin]" /> {name}
                </motion.div>
              ))}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col p-[1.6vmin]">
              <div className="mb-[1.15vmin] flex items-center gap-[.8vmin] rounded-[.8vmin] border border-white/[.08] bg-white/[.025] px-[1.1vmin] py-[.75vmin] text-[1.4vmin] text-white/35">
                <Search className="h-[1.6vmin] w-[1.6vmin]" />
                <motion.span
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ delay: 2.05, duration: 0.42, ease: EASE }}
                >
                  Search mailbox
                </motion.span>
              </div>
              <div className="grid grid-cols-[.72fr_1.45fr_1.8fr_.7fr] gap-[1vmin] border-b border-white/[.08] px-[1vmin] py-[.6vmin] font-mono text-[1.05vmin] uppercase tracking-[.12em] text-white/25">
                <span>From</span><span>Subject</span><span>Preview</span><span>Today</span>
              </div>
              <div className="min-h-0 flex-1">
                {messages.map((message, index) => (
                  <motion.div
                    key={message.subject}
                    className={`grid grid-cols-[.72fr_1.45fr_1.8fr_.7fr] items-center gap-[1vmin] border-b border-white/[.06] px-[1vmin] py-[1.5vmin] ${index === 1 ? 'bg-white/[.035]' : ''}`}
                    initial={{ opacity: 0, x: 30, scale: 0.985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.38 + index * 0.25, duration: 0.45, ease: EASE }}
                  >
                    <div className="flex min-w-0 items-center gap-[.75vmin]">
                      <span className={`grid h-[3.2vmin] w-[3.2vmin] shrink-0 place-items-center rounded-full text-[1.35vmin] font-semibold ${message.unread ? 'bg-primary/15 text-primary' : 'bg-white/[.07] text-white/50'}`}>{message.initials}</span>
                      <span className={`truncate text-[1.55vmin] ${message.unread ? 'font-semibold text-white/90' : 'text-white/48'}`}>{message.from}</span>
                    </div>
                    <span className={`truncate text-[1.55vmin] ${message.unread ? 'font-semibold text-white/85' : 'text-white/48'}`}>{message.subject}</span>
                    <span className="truncate text-[1.35vmin] text-white/35">{message.preview}</span>
                    <span className="flex items-center justify-end gap-[.65vmin] font-mono text-[1.1vmin] text-white/30">
                      {index === 1 && <motion.span className="h-[.65vmin] w-[.65vmin] rounded-full bg-primary" animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }} transition={{ duration: 1.1, repeat: 1 }} />}
                      <Star className="h-[1.35vmin] w-[1.35vmin] text-white/25" />
                    </span>
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="mt-[1vmin] flex items-center justify-between border-t border-white/[.08] pt-[1vmin] font-mono text-[1.05vmin] uppercase tracking-[.13em] text-white/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.45, duration: 0.35 }}
              >
                <span>Organize messages. Keep your focus.</span>
                <span className="text-primary">Mailbox views</span>
              </motion.div>
            </div>
          </div>
        </AppWindow>
        </motion.div>
      </Stage>
      <motion.div
        className="absolute right-[7vmin] top-[46%] h-[.25vmin] w-[19vmin] origin-left bg-primary"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 1.6] }}
        transition={{ delay: 0.85, duration: 1.1, ease: EASE }}
      />
    </motion.section>
  );
}
