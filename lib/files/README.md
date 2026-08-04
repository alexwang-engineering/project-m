# Private file flow

1. `beginFileUploadAction` validates the filename, declared type, byte size, and SHA-256 checksum, then creates `pending` metadata through the audited database RPC.
2. The authenticated browser uploads once to the returned private bucket/object path with `upsert: false`. Storage RLS accepts only the pending record's owner and exact path.
3. A trusted asynchronous verifier (separate deployment package) checks the stored bytes, PDF/MPX signature, malware result, declared size, and SHA-256 before setting the file to `ready`. Browser roles cannot perform this transition.
4. `attachFileToPageAction` attaches only a verified file owned by the actor (or an administrator) to a page the actor may edit.
5. `createFileDownloadAction` resolves the internal path through a narrowly authorized database function and asks Storage for a one-minute signed URL. Pending, archived, unlinked, and unauthorized files resolve to no target.

Never persist signed URLs or treat a filename, MIME declaration, object path, or client-computed checksum as trusted verification evidence.
