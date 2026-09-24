/**
 * Helper to determine the Backend API Base URL across environments (SSR, Dev, Network LAN, Cloud).
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

    // 3. In dev mode on port 4200, Socket.IO / Direct backend connects to port 4000 of the same host machine IP
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    if (window.location.port === '4200') {
      return `${protocol}//${hostname}:4000`;
    }

    // 4. In production or proxied deployment, use window.location.origin
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

  // In browser, relative URLs (/api/...) are automatically routed through the Angular proxy
  // or served by same-origin reverse proxy, guaranteeing network link clients reach the backend host.
  if (typeof window !== 'undefined' && window.location) {
    return cleanPath;
  }

  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${cleanPath}`;
}

/**
 * Safe fetch wrapper that automatically formats URLs and headers.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();
  return fetch(getApiUrl(urlStr), init);
}
