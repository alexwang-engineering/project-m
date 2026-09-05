const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Normalizes a YouTube ID/HTTPS URL to one canonical video ID, or rejects it. */
export function normalizeYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.searchParams.has('list')
    )
      return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    const path = url.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') id = path.length === 1 ? (path[0] ?? null) : null;
    else if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com'
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (
        path.length === 2 &&
        (path[0] === 'embed' || path[0] === 'shorts')
      )
        id = path[1] ?? null;
    }
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}
