'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  penjokiId?: string;
  penjoki?: {
    id: string;
    status: string;
    rating: number;
    totalOrder: number;
    completedOrder: number;
    balance: number;
    level: number;
    avatar?: string | null;
    specialization?: string[];
    phone?: string | null;
  };
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; role?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Helper: buat headers dengan token dari localStorage (fallback untuk Codespaces proxy)
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
        localStorage.removeItem('auth-token');
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Simpan token di localStorage sebagai fallback
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
        }
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error || 'Login gagal' };
    } catch {
      return { success: false, error: 'Terjadi kesalahan' };
    }
  };

  const register = async (regData: { name: string; email: string; password: string; role?: string }) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...regData, action: 'register' }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('auth-token', data.token);
        }
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error || 'Registrasi gagal' };
    } catch {
      return { success: false, error: 'Terjadi kesalahan' };
    }
  };

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE', headers: authHeaders() });
    localStorage.removeItem('auth-token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
