// Session layer over the FastAPI JWT endpoints (login/register/me).
// The token lives in sessionStorage via api.js and is revalidated on mount;
// a failed revalidation logs the session out.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  setAuthToken,
  clearAuthToken,
  fetchMe,
  getPredictions,
  hasAuthToken,
  loginUser as loginRequest,
  registerUser as registerRequest,
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
      // No stored token: skip the /auth/me round trip on anonymous page loads.
      if (!hasAuthToken()) {
        setStatus('loggedOut');
        return;
      }

      const me = await fetchMe();
      if (cancelled) return;
      if (me && me.data) {
        setUser(me.data);
        setStatus('loggedIn');
        return;
      }
      clearAuthToken();
      setStatus('loggedOut');
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const tokens = await loginRequest({ email, password });
    setAuthToken(tokens.access_token);

    const me = await fetchMe();
    if (!me || !me.data) {
      // Token issued but the profile call failed: keep the session with what
      // we know rather than bouncing the user back to the login form.
      setUser({ email });
      setStatus('loggedIn');
      return;
    }
    setUser(me.data);
    setStatus('loggedIn');
  };

  const register = async (payload) => {
    await registerRequest(payload);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setStatus('loggedOut');
  };

  // Poll a cheap authenticated call; a null result plus a failed /auth/me
  // means the token is gone or expired, so drop the local session.
  useEffect(() => {
    if (status !== 'loggedIn') return undefined;

    let cancelled = false;
    const check = async () => {
      const result = await getPredictions({ page: 1, pageSize: 1 });
      if (!cancelled && result === null) {
        // Network/401 — confirm before logging out.
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
