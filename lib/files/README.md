# Private file flow

1. `beginFileUploadAction` validates the filename, declared type, byte size, and SHA-256 checksum, then creates `pending` metadata through the audited database RPC.
2. The authenticated browser uploads once to the returned private bucket/object path with `upsert: false`. Storage RLS accepts only the pending record's owner and exact path.
3. **`scripts/verify-uploads.ts` is the only process that can move a file out of `pending`.** It is a standalone Node/tsx CLI, run out-of-band (cron, a scheduler, or by hand) with the service-role key - never a Next.js route or Server Action, and never imported by anything under `app/` or `components/`. There is no way for a browser request to trigger, influence, or self-approve this step.
   - Claims one `pending` file through `claim_file_for_verification()`, which uses `FOR UPDATE SKIP LOCKED` and a unique lease ID. A `scanning` lease abandoned for 15 minutes becomes claimable again; an expired worker cannot finalize a lease that was reclaimed.
   - Re-downloads the actual stored bytes and enforces the 25 MiB limit against the real object, not just the declared size.
   - Recomputes the SHA-256 digest and compares it to what was declared at upload time using a constant-time comparison (`node:crypto`'s `timingSafeEqual`).
   - Validates a real magic-byte signature against the declared media type (PDF `%PDF-`, PNG/JPEG/GIF/WebP signatures, or a ZIP signature followed by the existing bounded `unpackMpx` manifest/size/checksum validation for `.mpx`) - never the filename, extension, or browser-declared MIME type.
   - Runs the bytes through a pluggable `MalwareScanner` adapter (`lib/files/scanner.ts`). No scanner is configured by default; the worker fails closed (throws before processing anything) unless `MALWARE_SCANNER` is explicitly set, and refuses the local-development no-op scanner outright when `NODE_ENV=production`. **A real scanner adapter is not implemented yet** - this is a named, tracked blocker (see `docs/coordination/ACTIVE_WORK.md`), not a silent gap.
   - Transitions through `complete_file_verification()`, which checks the current lease and commits the terminal state plus audit event in one PostgreSQL transaction.
4. The browser polls a read-only status action (`getFileStatusAction` / `lib/files/poll-status.ts`'s `waitForFileReady`) after upload, waiting for the worker to reach a terminal state rather than assuming success. `attachFileToPageAction` only ever succeeds against an already-`ready` file (enforced server-side by `attach_ready_file_to_page`/`submit_assignment`, unchanged by this rework).
5. `createFileDownloadAction` resolves the internal path through a narrowly authorized database function and asks Storage for a one-minute signed URL. Pending, scanning, quarantined, failed, and unauthorized files all resolve to no target.

Never persist signed URLs or treat a filename, MIME declaration, object path, or client-computed checksum as trusted verification evidence.

## Running the worker locally

```bash
MALWARE_SCANNER=noop-dev-only npm run verify-uploads
```

`MALWARE_SCANNER=noop-dev-only` is refused outright when `NODE_ENV=production` - see `lib/files/scanner.ts`. There is currently no real scanner adapter wired in; implementing and configuring one is a prerequisite for running this worker against real user uploads.
