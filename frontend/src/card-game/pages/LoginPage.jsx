import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, register } from '../services/cardGameApi';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [fields, setFields] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field) {
    return e => setFields(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(fields.email, fields.password);
        navigate('/card-game/collection');
      } else {
        if (!fields.username.trim()) { setError('Username is required'); setLoading(false); return; }
        const data = await register(fields.username, fields.email, fields.password);
        navigate('/card-game/welcome', { state: { starterCards: data.starterCards } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.logo}>Kpopdle Cards</h1>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.active : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >
            Login
          </button>
          <button
            className={`${styles.tab} ${tab === 'register' ? styles.active : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >
            Register
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {tab === 'register' && (
            <label className={styles.field}>
              <span>Username</span>
              <input
                type="text"
                value={fields.username}
                onChange={update('username')}
                autoComplete="username"
                required
              />
            </label>
          )}
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={fields.email}
              onChange={update('email')}
              autoComplete="email"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              value={fields.password}
              onChange={update('password')}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Please wait...' : tab === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <p className={styles.back}>
          <Link to="/">Back to Kpopdle</Link>
        </p>
      </div>
    </div>
  );
}
