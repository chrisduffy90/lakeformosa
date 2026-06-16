const BASE = import.meta.env.PUBLIC_API_URL as string;
const SESSION_KEY = 'lfna_session_id';
const SESSION_EMAIL_KEY = 'lfna_session_email';
const SESSION_NAME_KEY = 'lfna_session_name';

export function getSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getSessionEmail(): string | null {
  return sessionStorage.getItem(SESSION_EMAIL_KEY);
}

export function getSessionName(): string | null {
  return sessionStorage.getItem(SESSION_NAME_KEY);
}

export function setSession(id: string, email: string, name: string): void {
  sessionStorage.setItem(SESSION_KEY, id);
  sessionStorage.setItem(SESSION_EMAIL_KEY, email);
  sessionStorage.setItem(SESSION_NAME_KEY, name);
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EMAIL_KEY);
  sessionStorage.removeItem(SESSION_NAME_KEY);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, options);
}

export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const sessionId = getSessionId() ?? '';
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('X-Session-Id', sessionId);
  return fetch(`${BASE}${path}`, { ...options, headers });
}
