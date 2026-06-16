const BASE = import.meta.env.PUBLIC_API_URL as string;
const KEY_STORAGE = 'lfna_admin_key';

export function getAdminKey(): string | null {
  return sessionStorage.getItem(KEY_STORAGE);
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(KEY_STORAGE, key);
}

export function clearAdminKey(): void {
  sessionStorage.removeItem(KEY_STORAGE);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, options);
}

export async function adminFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const key = getAdminKey() ?? '';
  const headers = new Headers(options.headers as HeadersInit | undefined);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Admin-Key', key);
  return fetch(`${BASE}${path}`, { ...options, headers });
}
