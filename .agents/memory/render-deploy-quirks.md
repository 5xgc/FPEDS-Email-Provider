---
name: Render deployment quirks
description: Environment-specific rules for this imported Flask and pnpm service on Render.
---

Keep the Render service rooted at the repository root. The Vite build writes the frontend to the root `dist/public` directory, and the Gunicorn entrypoint is the root `app.py`.

**Why:** Setting a nested Render Root Directory can make the frontend build appear successful while the start command cannot find `app.py` or a redundant post-build path check fails.

**How to apply:** Use the root-level `render.yaml` build and start commands, and let the Vite build exit code determine build success instead of adding a second relative-path file check.