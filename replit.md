# FPEDS Mail

FPEDS is a self-hosted email workspace for `fpeds.2bd.net` with access-key accounts, local SQLite mailbox storage, folders, subscriptions, Brevo API sending and inbound parsing, and optional AI-assisted spam filtering.

## Run & Operate

- `python app.py` — run the Flask webmail service locally
- `python -m gunicorn app:app --bind 0.0.0.0:$PORT` — run the production server on Render
- Render root directory: repository root (`.`)
- Render build command: `pip install -r requirements.txt && pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/fpeds run build`
- Render start command: `python -m gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SESSION_SECRET`, `BREVO_API_KEY`, and `BREVO_SENDER_EMAIL`
- Optional env: `FPEDS_MAIL_DOMAIN` — mailbox domain; defaults to `fpeds.2bd.net`
- Optional env: `SQLITE_PATH` — SQLite file path; set this to a Render persistent disk path
- Optional env: `INBOUND_WEBHOOK_SECRET` — shared secret checked on Cloudflare inbound webhook requests
- Optional env: `GROQ_API_KEY` — enables AI spam scoring; heuristic scoring works without it

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Backend: Flask + Gunicorn
- DB: SQLite via Python's standard-library `sqlite3`
- Mail delivery: Python `smtplib` and `email.message.EmailMessage`
- Frontend: existing React/Vite mailbox, served as static files by Flask
- Deployment: Render Blueprint in `render.yaml`

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Focused access-key sign-in and generated-key account creation
- Mailbox views for inbox, sent, drafts, spam, search, starring, and message reading
- Compose/send through the Brevo transactional email API
- Incoming mail through the Brevo Inbound Parsing webhook (with a Cloudflare Email Worker adapter also included)
- Groq-powered spam scoring with blocked-message notifications
- Custom folders, subscriptions, notification center, and profile settings
- Annual limit of two username/email address changes
- Encrypted sensitive mailbox fields with no message-body logging

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `SESSION_SECRET`, SMTP credentials, `INBOUND_WEBHOOK_SECRET`, and `GROQ_API_KEY` are environment secrets; do not put them in source control.
- Each account's mailbox is derived server-side as `<username>@FPEDS_MAIL_DOMAIN`.
- The inbound endpoint accepts both the normalized Cloudflare payload and Brevo's `{ "items": [...] }` payload with `From`, `Recipients`/`To`, `Subject`, and `ExtractedMarkdownMessage`.
- The inbound webhook only accepts recipients at `FPEDS_MAIL_DOMAIN` and silently ignores unknown usernames.
- Render's SQLite path must be on a persistent disk if mailbox data should survive deploys or restarts.
- The auth page is intentionally a single focused panel; do not reintroduce split-screen marketing copy without an explicit product decision.

## Render setup

Create the Render service from the repository root. Do not set the service's Root Directory to
`artifacts/fpeds`; the build must be able to write `dist/public/index.html`,
which Flask serves in production. The included `render.yaml` is a Blueprint with the same build
and start commands, a `/api/healthz` health check, and a 1 GB persistent disk mounted at
`/var/data`.

Set these values in the Render service's Environment page:

- `SESSION_SECRET`: a long random secret used to sign login sessions.
- `FPEDS_MAIL_DOMAIN`: the domain users will receive mail at, for example `fpeds.2bd.net`.
- `SQLITE_PATH`: `/var/data/fpeds.sqlite3` when using the Render persistent disk.
- `BREVO_API_KEY`: a Brevo API key with transactional sending enabled.
- `BREVO_SENDER_EMAIL`: a sender address verified in Brevo for `fpeds.2bd.net`.
- `BREVO_SENDER_NAME` (optional): the display name shown to recipients.
- `INBOUND_WEBHOOK_SECRET`: a random shared value used by the inbound email adapter.
- `GROQ_API_KEY` (optional): enables AI spam scoring; the local heuristic works without it.

Replit Secrets and Render environment variables are separate. Adding `BREVO_API_KEY`
to Replit does not add it to the Render web service; set `BREVO_API_KEY` and
`BREVO_SENDER_EMAIL` directly in the Render service's Environment page.

### Outgoing mail

Verify `fpeds.2bd.net` as a Brevo sending domain, create a Brevo API key, and set
`BREVO_API_KEY` and `BREVO_SENDER_EMAIL` in Render. The app calls Brevo's
`/v3/smtp/email` endpoint with plain-text message content.

### Incoming mail

The app does not run an IMAP server. With the current DNS records, incoming delivery is handled directly by Brevo Inbound Parsing:

1. Keep `fpeds.2bd.net` as the Brevo receiving domain and create an inbound webhook with event `inboundEmailProcessed` and domain `fpeds.2bd.net`.
2. Set its webhook URL to
   `https://fpeds.onrender.com/webhook/inbound?secret=<INBOUND_WEBHOOK_SECRET>` when `INBOUND_WEBHOOK_SECRET` is set.
3. Keep these MX records on `fpeds.2bd.net`: priority 10 `inbound1.sendinblue.com.` and priority 20 `inbound2.sendinblue.com.`. If Gmail reports `550 5.1.2 Recipient address rejected`, Brevo is receiving the domain but the receiving domain/webhook is not enabled or verified in Brevo yet.
4. Brevo requires the sending domain and receiving domain to be different. Verify a separate sending subdomain such as `send.fpeds.2bd.net`, set Render's `BREVO_SENDER_EMAIL` to an address on that subdomain such as `noreply@send.fpeds.2bd.net`, and keep `fpeds.2bd.net` as the receiving domain.
5. Brevo posts a JSON payload with an `items` array. The app extracts the sender, recipient, subject, and parsed message body, then stores it in the matching FPEDS mailbox.
6. Create an FPEDS account for each username before sending mail to `<username>@FPEDS_MAIL_DOMAIN`; unknown usernames are intentionally ignored.

The included `cloudflare-email-worker.js` is an alternative adapter only. Do not use it at the same time as Brevo inbound MX records: choose either Brevo inbound parsing or Cloudflare Email Routing, and configure the matching MX records.

The inbound endpoint is `POST /webhook/inbound` and requires JSON plus the
`X-Webhook-Secret` header or `secret` query parameter when `INBOUND_WEBHOOK_SECRET` is set.
A deployed service must be public so Brevo can reach it. Test the endpoint only after the Render
deploy is live by sending a message to an existing FPEDS mailbox and checking that it appears in
Inbox or Spam.

Outgoing messages set `Reply-To` to the signed-in user's FPEDS address, even when
`BREVO_SENDER_EMAIL` is a shared verified sender.

`GET /api/healthz` reports `brevoInboundSenderDomainConflict: true` when the configured
Brevo sender uses the same domain as the FPEDS receiving domain. That configuration must be
changed in Render before inbound replies can work.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
