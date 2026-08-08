// Deliberately no `import 'server-only'` here: this module is imported by
// scripts/verify-uploads.ts, a plain Node/tsx CLI entrypoint that runs
// outside Next's bundler, where the server-only package's default export
// unconditionally throws (it only no-ops under Next's own server build
// condition). This module's isolation from the browser is architectural -
// it is never imported by anything under app/ or components/, verified by
// grep as part of this package's own test gate - not enforced by this marker.

export interface MalwareScanResult {
  readonly clean: boolean;
  /** Present only when clean is false - never logged verbatim with file content. */
  readonly reason?: string;
}

/** Adapter boundary for a real malware scanner (ClamAV, a cloud AV API, etc). */
export interface MalwareScanner {
  readonly name: string;
  scan(bytes: Uint8Array, mediaType: string): Promise<MalwareScanResult>;
}

/**
 * Always reports clean. Only usable outside production, and only when
 * explicitly opted into - this is a placeholder for local development
 * where no real scanner is reachable, never a silent default.
 */
class NoopDevScanner implements MalwareScanner {
  readonly name = 'noop-dev-scanner';
  async scan(): Promise<MalwareScanResult> {
    return { clean: true };
  }
}

/**
 * Resolves the malware scanner to use. Fails closed: in production, no
 * scanner configuration falls through to an error rather than silently
 * approving files unscanned. A real adapter (ClamAV daemon, cloud AV API,
 * etc) should set MALWARE_SCANNER to a recognized value and be wired in
 * here as it's built - none exists yet, which is why production is
 * currently blocked on this (see docs/coordination/ACTIVE_WORK.md).
 */
export function resolveMalwareScanner(): MalwareScanner {
  const configured = process.env.MALWARE_SCANNER?.trim();

  if (configured === 'noop-dev-only') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MALWARE_SCANNER=noop-dev-only is not permitted when NODE_ENV=production. ' +
          'Configure a real scanner adapter before running the verification worker in production.',
      );
    }
    return new NoopDevScanner();
  }

  throw new Error(
    'No malware scanner is configured. Set MALWARE_SCANNER to a recognized adapter ' +
      '(currently only "noop-dev-only" exists, for local development), or implement and ' +
      'wire in a real adapter before running the verification worker.',
  );
}
