import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authManager } from '../../lib/auth';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authManager.login(email, password);
      navigate('/current-task');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__logo">I</div>
          <h1 className="login__title">INT AI</h1>
          <p className="login__subtitle">Sign in to your workspace</p>
        </div>
        <form className="login__form" onSubmit={handleSubmit}>
          {error && <div className="login__error">{error}</div>}
          <div className="login__field">
            <label className="login__label" htmlFor="email">Email</label>
            <input
              id="email"
              className="login__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="login__field">
            <label className="login__label" htmlFor="password">Password</label>
            <input
              id="password"
              className="login__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button className="login__button" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
