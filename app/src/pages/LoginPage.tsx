import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ENABLED } from '../lib/auth';
import './LoginPage.css';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const { signInWithPassword, signUpWithPassword, resetPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!identifier.trim() || !password) { setError('Enter your email/phone and password.'); return; }
    if (mode === 'signup' && (!name.trim() || !shopName.trim())) { setError('Please fill in your name and shop name.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('Use a password of at least 6 characters.'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithPassword({ identifier: identifier.trim(), password, name: name.trim(), shopName: shopName.trim() });
        setInfo('Account created! If asked, confirm your email/phone, then sign in.');
        setMode('signin');
      } else {
        await signInWithPassword(identifier.trim(), password);
        // On success the auth listener flips status → the app renders Home.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    setError(''); setInfo('');
    try {
      await resetPassword(identifier);
      setInfo('If that email exists, a reset link is on its way.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset link.');
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__wordmark">INT<span className="login__dot">.</span></div>
          <h1 className="login__title">{mode === 'signup' ? 'Create your shop' : 'Welcome back'}</h1>
          <p className="login__subtitle">{mode === 'signup' ? 'Set up INT for your business in a minute' : 'Sign in to run your business'}</p>
        </div>

        {error && <div className="login__error">{error}</div>}
        {info && <div className="login__info">{info}</div>}

        <form className="login__form" onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label className="login__label">Your name
                <input className="login__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Owusu" autoComplete="name" />
              </label>
              <label className="login__label">Shop name
                <input className="login__input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Ama's Provisions" />
              </label>
            </>
          )}
          <label className="login__label">Email or phone number
            <input className="login__input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@email.com or 024 000 0000" autoComplete="username" />
          </label>
          <label className="login__label">Password
            <input className="login__input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>

          <button className="login__button login__button--primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {mode === 'signin' && (
          <button className="login__link" type="button" onClick={forgot}>Forgot password?</button>
        )}

        <div className="login__divider"><span>or</span></div>
        <button className="login__button login__button--google" type="button" onClick={() => signInWithGoogle().catch((e) => setError(e.message))} disabled={loading}>
          <span className="login__google-icon" aria-hidden="true" /> Continue with Google
        </button>

        <p className="login__switch">
          {mode === 'signup' ? 'Already have an account?' : 'New to INT?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo(''); }}>
            {mode === 'signup' ? 'Sign in' : 'Create your shop'}
          </button>
        </p>

        {!AUTH_ENABLED && (
          <p className="login__note">Demo mode is on — you can also just open the app without signing in.</p>
        )}
      </div>
    </div>
  );
}
