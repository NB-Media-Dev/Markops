/**
 * Utility helper for API request URLs in Angular SSR and Browser environments.
 * Node.js native fetch (undici) requires absolute URLs and throws ERR_INVALID_URL on relative URLs like '/api/tasks'.
 */
export function getApiUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location) {
      return url;
    }
    const port = (typeof process !== 'undefined' && process.env && process.env['PORT']) || '4000';
    return `http://localhost:${port}${url}`;
  }
  return url;
}

/**
 * Safe fetch wrapper that automatically formats relative URLs for SSR compatibility.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();
  return fetch(getApiUrl(urlStr), init);
}
