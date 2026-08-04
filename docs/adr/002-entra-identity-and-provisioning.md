# ADR-002: Entra Identity and Provisioning

Status: Accepted; tenant facts pending  
Date: 2026-08-04

## Decision

Use tenant-restricted Microsoft Entra SSO for institutional users. Validate issuer/tenant and verified institutional email; default new users to student; allow only admin/MIS-controlled role and membership changes. Design parent identity/linking separately. Keep secrets outside source and the browser.

## Consequences

The email-domain trigger is defence in depth, not the primary tenant boundary. Staging is blocked until the tenant ID, app registration, redirect URIs, emergency owner, and guest policy are supplied.
