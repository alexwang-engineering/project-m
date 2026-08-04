# Institutional Auth Trigger — Integration Review

Status: Proposal retained; not integrated into an executable Supabase migration.

The Phase 3 branch contains a PostgreSQL `BEFORE INSERT` trigger that rejects `auth.users.email` values outside `@merchanttaylors.com`. Its regex correctly rejects null email, subdomains, suffix tricks, whitespace, and additional `@` signs, and the function uses a safe empty `search_path`.

It is not applied in the baseline for two reasons:

1. Email-domain membership is defence in depth, not proof of the configured Microsoft Entra tenant/issuer.
2. ADR-001 requires parent/guardian access in release 1, and legitimate guardians are expected to use non-school addresses. A global domain trigger would reject them all.

Package D/P1-02 must implement separate server-verifiable admission routes:

- Institutional identities require the approved Entra tenant/issuer and verified school email.
- Guardian identities require a separately verified or pre-authorized relationship flow.
- User-controlled metadata cannot select either trusted route.
- New institutional identities default to student; guardians receive no institutional role/tag.
- Production admission remains disabled until tenant/app registration, guardian verification, revocation, and negative tests are approved.

Original proposal provenance: `codex/phase1` commit `06dfd5e`, hardened branch head `a920262`.
