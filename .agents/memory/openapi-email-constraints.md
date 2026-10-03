---
name: OpenAPI email constraints
description: Compatibility between OpenAPI email formats and this workspace's generated Zod schemas.
---

When an API input needs email validation, prefer an OpenAPI `pattern` constraint over `format: email` unless the installed generator/Zod versions have been verified together.

**Why:** The current Orval generation emitted `zod.email()`, which does not exist in this workspace's Zod 3 installation and failed the library typecheck.

**How to apply:** Use a pattern constraint for generated validation schemas, then rerun API codegen and the library typecheck after editing the OpenAPI contract.