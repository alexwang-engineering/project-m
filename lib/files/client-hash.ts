function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Client-side SHA-256, matching begin_file_upload's declared checksum requirement. */
export async function sha256Hex(file: File): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
}

/** Client-side SHA-256 of a text string - used to detect content changes for migration-import resumability. */
export async function sha256HexOfText(text: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
}
