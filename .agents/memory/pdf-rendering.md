---
name: PDF rendering in this workspace
description: Fallback for visually inspecting PDFs when PyMuPDF cannot run in the shell environment.
---

If PyMuPDF is unavailable or its installed interpreter cannot load native libraries, the preinstalled `pdftoppm` command can render PDF pages to PNG for visual inspection without changing project dependencies.

**Why:** the default Python had no `fitz` module, and the uv-installed PyMuPDF runtime could not load `libstdc++` in this workspace.

**How to apply:** for visual reference work, try the required PyMuPDF route first; if its interpreter/native-library setup blocks rendering, use `pdftoppm` as a fallback rather than altering application dependencies.
