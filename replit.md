# FPEDS Mail

FPEDS is a self-hosted email workspace for `fpeds.2bd.net` with access-key accounts, local SQLite mailbox storage, folders, subscriptions, native SMTP sending, Cloudflare inbound delivery, and optional AI-assisted spam filtering.

## Run & Operate

- `python app.py` — run the Flask webmail service locally
- `gunicorn app:app --bind 0.0.0.0:$PORT` — run the production server on Render
- Render build command: `pip install -r requirements.txt && corepack enable && pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/fpeds run build && test -f artifacts/fpeds/dist/public/index.html`
- Render start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD`
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
- Compose/send through a standard SMTP relay
- Incoming mail through a Cloudflare Email Routing JSON webhook
- Groq-powered spam scoring with blocked-message notifications
- Custom folders, subscriptions, notification center, and profile settings
- Annual limit of two username/email address changes
- Encrypted sensitive mailbox fields with no message-body logging

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `SESSION_SECRET`, SMTP credentials, `INBOUND_WEBHOOK_SECRET`, and `GROQ_API_KEY` are environment secrets; do not put them in source control.
- Each account's mailbox is derived server-side as `<username>@FPEDS_MAIL_DOMAIN`.
- Cloudflare must POST JSON containing `sender`/`from`, `recipient`/`to`, `subject`, and `body`/`text` to `/webhook/inbound`.
- The inbound webhook only accepts recipients at `FPEDS_MAIL_DOMAIN` and silently ignores unknown usernames.
- Render's SQLite path must be on a persistent disk if mailbox data should survive deploys or restarts.
- The auth page is intentionally a single focused panel; do not reintroduce split-screen marketing copy without an explicit product decision.

## Render setup

Create the Render service from the repository root. Do not set the service's Root Directory to
`artifacts/fpeds`; the build must be able to write `artifacts/fpeds/dist/public/index.html`,
which Flask serves in production. The included `render.yaml` is a Blueprint with the same build
and start commands, a `/api/healthz` health check, and a 1 GB persistent disk mounted at
`/var/data`.

Set these values in the Render service's Environment page:

- `SESSION_SECRET`: a long random secret used to sign login sessions.
- `FPEDS_MAIL_DOMAIN`: the domain users will receive mail at, for example `fpeds.2bd.net`.
- `SQLITE_PATH`: `/var/data/fpeds.sqlite3` when using the Render persistent disk.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`: credentials from a transactional
  email provider. Use port `587` with `SMTP_USE_TLS=true`, or port `465` with TLS-wrapped SMTP.
- `SMTP_FROM` (optional): a verified sender address. If omitted, the app sends as the signed-in
  mailbox address.
- `INBOUND_WEBHOOK_SECRET`: a random shared value used by the inbound email adapter.
- `GROQ_API_KEY` (optional): enables AI spam scoring; the local heuristic works without it.

### Outgoing mail

Use an SMTP relay such as Brevo, Mailgun, SendGrid, Postmark, or another provider that supports
authenticated SMTP. Verify the sending domain with that provider first, then copy its SMTP host,
port, username, and SMTP password/API key into the Render environment variables above. For
port 587, set `SMTP_USE_TLS=true`; for port 465, set `SMTP_USE_TLS=true` or omit it because
the app uses `SMTP_SSL` for port 465. The provider must allow the `From` domain, so either verify
the complete `FPEDS_MAIL_DOMAIN` and leave `SMTP_FROM` unset, or set `SMTP_FROM` to one verified
address on that domain.

### Incoming mail

The app does not run an IMAP server. Incoming delivery is handled by Cloudflare Email Routing
and the included `cloudflare-email-worker.js`:

1. Put the mailbox domain on Cloudflare and enable Email Routing for it.
2. Deploy the worker from `cloudflare-email-worker.js`.
3. Add Worker variables `INBOUND_URL=https://YOUR-SERVICE.onrender.com/webhook/inbound` and
   `WEBHOOK_SECRET=<the same value as Render's INBOUND_WEBHOOK_SECRET>`.
4. In Cloudflare Email Routing, create a route for `*@FPEDS_MAIL_DOMAIN` whose action is the
   Email Worker. The worker forwards the sender, recipient, subject, and plain-text body as JSON.
5. Create an FPEDS account for each username before sending mail to
   `<username>@FPEDS_MAIL_DOMAIN`; unknown usernames are intentionally ignored.

The inbound endpoint is `POST /webhook/inbound` and requires JSON plus the
`X-Webhook-Secret` header when `INBOUND_WEBHOOK_SECRET` is set. A deployed service must be public
so Cloudflare can reach it. Test the endpoint only after the Render deploy is live by sending a
message to an existing FPEDS mailbox and checking that it appears in Inbox or Spam.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
