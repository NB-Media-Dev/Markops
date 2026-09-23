/**
 * Helper to determine the Backend API Base URL across environments (SSR, Dev, Cloud).
 */
export function getBackendBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    // 1. Check for runtime injected API URL (e.g. from env.js or window object)
    const injectedUrl = (window as any).__API_URL__ || (window as any).process?.env?.BACKEND_URL;
    if (injectedUrl) return injectedUrl.replace(/\/$/, '');

    // 2. Check localStorage override (useful for pointing dev frontend to remote backend)
    try {
      const storedUrl = localStorage.getItem('MARK_OPS_API_URL');
      if (storedUrl) return storedUrl.replace(/\/$/, '');
    } catch {
      // Ignore localStorage access errors
    }

    // 3. If running on standard Angular dev server (:4200), default to local Express backend (:4000)
    if (window.location.port === '4200') {
      return 'http://localhost:4000';
    }

    // 4. In production (same-domain or configured proxy), use window.location.origin
    return window.location.origin;
  }

  // SSR / Node.js environment
  const port = (typeof process !== 'undefined' && process.env && (process.env['BACKEND_PORT'] || process.env['PORT'])) || '4000';
  const backendHost = (typeof process !== 'undefined' && process.env && process.env['BACKEND_URL']) || `http://localhost:${port}`;
  return backendHost.replace(/\/$/, '');
}

/**
 * Utility helper for API request URLs in Angular SSR and Browser environments.
 */
export function getApiUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const baseUrl = getBackendBaseUrl();

  // In browser, if base is same origin, relative path works directly
  if (typeof window !== 'undefined' && window.location && baseUrl === window.location.origin) {
    return cleanPath;
  }

  return `${baseUrl}${cleanPath}`;
}

/**
 * Safe fetch wrapper that automatically formats URLs and headers.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();
  return fetch(getApiUrl(urlStr), init);
}
