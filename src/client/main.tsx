import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import './styles.css';
import { api, type Health } from './api';
import { Button, cx, Icon, Input, Spinner } from './components/ui';
import { Library } from './pages/Library';
import { Studio } from './pages/Studio';
import { Looks } from './pages/Looks';
import { LookBuilder } from './pages/LookBuilder';
import { SettingsPage } from './pages/Settings';

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex h-full items-center justify-center px-4">
      <form
        className="w-full max-w-sm space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api.login(password);
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <div className="font-display text-5xl leading-none">Vibe Edit</div>
          <p className="mt-2 text-sm text-muted">Your personal Claude video editor.</p>
        </div>
        <Input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="primary" className="w-full" disabled={busy || !password}>
          {busy ? <Spinner /> : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

function Sidebar({ passwordRequired }: { passwordRequired: boolean }) {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);
  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
      isActive ? 'bg-raised text-fg' : 'text-muted hover:text-fg hover:bg-raised/60',
    );
  const allOk = health && health.ffmpeg && health.claude.ok;
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#111"><path d="M7 4l13 8-13 8z" /></svg>
        </div>
        <span className="font-display text-2xl leading-none">Vibe Edit</span>
      </div>
      <nav className="space-y-0.5">
        <NavLink to="/" end className={link}><Icon name="library" /> Library</NavLink>
        <NavLink to="/looks" className={link}><Icon name="palette" /> Looks</NavLink>
        <NavLink to="/settings" className={link}><Icon name="settings" /> Settings</NavLink>
      </nav>
      <div className="mt-auto space-y-2 px-2 text-xs text-muted">
        {health && (
          <NavLink to="/settings" className="flex items-center gap-2 hover:text-fg">
            <span className={cx('h-2 w-2 rounded-full', allOk ? 'bg-ok' : 'bg-danger')} />
            {allOk ? 'Claude connected' : 'Setup needed'}
          </NavLink>
        )}
        {passwordRequired && (
          <button
            className="flex items-center gap-2 hover:text-fg"
            onClick={() => api.logout().then(() => window.location.reload())}
          >
            <Icon name="logout" className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileNav() {
  const link = ({ isActive }: { isActive: boolean }) => cx('flex-1 py-3 text-center text-xs', isActive ? 'text-fg' : 'text-muted');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel md:hidden">
      <NavLink to="/" end className={link}>Library</NavLink>
      <NavLink to="/looks" className={link}>Looks</NavLink>
      <NavLink to="/settings" className={link}>Settings</NavLink>
    </nav>
  );
}

function App() {
  const [auth, setAuth] = useState<{ authed: boolean; passwordRequired: boolean } | null>(null);
  const check = () => api.me().then(setAuth).catch(() => setAuth({ authed: false, passwordRequired: true }));
  useEffect(() => {
    check();
    const onUnauthorized = () => setAuth((a) => (a ? { ...a, authed: false } : a));
    window.addEventListener('vibe:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vibe:unauthorized', onUnauthorized);
  }, []);

  if (!auth) return <div className="flex h-full items-center justify-center text-muted"><Spinner /></div>;
  if (!auth.authed) return <Login onDone={check} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/p/:id" element={<Studio />} />
        <Route
          path="*"
          element={
            <div className="flex h-full">
              <Sidebar passwordRequired={auth.passwordRequired} />
              <main className="min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
                <Routes>
                  <Route path="/" element={<Library />} />
                  <Route path="/looks" element={<Looks />} />
                  <Route path="/looks/:id" element={<LookBuilder />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </main>
              <MobileNav />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
