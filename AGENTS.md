<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project M review rule

Every check, audit, review, or comparison must use first-principles reasoning before proposing changes:

1. state the user outcome being protected;
2. identify source evidence and distinguish observations from assumptions;
3. identify security, privacy, data-integrity, accessibility, and operational invariants;
4. trace the real implementation and authorization boundary end to end;
5. compare observed behavior with the required outcome, not merely with another product's appearance;
6. report contradictions, missing evidence, and unnecessary scope; and
7. prefer the smallest change that fixes the root cause, then verify it with proportionate tests.

Never claim “no findings” from visual inspection alone. Record what was inspected, what was tested, and what remains blocked or unverified.

Run requested checks as a convergence loop:

1. inspect and test the full stated scope;
2. record and fix every in-scope finding at its root cause;
3. restart the affected checks after each fix; and
4. stop only after one complete pass produces no new findings.

If a finding cannot be fixed safely within scope, report it as blocked rather than calling the loop clean. “No new findings” applies only to the evidence and environments actually checked.
