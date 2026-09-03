---
name: Render pnpm reproducibility
description: Why this workspace pins pnpm for Render builds.
---

Render builds should use the pnpm major version that matches the lockfile rather than relying on
Corepack's default/latest selection.

**Why:** An unpinned Corepack invocation selected a newer pnpm release in one environment and
failed before the frontend build could run, even though the workspace had a compatible pnpm
available.

**How to apply:** Keep the root package manager declaration aligned with the lockfile and use
that package manager for the Render install and frontend build commands.