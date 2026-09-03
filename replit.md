# FPEDS Mail

FPEDS is a self-hosted email workspace for `fpeds.2bd.net` with access-key accounts, local SQLite mailbox storage, folders, subscriptions, native SMTP sending, Cloudflare inbound delivery, and optional AI-assisted spam filtering.

## Run & Operate

- `python app.py` — run the Flask webmail service locally
- `gunicorn app:app --bind 0.0.0.0:$PORT` — run the production server on Render
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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
