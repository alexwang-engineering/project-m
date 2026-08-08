import { getFileStatusAction } from '@/app/actions/files';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30000;

/**
 * Waits for the out-of-band verification worker to move a freshly uploaded
 * file to `ready`, polling a read-only status check. There is no browser
 * action that can approve a file itself - if the worker hasn't gotten to
 * it within the timeout, this reports that rather than failing outright,
 * since the upload itself already succeeded and just needs more time.
 */
export async function waitForFileReady(
  fileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const status = await getFileStatusAction(fileId);
    if (!status.ok) return { ok: false, message: status.message };
    if (status.state === 'ready') return { ok: true };
    if (status.state === 'quarantined') {
      return {
        ok: false,
        message:
          status.quarantineReason ??
          'This file was quarantined during verification.',
      };
    }
    if (status.state === 'failed') {
      return {
        ok: false,
        message: 'This file failed verification and cannot be used.',
      };
    }
    if (Date.now() > deadline) {
      return {
        ok: false,
        message: 'Still verifying this file - try again in a moment.',
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
