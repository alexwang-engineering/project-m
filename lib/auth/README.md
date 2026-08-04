# Entra deployment gate

Institutional sign-in is intentionally fail-closed. Before enabling real users:

1. Register a single-tenant Microsoft Entra application and configure its exact redirect URI.
2. Add the `email` and `xms_edov` optional claims recommended by Supabase.
3. Configure Supabase's Azure provider with `https://login.microsoftonline.com/<tenant-id>` — never `common`.
4. Set the allowed application callback URLs and `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, and `NEXT_PUBLIC_APP_URL` deployment variables.
5. Configure the `before_user_created_institutional` database function as Supabase's Before User Created hook.
6. In a reviewed deployment migration/runbook, set the protected `institutional_auth_config.tenant_id`, then set `enabled = true` and enable OAuth signup.
7. Run negative staging tests for wrong tenant, personal Microsoft account, unverified email, suffix-confusion domain, non-Azure provider, open redirect, disabled profile, and logout/session refresh.

The tenant ID in application environment is an enablement assertion, not the primary boundary. The primary tenant restriction is Supabase's Azure Tenant URL; the Auth hook rejects creation by provider/exact domain, and the callback repeats provider/verified-domain checks before retaining a session.
