const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the video id from any common YouTube link (watch, youtu.be, shorts, embed, live,
 * music, mobile). Returns null for anything else, which is then played as a direct media file.
 */
export function youtubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const [, kind, value] = u.pathname.split('/');
      if (['embed', 'shorts', 'live', 'v'].includes(kind)) id = value ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Privacy-friendly embed URL that autoplays inline. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
}
