import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, LockKeyhole, Send, X } from 'lucide-react';
import { getGetMailboxSummaryQueryKey, getListMessagesQueryKey, useSendMessage } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MailShell } from '@/components/mail-shell';

export default function ComposePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!to.trim() || !to.includes('@')) { setError('Add a valid recipient address.'); return; }
    if (!subject.trim() || !body.trim()) { setError('A subject and a message are required.'); return; }
    sendMessage.mutate({ data: { to: to.trim(), subject: subject.trim(), body: body.trim() } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey({ folder: 'sent' }) }); queryClient.invalidateQueries({ queryKey: getGetMailboxSummaryQueryKey() }); setSent(true); }, onError: () => setError('The message stayed here. Please check the recipient and try again.') });
  };
  if (sent) return <MailShell><div className="mx-auto flex min-h-[70dvh] max-w-xl items-center justify-center p-6"><div className="w-full text-center animate-enter"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary"><CheckCircle2 className="h-7 w-7" /></div><p className="mt-7 font-mono text-[10px] uppercase tracking-[.22em] text-primary">Delivered to the outbound queue</p><h1 className="mt-3 font-display text-5xl">It is on its way.</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Your message was handed off without adding a tracking pixel or signature.</p><div className="mt-8 flex justify-center gap-3"><Button variant="outline" onClick={() => { setSent(false); setTo(''); setSubject(''); setBody(''); }} data-testid="button-compose-another">Write another</Button><Button onClick={() => setLocation('/inbox')} data-testid="button-back-inbox">Back to inbox</Button></div></div></div></MailShell>;
  return <MailShell><div className="mx-auto max-w-[900px] p-5 sm:p-8"><div className="mb-8 flex items-end justify-between"><div><button onClick={() => setLocation('/inbox')} className="mb-5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="button-back-compose"><ArrowLeft className="h-4 w-4" /> Inbox</button><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">New correspondence</p><h1 className="mt-2 font-display text-5xl tracking-[-.04em]">Compose<span className="text-primary">.</span></h1></div><button onClick={() => setLocation('/inbox')} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" data-testid="button-cancel-compose"><X className="h-5 w-5" /></button></div>
    <form onSubmit={submit} className="glass overflow-hidden rounded-2xl"><div className="border-b hairline px-6 py-5"><div className="flex items-center gap-3 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" /> End-to-end transport protections are active for this send.</div></div><div className="space-y-1 px-6 py-6"><label className="flex items-center gap-4 border-b border-white/[.08] py-3"><span className="w-16 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">To</span><Input value={to} onChange={e => setTo(e.target.value)} type="email" placeholder="recipient@domain.com" className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" data-testid="input-recipient" /></label><label className="flex items-center gap-4 border-b border-white/[.08] py-3"><span className="w-16 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Subject</span><Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} placeholder="A clear subject" className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" data-testid="input-subject" /></label><Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write with care…" className="min-h-[330px] resize-y border-0 bg-transparent px-0 pt-8 text-[15px] leading-8 shadow-none focus-visible:ring-0" data-testid="input-message-body" /></div><div className="flex flex-col gap-3 border-t hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">{error ? <p className="text-xs text-primary" data-testid="status-compose-error">{error}</p> : <p className="font-mono text-[10px] text-muted-foreground">{body.length.toLocaleString()} / 100,000 characters</p>}<Button type="submit" disabled={sendMessage.isPending} className="rounded-xl px-6" data-testid="button-send-message">{sendMessage.isPending ? 'Sending securely…' : <><Send className="h-4 w-4" /> Send message</>}</Button></div></form>
  </div></MailShell>;
}