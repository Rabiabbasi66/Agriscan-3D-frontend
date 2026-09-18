// src/components/AuthPanel.jsx
// Minimal authentication controls (Phase 5) — login / register / logout
// using the existing FastAPI JWT endpoints through the shared api.js client.
// Rendered inside the Prediction History section; the Navbar is untouched.
// Styled with the project's existing tokens only.
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const inputStyle = {
  background: '#122012',
  border: '1px solid #1c3a1c',
  color: '#e8f5e8',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
};

export default function AuthPanel() {
  const { user, isLoggedIn, isRestoring, login, register, logout } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, fullName, phone });
        // After successful registration, log straight in.
        await login(email, password);
      }
    } catch (err) {
      setError(err && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (isRestoring) {
    return (
      <p className="text-sm mb-4" style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace' }}>
        Restoring session…
      </p>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <span
          className="px-2 py-0.5 rounded text-[10px]"
          style={{
            border: '1px solid rgba(57,255,20,0.3)',
            color: '#39ff14',
            background: 'rgba(57,255,20,0.1)',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.08em',
          }}
        >
          {user && user.email ? user.email : 'SIGNED IN'}
        </span>
        <button
          type="button"
          onClick={logout}
          className="px-3 py-1.5 rounded text-xs font-600 transition-all duration-200"
          style={{ border: '1px solid rgba(255,48,48,0.3)', color: '#ff3030', letterSpacing: '0.06em' }}
        >
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="agri-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(''); }}
          className="px-3 py-1.5 rounded text-xs font-600"
          style={{
            border: '1px solid rgba(57,255,20,0.3)',
            color: mode === 'login' ? '#060d06' : '#39ff14',
            background: mode === 'login' ? '#39ff14' : 'transparent',
            letterSpacing: '0.06em',
          }}
        >
          LOGIN
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(''); }}
          className="px-3 py-1.5 rounded text-xs font-600"
          style={{
            border: '1px solid rgba(57,255,20,0.3)',
            color: mode === 'register' ? '#060d06' : '#39ff14',
            background: mode === 'register' ? '#39ff14' : 'transparent',
            letterSpacing: '0.06em',
          }}
        >
          REGISTER
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mode === 'register' && (
          <>
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              style={inputStyle}
            />
            <input
              type="tel"
              placeholder="Phone (optional, e.g. +1234567890)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={mode === 'register' ? 'Password (Aa1! — 8+ chars)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          style={inputStyle}
        />
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: '#ff9020' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 px-4 py-2 rounded font-display font-700 tracking-widest text-xs"
        style={{
          background: '#39ff14',
          color: '#060d06',
          letterSpacing: '0.1em',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'PLEASE WAIT…' : mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}
      </button>

      <p className="text-xs mt-2" style={{ color: '#6b9b6b' }}>
        Sign in so your scans are saved to your prediction history.
      </p>
    </form>
  );
}
