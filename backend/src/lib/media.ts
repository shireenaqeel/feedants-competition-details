/**
 * Media fields hold either an absolute URL (external / CDN) or a path to a file this API serves
 * ("/uploads/..."). Paths are turned into absolute URLs at read time, using the host the client
 * called, so the same record works for a phone on the LAN and for production.
 */
export function mediaUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value) return null;
  return value.startsWith('/') ? `${baseUrl}${value}` : value;
}
