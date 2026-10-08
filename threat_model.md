# Threat Model

## Project Overview

MoralTown Mail is a Flask webmail service with a React/Vite client and SQLite
storage. Users create mailboxes and use 50-digit access keys. Administrators
manage service availability, announcements, roles, and aggregate activity.
Outbound mail uses Brevo, inbound messages use Mailgun, Resend is used for
payment email, and Groq is optional for spam scoring.

## Assets

- **Mailbox content and account records** — private mail, usernames, access-key
  hashes, and session state. A compromise exposes users' communications.
- **Application credentials** — the session/encryption secret, mail-provider
  credentials, optional AI credentials, and admin vault passphrase. Their
  compromise can expose data or permit misuse of external services.
- **Admin authority** — the random admin access key, encrypted admin credential
  file, service controls, role changes, and lockdown message.
- **Service availability** — users depend on working send/receive paths and
  administrators need a functioning way to pause operations or enter lockdown.
- **Operational analytics and audit records** — account/message totals and
  privileged actions, which should not include message content or credentials.

## Trust Boundaries

- **Browser to Flask API** — all client input is untrusted. Authentication,
  authorization, validation, rate limits, and lockdown checks belong on the
  server.
- **Flask to SQLite** — the application persists users, encrypted mailbox
  content, controls, challenges, and audit data. Queries must remain
  parameterized and sensitive fields encrypted or hashed.
- **Flask to mail, payment, and AI providers** — credentials remain server-side;
  provider requests use HTTPS and must have bounded timeouts and verified
  signatures where applicable.
- **User to administrator** — role checks and operational controls are enforced
  in Flask, not only hidden in the client. Lockdown permits the admin role to
  continue while blocking ordinary mailbox access.
- **Application to hosting proxy** — Flask trusts one forwarded proxy hop for
  client address and scheme. The proxy must be the only route to the origin;
  otherwise forwarded headers can be spoofed.
- **Build tooling to production** — `artifacts/mockup-sandbox` is development
  tooling and is not part of the production mail request path.

## Scan Anchors

- Production backend and trust enforcement: `app.py` (request middleware,
  authentication, CAPTCHA, mail webhooks, admin routes, and encryption).
- User-facing application: `artifacts/fpeds/src`, especially authentication,
  lockdown gating, system checks, and admin controls.
- Admin credential vault: ignored runtime file `bye/admin-access.enc`, encrypted
  with `MORALTOWN_ADMIN_VAULT_PASSWORD` from Replit Secrets.
- Development-only component preview: `artifacts/mockup-sandbox`.

## Threat Categories

### Spoofing

An attacker may guess or replay mailbox credentials, impersonate an
administrator, or forge inbound mail callbacks. Access keys must remain
high-entropy, session cookies signed and protected, admin keys encrypted at
rest, CAPTCHA challenges one-use and short-lived, and inbound callbacks
signature-verified. The client must never be treated as proof of role.

### Tampering

Attackers may submit crafted API requests or attempt cross-site state changes.
All state changes must validate their inputs, use parameterized SQL, and reject
cross-origin browser writes. Admin changes must be role-gated and audited;
inbound callbacks must validate provider signatures before storing mail.

### Repudiation

Lockdown, service pauses, announcements, and role changes need an actor and
timestamp in the audit log. Request analytics must remain aggregate and avoid
retaining IP addresses, message bodies, subjects, or recipient details.

### Information Disclosure

Private mail, email addresses, credential material, and provider configuration
must not appear in status endpoints, logs, or admin analytics. Mail content is
encrypted at rest; access keys are hashed for user records and the admin key
file is encrypted. The system-check page may reveal configuration status and
registered API paths, but never secret values. Public health output should
remain minimal.

### Denial of Service

Unauthenticated requests can consume database, CPU, and provider resources.
The application uses bounded request sizes, in-process token-bucket limits,
tighter authentication/send limits, and a CAPTCHA with proof-of-work. These
controls are per process and can be bypassed by distributed traffic or multiple
independent instances; they are not a substitute for an edge DDoS/WAF service.
Keep provider calls time-bounded and do not claim volumetric protection without
an edge service.

### Elevation of Privilege

An ordinary user must not gain mailbox or administrator access by changing a
client role, record identifier, or request payload. Enforce user ownership on
mail/folder operations and admin/co-founder permissions on operational routes.
Only an authorized admin may change user roles; lockdown and maintenance
controls must remain effective even if the client is bypassed.

## Required Guarantees

- Never return secret values, raw admin access keys, or private mail in health,
  system-check, or analytics responses.
- The mailbox remains blocked when required encryption, admin-vault, or mail
  provider checks are unavailable.
- Keep the admin access file encrypted and ignored by version control; its
  passphrase must exist only in Replit Secrets and in the administrator's
  separately protected backup.
- Treat app-level throttling and custom proof-of-work as defense in depth, not
  as Cloudflare-equivalent DDoS protection.
- Re-run dependency, static-code, and privacy/security scans after changes to
  authentication, encryption, API routes, or dependencies.
