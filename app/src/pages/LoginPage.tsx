import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import NeuralBackground from '../components/NeuralBackground';
import './LoginPage.css';

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // On success Supabase redirects the browser to Google; this
      // component unmounts before anything else needs to happen here.
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <NeuralBackground />
      <div className="login__card">
        <div className="login__brand">
          <div className="login__logo">I</div>
          <h1 className="login__title">INT AI</h1>
          <p className="login__subtitle">Sign in to your workspace</p>
        </div>
        {error && <div className="login__error">{error}</div>}
        <button
          className="login__button login__button--google"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <span className="login__google-icon" aria-hidden="true" />
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}
