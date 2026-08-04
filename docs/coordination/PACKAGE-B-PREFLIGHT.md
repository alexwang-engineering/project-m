# Package B Preflight — Runnable Application Foundation

Status: Design preflight only; Package B remains blocked by Package A.

## Objective refinement

Package B must turn the scaffold into a reproducible Next.js application without inventing feature-domain behavior. Its output is a reliable platform on which Claude and Codex can work independently.

## Owned paths

- Root dependency manifest and lockfile.
- `.gitignore`, Node/package-manager pinning, TypeScript, Next.js, Tailwind, PostCSS, lint, formatting, and test configuration.
- `app/layout.tsx` only as the minimum compilable server shell; Claude owns later visual implementation.
- `app/globals.css` only for Tailwind/reset wiring; Claude owns later presentation.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, and session middleware plumbing.
- `.env.example` with names but no values/secrets.
- Foundation tests, CI-local scripts, and developer setup documentation.

Package B must not modify feature components, database migrations, RLS, editor schema, visual design tokens, or feature APIs.

## Required foundation decisions

### Runtime and package management

- Select and pin a supported Node LTS release and one package manager.
- Pin direct dependency versions intentionally; commit exactly one lockfile.
- Verify framework/library versions against official documentation at implementation time.
- Include explicit `engines`/package-manager metadata and CI parity.
- Do not reuse the Phase 3 utility-only `package.json` or lockfile.

### Application boundary

- App Router with React Server Components by default.
- Client components only where browser state/events are required.
- Server-only modules use `server-only` and never leak service credentials.
- Browser Supabase client receives only public URL and publishable/anon key.
- Privileged service-role access is isolated to named server modules and prohibited by default.

### Environment contract

At minimum define placeholders for Supabase URL/public key, server-only service key where explicitly required, application origin, Entra tenant/client identifiers, monitoring environment, and feature flags. Secrets must be validated on server startup and never included in `.env.example` values.

Parent, LTI, MIS/SIS, SCORM, and migration credentials are not added until their packages own a concrete connector contract.

### Quality commands

The root scripts must provide stable commands for development, production build/start, typecheck, lint, format check, unit tests, integration tests, end-to-end tests, and all checks. Missing test suites may initially contain a documented smoke test; scripts must not report success by silently skipping required checks.

## Required initial dependencies

Only packages needed to compile the existing baseline and its immediate foundation should be installed. Likely categories are Next/React, Supabase SSR/client, Tailwind/PostCSS, TypeScript/types, lint/format, a unit-test runner with DOM support where needed, and the existing MPX/sanitizer dependencies if Package A retains those utilities.

Every additional dependency requires a reason, license/security review proportional to risk, and confirmation that native platform/framework capabilities are insufficient.

## Supabase client contracts

- Browser factory: safe singleton semantics per browser, public credentials only.
- Server factory: cookie adapter compatible with Server Components, route handlers, and server actions.
- Middleware/session refresh: refreshes auth cookies without becoming the authorization boundary.
- User lookup errors distinguish unauthenticated from unavailable, but public responses remain generic.
- No repository function accepts a caller-supplied user ID as proof of identity.

## Minimum test matrix

- Production build succeeds with documented placeholder environment handling.
- Client bundle scan does not contain server-only secret names/values.
- Server module cannot be imported into a client component.
- Supabase cookie adapter reads/writes expected values in server tests.
- Missing/invalid environment variables fail with actionable server-side errors.
- Existing dashboard and catch-all route compile with temporary typed adapters/stubs only where explicitly documented.
- Dependency audit and secret scan run in CI/local all-check command.

## Handoff to Claude Package C

Claude receives exact owned paths and may rely on: working Tailwind classes, font-loading mechanism, root layout slots, responsive viewport metadata, component test harness, and Storybook/visual-harness decision if one is approved. Claude must request dependency changes rather than editing the manifest.

## Handoff to Codex Package D

Package D receives: working local Supabase CLI instructions, migration/test scripts, generated-type command, environment contract, and an empty ordered migration path. Package B must not pre-emptively encode the draft schema as production truth.

## Acceptance additions

- Fresh checkout install is reproducible.
- No secrets or machine-specific absolute paths are tracked.
- `node_modules`, builds, coverage, local Supabase state, and environment files are ignored correctly.
- Typecheck, lint, unit smoke tests, and production build pass.
- The README distinguishes implemented behavior from planned behavior.
- The foundation introduces no authorization or product-policy decisions beyond accepted ADRs.
