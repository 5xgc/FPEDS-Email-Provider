---
name: MoralTown security boundaries
description: Product policy for admin lockdown and the limit of application-level DDoS controls.
---

MoralTown's application-level throttling is defense in depth, not edge DDoS protection. Do not describe it as equivalent to Cloudflare or as protection from distributed volumetric floods; keep that limitation visible in the check screen.

**Why:** the user explicitly asked for very strong DDoS protection, and app-local counters cannot absorb traffic before it reaches the service.

**How to apply:** use an edge WAF/proxy for traffic filtering; keep the app limiter and CAPTCHA as additional safeguards.

Only the `admin` role bypasses the lockdown screen. Co-founders may perform permitted administrative operations outside lockdown but do not bypass lockdown.

**Why:** the user said only the admin account should be able to view the website during lockdown.

**How to apply:** enforce this both in the browser gate and in server-side route checks; never rely only on hiding UI.

Admin credential-file passphrases stay in Replit Secrets, separate from the encrypted credential file. Never store a plaintext key or passphrase in the `bye` folder or expose either through status APIs.

**Why:** the requested admin key file must remain usable without turning the folder into a plaintext credential store.

**How to apply:** create the encrypted key file from server-held secret configuration and keep generated ciphertext ignored by version control.
