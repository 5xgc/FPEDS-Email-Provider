# FPEDS Mail

FPEDS is a self-hosted email workspace with Brevo API sending, Mailgun inbound receiving for `fpdf.2bd.net`, access-key accounts, local SQLite mailbox storage, folders, subscriptions, and optional AI-assisted spam filtering.

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
- Required env: `SESSION_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_DOMAIN`, and `MAILGUN_SIGNING_KEY`
- Optional env: `FPEDS_MAIL_DOMAIN` — receiving/mailbox domain; defaults to `fpdf.2bd.net`
- Optional env: `SQLITE_PATH` — SQLite file path; set this to a Render persistent disk path
- Optional env: `MAILGUN_DOMAIN` — Mailgun receiving domain; defaults to `fpdf.2bd.net`
- Optional env: `MAILGUN_API_KEY` — Mailgun account API key for provider-side route/domain management
- Optional env: `GROQ_API_KEY` — enables AI spam scoring; heuristic scoring works without it

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Backend: Flask + Gunicorn
- DB: SQLite via Python's standard-library `sqlite3`
- Mail delivery: Brevo transactional API and Mailgun inbound webhook
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
- Incoming mail through the Mailgun inbound route webhook
- Groq-powered spam scoring with blocked-message notifications
- Custom folders, subscriptions, notification center, and profile settings
- Annual limit of two username/email address changes
- Encrypted sensitive mailbox fields with no message-body logging

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `SESSION_SECRET`, mail-provider credentials, webhook secrets, and `GROQ_API_KEY` are environment secrets; do not put them in source control.
- Each account's mailbox is derived server-side as `<username>@FPEDS_MAIL_DOMAIN`.
- Mailgun posts `application/x-www-form-urlencoded` fields, including `sender`, `recipient`, `subject`, `body-plain`, and a signed webhook token.
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
- `FPEDS_MAIL_DOMAIN`: the domain users will receive mail at, `fpdf.2bd.net`.
- `SQLITE_PATH`: `/var/data/fpeds.sqlite3` when using the Render persistent disk.
- `BREVO_API_KEY`: a Brevo API key with transactional sending enabled.
- `BREVO_SENDER_DOMAIN`: the sender domain verified in Brevo for outbound mail, `fpeds.2bd.net`.
- `BREVO_SENDER_NAME` (optional): the display name shown to recipients.
- `MAILGUN_DOMAIN`: `fpdf.2bd.net`.
- `MAILGUN_SIGNING_KEY`: the signing key shown in Mailgun's webhook settings.
- `GROQ_API_KEY` (optional): enables AI spam scoring; the local heuristic works without it.

Replit Secrets and Render environment variables are separate. Adding `BREVO_API_KEY`
to Replit does not add it to the Render web service; set `BREVO_API_KEY` directly
in the Render service's Environment page.

### Outgoing mail

Verify `fpeds.2bd.net` as a Brevo sending domain, create a Brevo API key, and set
`BREVO_API_KEY` in Render. The app sends as `<username>@fpeds.2bd.net` and uses
the account's receiving address, `<username>@fpdf.2bd.net`, as Reply-To. Provider
rejection messages are returned to the compose screen so sender verification,
API-key, account-credit, and recipient problems are actionable instead of
appearing as a generic send failure.

### Incoming mail

The app does not run an IMAP server. Incoming delivery is handled by Mailgun Routes:

1. Add and verify `fpdf.2bd.net` in Mailgun.
2. Set the domain's receiving MX records to the MX records Mailgun provides.
3. Create a Mailgun route matching `.*@fpdf.2bd.net` with an action that posts to
   `https://fpeds.onrender.com/webhook/mailgun`.
4. Configure the route to post the full message and set the Mailgun signing key as
   `MAILGUN_SIGNING_KEY` in Render.
5. Create an FPEDS account for each username before sending mail to
   `<username>@fpdf.2bd.net`; unknown usernames are intentionally ignored.

Mailgun posts the sender, recipient, subject, plain-text body, and signature fields.
The API key is not needed to receive an inbound webhook; the signing key is what
authenticates Mailgun's request to the app.
The endpoint is `POST /webhook/mailgun`; `/webhook/inbound` remains an alias.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
