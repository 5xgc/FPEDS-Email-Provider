# FPEDS Mail

FPEDS is a privacy-first email workspace for `fpeds.jo3.org` with access-key accounts, encrypted mailbox content, folders, subscriptions, and AI-assisted spam filtering.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Focused access-key sign-in and generated-key account creation
- Mailbox views for inbox, sent, drafts, spam, search, starring, and message reading
- Compose/send through Resend, with inbound webhook handling
- Groq-powered spam scoring with blocked-message notifications
- Custom folders, subscriptions, notification center, and profile settings
- Annual limit of two username/email address changes
- Encrypted sensitive mailbox fields with no message-body logging

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `RESEND_API_KEY` and `GROQ_API_KEY` are Replit Secrets; do not put either in source control.
- The server derives its at-rest encryption key from `FPEDS_ENCRYPTION_KEY` when present, otherwise the existing `SESSION_SECRET`.
- Resend inbound delivery must be configured to POST normalized `{ to, from, subject, text }` payloads to `/api/webhooks/resend`.
- The auth page is intentionally a single focused panel; do not reintroduce split-screen marketing copy without an explicit product decision.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
