import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import './auth.css';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-nav">
        <Link to="/">PEOPLEPAY360</Link>
        <span>Secure workspace</span>
      </header>

      <div className="auth-layout">
        <section className="auth-intro">
          <p className="auth-eyebrow">Your work, in one place</p>
          <h1>Sign in and pick up where your work left off.</h1>
          <p>Access is tailored to your role, so you see only the people, payroll, and tasks that matter to you.</p>
          <div className="auth-benefits">
            <span>People</span><span>Payroll</span><span>Time off</span>
          </div>
        </section>

        <section className="auth-card">
          <p className="auth-eyebrow">Sign in</p>
          <h2>Welcome back.</h2>
          <p className="auth-card__subtitle">Use your work account to enter your workspace.</p>

          <form onSubmit={handleSubmit}>
            <label>Work email</label>
            <input type="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />

            <label>Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />

            {error && <p className="auth-card__error">{error}</p>}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Continue to workspace -&gt;'}
            </button>
          </form>
          <p className="auth-card__note">Accounts and permissions are managed by your administrator.</p>
        </section>
      </div>
    </main>
  );
}
