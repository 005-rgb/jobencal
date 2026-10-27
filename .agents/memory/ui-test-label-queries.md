---
name: UI test label queries
description: Accessible-name query behavior in the project's Preact/jsdom component tests.
---

In this workspace's Preact Testing Library tests, textbox role names may include the linked `aria-describedby` hint as well as the visible label. Exact label-string queries can fail even though the input is correctly labeled. Prefer a regular expression matching the stable start of the label, or query a stable role and partial name. Use `getAllByText` when a monetary result intentionally appears in both the headline and the breakdown.

**Why:** component tests encountered ambiguous accessible names for inputs with descriptions and duplicated money values in separate result sections.

**How to apply:** when adding tests for described fields or repeated result figures, use partial label matching and assert the expected duplicate count instead of relying on exact single matches.
