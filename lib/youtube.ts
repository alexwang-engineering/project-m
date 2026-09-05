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
    if (host === 'youtu.be')
      id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    else if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com'
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (/^\/(embed|shorts)\//.test(url.pathname))
        id = url.pathname.split('/')[2] ?? null;
    }
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}
