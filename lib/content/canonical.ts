const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_PATH_PATTERN =
  /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** Converts decoded App Router slug segments into a validated canonical path. */
export function canonicalPathFromSegments(
  segments: readonly string[],
): string | null {
  if (segments.length < 1 || segments.length > 32) return null;
  const path = `/${segments.join('/')}`;
  return path.length <= 2_048 && CANONICAL_PATH_PATTERN.test(path)
    ? path
    : null;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
