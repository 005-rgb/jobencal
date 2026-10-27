---
name: cPanel shell portability
description: Bash portability constraints observed in the cPanel deployment environment.
---

Bash process substitution (`< <(...)`) failed in the cPanel deployment environment with `/dev/fd/N: No such file or directory`, while the script continued past the skipped loop.

**Why:** This was observed during the October 27, 2026 deployment; the warning can conceal a skipped safety step even when later deployment checks succeed.

**How to apply:** In cPanel deployment scripts, write command output to private temporary files and read it with Bash loops. Use NUL-delimited lists and `read -d ''` for Git paths.
