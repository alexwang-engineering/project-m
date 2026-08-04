const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/u;

/** Allows only local application paths, preventing OAuth open redirects. */
export function safeNextPath(
  input: string | null | undefined,
  fallback = '/',
): string {
  if (
    !input ||
    input.length > 2048 ||
    !input.startsWith('/') ||
    input.startsWith('//') ||
    CONTROL_OR_BACKSLASH.test(input)
  ) {
    return fallback;
  }
  try {
    const parsed = new URL(input, 'https://project-m.invalid');
    if (
      parsed.origin !== 'https://project-m.invalid' ||
      parsed.pathname.startsWith('/auth/')
    )
      return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** Returns true only for application areas that must never be anonymous. */
export function isProtectedPath(pathname: string): boolean {
  return ['/account', '/admin', '/editor'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
