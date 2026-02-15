/**
 * Wrapper fetch yang otomatis menambahkan Authorization header
 * dari localStorage token (fallback untuk environment seperti Codespaces
 * yang memblokir httpOnly cookies melalui proxy).
 */
export function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth-token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(url, { ...options, headers });
}
