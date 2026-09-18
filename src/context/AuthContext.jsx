// src/context/AuthContext.jsx
// Minimal authentication/session layer (Phase 5) built on the EXISTING
// FastAPI JWT mechanism (POST /api/v1/auth/login, /auth/register, /auth/me).
//
// - Token lives in sessionStorage via api.js (setAuthToken/clearAuthToken);
//   never hardcoded, cleared on logout, restored per tab session.
// - On mount, an existing token is validated against /auth/me (restores the
//   session or clears an expired one).
// - Any 401 from history/detail calls marks the session expired → logged out.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  setAuthToken,
  clearAuthToken,
  fetchMe,
  getPredictions,
  loginUser as loginUserSafe,
  registerUser as registerUserSafe,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // status: restoring | loggedOut | loggedIn
  const [status, setStatus] = useState('restoring');
  const [user, setUser] = useState(null);

  // Session restoration: validate any stored token before first paint settles.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (me && me.data) {
          setUser(me.data);
          setStatus('loggedIn');
          return;
        }
      } catch {
        // fall through to logged-out
      }
      clearAuthToken();
      if (!cancelled) setStatus('loggedOut');
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const tokens = await loginUserSafe(email, password);
    setAuthToken(tokens.access_token);

    const me = await fetchMe();
    if (!me || !me.data) {
      // Token issued but profile unavailable — treat as authed with minimal info.
      setUser({ email });
      setStatus('loggedIn');
      return;
    }
    setUser(me.data);
    setStatus('loggedIn');
  };

  const register = async (payload) => {
    await registerUserSafe(payload);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setStatus('loggedOut');
  };

  // Session-expiry signal: a 401 on any authenticated call means the JWT is
  // gone/expired → drop the local session.
  useEffect(() => {
    if (status !== 'loggedIn') return undefined;

    let cancelled = false;
    const check = async () => {
      const result = await getPredictions({ page: 1, pageSize: 1 });
      if (!cancelled && result === null) {
        // Network/401 — confirm with /auth/me before logging out.
        const me = await fetchMe();
        if (!cancelled && !me) {
          clearAuthToken();
          setUser(null);
          setStatus('loggedOut');
        }
      }
    };

    const interval = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  const value = useMemo(() => ({
    status,
    user,
    isLoggedIn: status === 'loggedIn',
    isRestoring: status === 'restoring',
    login,
    register,
    logout,
  }), [status, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
