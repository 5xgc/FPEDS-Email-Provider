---
name: Imported artifact workflows
description: Replit-specific setup behavior for imported artifact workspaces.
---

Imported projects can contain valid artifact.toml files while having no registered managed workflows. When a workflow must be created manually, explicitly provide the artifact's declared PORT and, for Vite web apps, BASE_PATH in the command. Replit preview ports should also use a supported port; after artifact registration, remove any legacy manual workflows so the managed artifact router owns the preview.

**Why:** Without those values, both the API entrypoint and Vite config fail before opening their configured ports. A legacy workflow on an unsupported raw port can show a blank webview even while localhost responds.

**How to apply:** Check the workflow registry first; if the imported artifact has no workflow, create only the minimal API and web workflows using supported ports and the declared base path. If registration later creates managed services, stop/remove the legacy workflows and use the managed names.