'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Role = 'admin' | 'analyst';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

const STORAGE_KEY = 'tendermind_token';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Raw JWT token for forwarding to backend API calls from the client. */
  token: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Restore session from stored token by calling /api/auth/me. */
  useEffect(() => {
    const stored = (() => {
      try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    })();

    if (!stored) {
      setIsLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + stored },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthUser | null) => {
        if (data) {
          setToken(stored);
          setUser(data);
        } else {
          // Token expired or invalid — clear it.
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // Network error (backend down) — keep token so we can retry later
        // but don't mark the user as authenticated.
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || 'Invalid username or password' };
      }

      const { access_token, user: serverUser } = data as { access_token: string; user: AuthUser };

      try { localStorage.setItem(STORAGE_KEY, access_token); } catch { /* ignore */ }
      setToken(access_token);
      setUser(serverUser);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach the server. Is the Python backend running?' };
    }
  };

  const logout = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
