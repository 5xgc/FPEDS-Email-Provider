---
name: Imported artifact workflows
description: Replit-specific setup behavior for imported artifact workspaces.
---

Imported projects can contain valid artifact.toml files while having no registered managed workflows. When a workflow must be created manually, explicitly provide the artifact's declared PORT and, for Vite web apps, BASE_PATH in the command.

**Why:** Without those values, both the API entrypoint and Vite config fail before opening their configured ports.

**How to apply:** Check the workflow registry first; if the imported artifact has no workflow, create only the minimal API and web workflows using the ports and base path already declared by the artifact.