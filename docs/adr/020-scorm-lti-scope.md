# ADR-020: SCORM/LTI Scope (Design Only, Build Deferred)

Status: Accepted (design); implementation deferred
Date: 2026-08-07

## Context

PM-01 named SCORM/LTI Launch scope; ADR-009 already set the direction ("prefer LTI 1.3 for learning tools... each connector requires its own credential boundary, threat model, rate/retry behavior, audit events, failure quarantine, and contract tests"). PM-04's threat model already names both explicitly as untrusted boundaries ("MPX/SCORM packages, LTI tools").

The two halves of this ADR split very differently, unlike they first appear:

- **LTI** is a live protocol between two servers - a real third-party tool must exist to register against, exchange OIDC/JWT launch credentials with, and validate a real launch flow end to end. Identical dead end to MIS/SIS sync's live connector and Moodle's `.mbz` reader: nothing to build against here.
- **SCORM** is a self-contained zip file with no external server at all - the "connection" is a JavaScript API the framed content calls into, implemented entirely by this app. It is *technically* buildable in this environment.

Despite SCORM being technically buildable, this ADR **defers the build**, deliberately, after asking the product owner directly. SCORM playback means running arbitrary third-party JavaScript inside the app - the highest security-stakes surface this project has designed this session - and this environment cannot live-test a sandbox against a real browser or real attacker-controlled payloads (the same Colima/Postgres gap has blocked live verification of six other packages this session, but here the missing test isn't "does a query return the right rows," it's "does the sandbox actually hold" - a materially different, higher-consequence kind of unverified). Shipping unverified sandbox-isolation code as though it were reviewed would be worse than shipping nothing. This ADR records the design so a future session with real browser-security verification available (or a real SCORM test package and a staging environment) can implement it directly, rather than re-deriving the approach from scratch.

## Decision

### LTI (fully deferred)

Prefer **LTI 1.3 (Advantage)** over legacy 1.1, per ADR-009 - OIDC third-party-initiated login, JWT-signed launch requests, JWKS-based key exchange in both directions. When a real tool exists to build against:

- A `lti_tool_registrations` table, tenant-scoped, storing each tool's `client_id`, `deployment_id`, `platform_issuer`, and JWKS URL - never a shared credential across tools, matching ADR-009's "each connector requires its own credential boundary."
- Launch-time role mapping: this project's `membership_role` (member/teacher/manager) maps onto LTI's role vocabulary (Learner/Instructor/ContentDeveloper) rather than inventing a parallel role system.
- Deep linking attaches an LTI resource link to an existing page or assignment, reusing this project's existing tag-scoped audience model for who can see the launch link - the LTI tool itself never becomes a new authorization boundary.
- No AGS (grade passback) or NRPS (roster sync via LTI) in a first version - matches this project's existing minimal-assessment-domain precedent (ADR-008) rather than building a second grade-sync path alongside Package U's MIS/SIS sync.

### SCORM (designed, build deferred)

**Format**: support SCORM 1.2 primarily (still the most common format in circulation) rather than leading with 2004's richer sequencing model - same "smallest correct thing" instinct as every other package this session.

**Storage**: extract the uploaded zip server-side into its constituent files under a private storage prefix per package (reusing Package H's private-storage/signed-URL machinery), rather than serving the zip to the browser for client-side unzipping. A bounded-extraction limit (file count, total size, path-traversal rejection) matches ADR-007's MPX precedent exactly - `jszip` is already a project dependency and MPX's existing extraction-limit code is the direct template to reuse, not reinvent.

**Isolation, the load-bearing decision**: content is served via signed URLs pointing directly at Supabase Storage's own domain, embedded in an iframe with `sandbox="allow-scripts"` and **no** `allow-same-origin`. Storage's domain is already cross-origin from the app by construction, so real browser origin isolation holds regardless of the sandbox attribute - this is deliberately not relying on the sandbox attribute alone (a well-known footgun: `allow-scripts` + `allow-same-origin` together on same-origin content lets the framed content reach the parent's cookies/storage, defeating the sandbox). Never proxy SCORM content through the app's own origin.

**Runtime API shim**: implement the SCORM 1.2 API object (`LMSInitialize`, `LMSFinish`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSGetLastError`, `LMSGetErrorString`, `LMSGetDiagnostic`) injected into the iframe's parent window, matching SCORM's own API-discovery algorithm (content walks up `window.parent`/`window.opener` looking for an object named `API`). A new table tracks `cmi.core.lesson_status`/`score.raw`/etc. per (profile, package) - same read/write shape as `quiz_attempts` (student writes their own attempt state via a narrow RPC; teacher/manager reads roll-ups via tag membership), not a new authorization pattern.

**Manifest validation**: reject a zip outright if `imsmanifest.xml` doesn't parse as well-formed XML or is missing required elements, rather than best-effort interpretation of malformed packages - matches ADR-009's "no connector may silently... create" content from bad input, and MPX's existing "compatibility errors" precedent (Package F).

## Consequences

LTI stays entirely unbuilt and unbuildable until a real tool exists to register against - no code, no data model, matching the same honest-gap treatment as MIS/SIS's live connector and Moodle's `.mbz` reader. SCORM is fully specified but also unbuilt: the storage/extraction/manifest-validation pieces are low-risk and could be split off and built with the same confidence as Package Y's migration-tracking layer, but the sandboxed-iframe-plus-API-shim core is exactly the part that most needs a real browser and adversarial testing before it ships, and that isn't available here. Do not build the isolation/shim layer without that verification in place, even if asked to move quickly - this is the one place this session where "ship on static verification alone, name the gap" is the wrong call, because the gap here is a security control, not a business-logic assumption.
