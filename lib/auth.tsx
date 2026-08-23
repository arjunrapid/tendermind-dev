'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Role = 'admin' | 'analyst';

export interface AuthUser {
  username: string;
  name: string;
  role: Role;
}

/** Sample/demo accounts only - credentials and session are plain
 * client-side localStorage, not a real auth system. Good enough to
 * demonstrate role-gated UI (tmadmin sees Admin, tmanalyst doesn't); not
 * meant to guard anything sensitive - the API routes behind these pages
 * enforce no server-side authorization of their own. */
const SAMPLE_USERS: Record<string, { password: string; name: string; role: Role }> = {
  tmadmin: { password: 'tmadmin123', name: 'Tender Admin', role: 'admin' },
  tmanalyst: { password: 'tmanalyst123', name: 'Tender Analyst', role: 'analyst' },
};

const STORAGE_KEY = 'tendermind_user';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // Corrupt/blocked storage just means "not logged in".
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const account = SAMPLE_USERS[username.trim().toLowerCase()];
    if (!account || account.password !== password) return false;

    const nextUser: AuthUser = { username: username.trim().toLowerCase(), name: account.name, role: account.role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return true;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
