// Best-effort og:image lookup for a planned-purchase link. Failures of any kind (bad URL,
// unreachable host, no og:image tag) just mean no thumbnail — never thrown to the caller.
const PRIVATE_HOST = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1\]?$|0\.0\.0\.0$)/i;
const MAX_BYTES = 200_000;

export async function fetchLinkThumbnail(pageUrl: string): Promise<string | null> {
  let parsed: URL;
  try { parsed = new URL(pageUrl); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || PRIVATE_HOST.test(parsed.hostname)) return null;

  try {
    const response = await fetch(parsed, { signal: AbortSignal.timeout(5000), redirect: 'follow' });
    const reader = response.body?.getReader();
    if (!response.ok || !reader) return null;
    const decoder = new TextDecoder();
    let html = '', bytes = 0;
    while (bytes < MAX_BYTES && !/<\/head>/i.test(html)) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match) return null;
    const resolved = new URL(match[1], parsed);
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.toString() : null;
  } catch {
    return null;
  }
}
