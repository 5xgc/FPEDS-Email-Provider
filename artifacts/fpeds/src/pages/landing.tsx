import { Link } from 'wouter';
import { ArrowDown, ArrowRight, Check, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import moralTownLogo from '@assets/1a92c7cd-9191-4ab4-8006-ae0a752cba6a-removebg-preview_1791064947522.png';

const principles = [
  {
    number: '01',
    title: 'A mailbox with a little more room.',
    body: 'Messages arrive in a focused workspace, not a feed competing for the next minute of your day.',
    icon: Mail,
  },
  {
    number: '02',
    title: 'Your access key stays in your hands.',
    body: 'Your key is the credential for your account. Keep a backup somewhere only you can reach.',
    icon: KeyRound,
  },
  {
    number: '03',
    title: 'Private by posture, honest by design.',
    body: 'MoralTown is built to keep the workspace focused. Email still crosses networks and services outside our control.',
    icon: ShieldCheck,
  },
];

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="MoralTown home">
      <span className="brand-mark h-10 w-[132px]">
        <img src={moralTownLogo} alt="MoralTown" />
      </span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className="moraltown landing-page">
      <header className="landing-header fixed inset-x-0 top-0 z-40 border-b border-emerald-950/10">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Brand />
          <nav className="flex items-center gap-3 sm:gap-6" aria-label="Main navigation">
            <a href="#principles" className="hidden text-sm text-foreground/70 transition-colors hover:text-foreground sm:inline">Why MoralTown</a>
            <Link href="/auth" className="rounded-full px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-foreground">Sign in</Link>
            <Link href="/auth?mode=signup" className="landing-cta inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              Find your way in <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[760px] max-w-[1440px] items-center gap-8 px-5 pb-16 pt-32 sm:px-8 md:min-h-[820px] md:grid-cols-[1.05fr_.95fr] md:px-12 lg:px-[8vw]">
        <div className="landing-grid pointer-events-none absolute inset-x-0 top-0 h-[700px] opacity-80" />
        <div className="relative z-10 max-w-[690px] animate-enter">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-900/15 bg-emerald-900/[.04] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[.19em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Independent email workspace
          </p>
          <h1 className="landing-copy font-display text-[clamp(3.7rem,8vw,7.7rem)] leading-[.91] tracking-[-.065em] text-foreground">
            Make room for <span className="landing-underline">what matters.</span>
          </h1>
          <p className="mt-8 max-w-[490px] text-base leading-7 text-foreground/65 sm:text-lg sm:leading-8">
            MoralTown is a quieter place to read and write email—with an access key you control and less noise between you and the conversation.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/auth?mode=signup" className="landing-cta inline-flex min-h-12 items-center gap-3 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#principles" className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground/65 transition-colors hover:text-foreground">
              See what we mean <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-14 flex items-center gap-4 text-xs text-foreground/55">
            <span className="flex -space-x-2">
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[hsl(43_36%_94%)] bg-[hsl(17_48%_81%)] font-mono text-[9px] text-foreground">MT</span>
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[hsl(43_36%_94%)] bg-[hsl(157_24%_75%)]"><Check className="h-3.5 w-3.5 text-primary" /></span>
            </span>
            <span>Personal by default. Clear about the edges.</span>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[550px] items-center justify-center py-10 md:py-0">
          <div className="landing-hero-art relative aspect-square w-full max-w-[490px] overflow-hidden rounded-[46%_54%_53%_47%/46%_45%_55%_54%] shadow-[0_38px_80px_hsl(157_27%_22%/.2)]">
            <div className="landing-orbit absolute inset-[12%] rounded-full border border-[hsl(43_50%_88%/.33)]" />
            <div className="landing-orbit absolute inset-[24%] rounded-full border border-dashed border-[hsl(43_50%_88%/.27)]" />
            <div className="absolute left-[50%] top-[49%] h-[47%] w-[47%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[hsl(43_50%_88%/.16)]" />
            <div className="absolute left-[50%] top-[49%] grid h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[32%] border border-[hsl(43_50%_88%/.25)] bg-[hsl(43_50%_88%/.09)] backdrop-blur-sm">
              <Sparkles className="h-10 w-10 text-[hsl(43_50%_89%)] sm:h-14 sm:w-14" strokeWidth={1.2} />
            </div>
            <div className="landing-note absolute left-[8%] top-[28%] w-[45%] rounded-2xl border border-white/20 bg-[hsl(43_40%_95%/.94)] p-4 shadow-xl sm:p-5">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">A note to self</p>
              <p className="mt-2 font-display text-xl leading-tight text-foreground sm:text-2xl">Keep the signal.<br />Leave the scroll.</p>
              <div className="mt-4 h-px bg-emerald-900/15" />
              <p className="mt-3 text-[10px] text-foreground/50">A little more intention.</p>
            </div>
            <div className="landing-note absolute bottom-[17%] right-[5%] w-[42%] rounded-2xl border border-white/15 bg-[hsl(17_42%_87%/.96)] p-4 shadow-xl sm:p-5">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[hsl(14_42%_34%)]">Your key, your call</p>
              <div className="mt-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[hsl(14_42%_34%)]" />
                <span className="h-1.5 flex-1 rounded bg-[hsl(14_42%_34%/.15)]" />
                <span className="h-1.5 w-7 rounded bg-[hsl(14_42%_34%/.3)]" />
              </div>
              <p className="mt-3 text-xs text-foreground/65">Store your credential safely.</p>
            </div>
            <span className="absolute right-[24%] top-[17%] h-2 w-2 rounded-full bg-[hsl(43_50%_89%)] shadow-[0_0_0_7px_hsl(43_50%_89%/.12)]" />
            <span className="absolute bottom-[29%] left-[17%] h-1.5 w-1.5 rounded-full bg-[hsl(17_56%_76%)]" />
          </div>
          <p className="absolute bottom-0 right-2 font-mono text-[9px] uppercase tracking-[.18em] text-foreground/40 md:bottom-[-18px]">A calmer corner of the internet</p>
        </div>
      </section>

      <div className="landing-rule mx-auto max-w-6xl" />

      <section id="principles" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
        <div className="grid gap-12 md:grid-cols-[.75fr_1.25fr] md:gap-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">A different kind of inbox</p>
            <h2 className="mt-5 max-w-sm font-display text-5xl leading-[.98] tracking-[-.05em] sm:text-6xl">Email, with its shoulders down.</h2>
            <p className="mt-6 max-w-sm text-sm leading-7 text-foreground/60">Not another attention machine. A small, useful place to tend to the messages that matter to you.</p>
          </div>
          <div className="divide-y divide-emerald-950/10 border-y border-emerald-950/10">
            {principles.map(({ number, title, body, icon: Icon }) => (
              <article key={number} className="group grid gap-4 py-7 sm:grid-cols-[52px_1fr_auto] sm:items-start sm:gap-6">
                <span className="font-mono text-[11px] text-foreground/40">{number}</span>
                <div>
                  <h3 className="font-display text-2xl tracking-[-.025em]">{title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">{body}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-900/15 text-primary transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105">
                  <Icon className="h-4 w-4" />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[hsl(158_26%_23%)] px-5 py-24 text-[hsl(43_40%_96%)] sm:px-8 md:py-32">
        <div className="pointer-events-none absolute -right-28 -top-48 h-[520px] w-[520px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-10 -top-28 h-[380px] w-[380px] rounded-full border border-white/10" />
        <div className="relative mx-auto grid max-w-[1180px] gap-12 md:grid-cols-[1fr_.72fr] md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[hsl(43_50%_80%)]">A note on privacy</p>
            <h2 className="mt-5 max-w-2xl font-display text-5xl leading-[.98] tracking-[-.05em] sm:text-7xl">Private-feeling is a practice, not a promise.</h2>
          </div>
          <div className="max-w-lg">
            <p className="text-sm leading-7 text-white/75">MoralTown is configured not to store visitor IP addresses in its app database or application access logs. Replit hosting, your network, email providers, and blockchain data services may keep their own records. Email and crypto transactions are not untraceable; those services operate outside this app’s control.</p>
            <a href="#care" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(43_50%_83%)] transition-colors hover:text-white">Read our plain-language approach <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section id="care" className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8 md:py-32 lg:px-12">
        <div className="grid gap-12 md:grid-cols-[.88fr_1.12fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Keep the key close</p>
            <h2 className="mt-5 font-display text-5xl leading-[.98] tracking-[-.05em] sm:text-6xl">Your account starts with you.</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="border-t border-emerald-950/15 pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-foreground/45">01 / Access</span>
              <h3 className="mt-5 font-display text-2xl">One key opens the door.</h3>
              <p className="mt-3 text-sm leading-6 text-foreground/60">Your access key is sensitive. Save it somewhere secure; losing it can mean losing access to your account.</p>
            </div>
            <div className="border-t border-emerald-950/15 pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-foreground/45">02 / Email</span>
              <h3 className="mt-5 font-display text-2xl">Messages take a journey.</h3>
              <p className="mt-3 text-sm leading-6 text-foreground/60">Email may pass through recipient, sender, and delivery systems. Their handling is outside this workspace’s control.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="access" className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-8 md:pb-32 lg:px-12">
        <div className="grid gap-10 border-t border-emerald-950/10 pt-10 md:grid-cols-[.72fr_1.28fr] md:gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">Access / support</p>
            <h2 className="mt-5 font-display text-4xl leading-[.98] tracking-[-.04em] sm:text-5xl">Start with the route that fits.</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-foreground/60">Account creation is available with a free access code or a one-time lifetime purchase.</p>
            <a href="https://t.me/moraltown" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Questions? Message @moraltown on Telegram <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-emerald-950/10 bg-white/40 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-foreground/45">If you have a code</p>
              <h3 className="mt-4 font-display text-2xl">Free access</h3>
              <p className="mt-2 text-sm leading-6 text-foreground/60">Enter your code to create an account. You’ll receive a separate access key to save securely.</p>
              <Link href="/auth?mode=signup" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-950/15 px-4 text-sm font-semibold transition-colors hover:bg-white/60">Use an access code <ArrowRight className="h-4 w-4" /></Link>
            </article>
            <article className="rounded-2xl border border-emerald-950/10 bg-[hsl(157_26%_28%)] p-6 text-[hsl(43_40%_97%)]">
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-white/55">One-time payment</p>
              <h3 className="mt-4 font-display text-2xl">$15 lifetime</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">Pay in BTC, SOL, ETH, or LTC. A confirmed transfer unlocks one account.</p>
              <Link href="/checkout" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[hsl(43_40%_97%)] px-4 text-sm font-semibold text-[hsl(157_26%_22%)] transition-transform hover:-translate-y-0.5">View payment methods <ArrowRight className="h-4 w-4" /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-8 md:pb-32 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-[hsl(17_43%_86%)] px-6 py-12 sm:px-12 sm:py-16 md:flex md:items-end md:justify-between">
          <div className="pointer-events-none absolute -right-10 -top-28 h-64 w-64 rounded-full border border-foreground/10" />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(14_42%_34%)]">Take a quieter route</p>
            <h2 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.05em] text-foreground sm:text-7xl">Your mail.<br />Your pace.</h2>
          </div>
            <Link href="/auth?mode=signup" className="landing-cta relative mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[hsl(157_33%_31%)] px-6 text-sm font-semibold text-[hsl(43_40%_97%)] md:mt-0">
            Create an account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 text-xs text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p>Email is a networked service. Review provider practices before sharing sensitive information.</p>
          <Link href="/auth" className="font-semibold text-foreground/70 transition-colors hover:text-foreground">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}