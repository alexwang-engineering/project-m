# Supabase database workflow

`migrations/` is the only deployment source of truth. The older `schema.sql` is retained temporarily as historical Phase 1 input and must not be applied alongside the migrations.

## Local verification

Docker-compatible container runtime and Supabase CLI 2.111 or newer are required.

```bash
npx supabase@2.111.0 start
npx supabase@2.111.0 db reset
npx supabase@2.111.0 test db
npx supabase@2.111.0 db lint --local --level warning --fail-on error
npx supabase@2.111.0 gen types typescript --local > lib/database.types.ts
```

Never run `db push` against staging or production until the generated type diff, RLS tests, grants review, and migration recovery notes have been reviewed. Auth self-signup remains disabled by `config.toml`; tenant-restricted Entra and separately verified guardian admission must be completed before any real-user pilot.

## Recovery

These migrations create a new foundation and are not designed for in-place rollback after production data exists. In a disposable environment, use `db reset`. In staging/production, restore the pre-migration database backup or deploy a reviewed forward migration. Never drop identity, audit, revision, or file-metadata tables as an improvised rollback.
