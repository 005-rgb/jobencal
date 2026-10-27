---
name: Runtime version selection
description: Select the project-declared Node runtime in imported workspaces before package installation and checks.
---

Check `node --version` against the project's `engines` requirement before installing packages or running scripts. Imported workspaces may start with an older Node runtime even when the project requires a newer one.

**Why:** this workspace's package installation initially ran under Node 20 although the project requires Node 22, producing `EBADENGINE` warnings and preventing reliable checks.

**How to apply:** select the matching Node module first, then install dependencies and run tests/builds. Keep `.replit` aligned with the declared project runtime.
