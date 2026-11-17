import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useGridStore } from '../features/grid/gridStore';
import { deltaManager } from '../features/grid/storage/deltaManager';

const rawApiBase = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? window.location.protocol + '//' + window.location.hostname + ':8002'
    : ''
);
export const API_BASE = rawApiBase.replace(/\/+$/, '');
const TOKEN_KEY = 'gema_especiales_auth_token';

export interface User {
  usuario_id: number;
  usuario: string;
  email: string;
  nombre_completo: string | null;
  rol_id: number;
  rol_nombre: string;
  estado: 'A' | 'I' | '*';
  protegido: boolean;
  ultimo_acceso: string | null;
}

interface Session {
  user: User | null;
  checking: boolean;
  message: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  endSession: (message?: string) => void;
  authFetch: typeof fetch;
}

const AuthContext = createContext<Session | null>(null);

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The session remains available in this tab.
  }
}

export async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.detail === 'string' ? body.detail : fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialToken] = useState(readToken);
  const active = useRef(initialToken);
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  const [checking, setChecking] = useState(Boolean(initialToken));
  const [message, setMessage] = useState<string | null>(null);

  const endSession = useCallback((notice?: string) => {
    active.current = null;
    storeToken(null);
    deltaManager.setOwner(null);
    useGridStore.getState().clearAll();
    setSession(null);
    setMessage(notice ?? null);
  }, []);

  const establish = useCallback((token: string, user: User) => {
    deltaManager.setOwner(user.usuario_id);
    active.current = token;
    storeToken(token);
    setSession({ token, user });
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!initialToken) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(API_BASE + '/api/auth/me', {
          headers: { Authorization: 'Bearer ' + initialToken }, signal: controller.signal,
        });
        if (controller.signal.aborted || active.current !== initialToken) return;
        if (response.status === 401) {
          endSession('Tu sesión expiró. Vuelve a iniciar sesión.');
          return;
        }
        if (!response.ok) throw await responseError(response, 'No se pudo verificar la sesión.');
        const user: User = await response.json();
        if (!controller.signal.aborted && active.current === initialToken) establish(initialToken, user);
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'No se pudo verificar la sesión.');
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    })();
    return () => controller.abort();
  }, [endSession, establish, initialToken]);

  const login = async (identifier: string, password: string) => {
    const response = await fetch(API_BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_or_email: identifier.trim(), password }),
    });
    if (!response.ok) throw await responseError(response, 'No se pudo iniciar sesión.');
    const body: { access_token: string; user: User } = await response.json();
    establish(body.access_token, body.user);
  };

  const token = session?.token;
  const authFetch: typeof fetch = useCallback(async (url, options) => {
    if (!token || active.current !== token) throw new Error('La sesión ya no está activa.');
    const headers = new Headers(options?.headers);
    headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch(url, { ...options, headers });
    if (active.current !== token) throw new Error('La sesión ya no está activa.');
    if (response.status === 401) endSession('Tu sesión expiró. Vuelve a iniciar sesión.');
    return response;
  }, [endSession, token]);

  return <AuthContext.Provider value={{ user: session?.user ?? null, checking, message, login, endSession, authFetch }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const session = useContext(AuthContext);
  if (!session) throw new Error('AuthProvider requerido');
  return session;
}
