import { useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from './supabase.js';

const csvHeaders = ['place_id', 'business_name', 'address', 'phone', 'website', 'rating', 'review_count', 'category', 'recipient', 'email_status'];

export default function App() {
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [notice, setNotice] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => (
    window.location.hash.includes('type=recovery')
    || new URLSearchParams(window.location.search).get('type') === 'recovery'
  ));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setNotice('You have been signed out.');
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">Simplicate <span>Leads</span></a>
        <div className="topbar-actions">
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme">
            {theme === 'light' ? '◐ Dark' : '◑ Light'}
          </button>
          {session && <button className="quiet-button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      {!isSupabaseConfigured ? <SetupNotice /> : isPasswordRecovery && session
        ? <SetPassword onComplete={() => { setIsPasswordRecovery(false); setNotice('Your password has been updated.'); }} />
        : session ? <Dashboard session={session} setNotice={setNotice} /> : <AuthCard setNotice={setNotice} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function SetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirmation) return setError('The passwords do not match.');
    setBusy(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onComplete();
  };

  return <section className="auth-layout"><div className="intro"><p className="eyebrow">Account recovery</p><h1>Choose a new password.</h1><p>Your reset link has securely signed you in just long enough to set a new password.</p></div><form className="card auth-card" onSubmit={submit}><p className="eyebrow">One last step</p><h2>Set your password</h2><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength="8" autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength="8" autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button></form></section>;
}

function SetupNotice() {
  return <section className="setup card"><p className="eyebrow">Configuration needed</p><h1>Connect your Supabase project.</h1><p>Copy <code>.env.example</code> to <code>.env</code> inside <code>frontend/</code>, then add the project URL and browser publishable key. Never use the service-role key in this app.</p></section>;
}

function AuthCard({ setNotice }) {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === 'reset') setNotice('If that address is approved, a password-reset email is on its way.');
  };

  return <section className="auth-layout"><div className="intro"><p className="eyebrow">Private lead discovery</p><h1>Find the next business worth helping.</h1><p>Review a focused batch of leads, export it, and keep every search deliberate.</p><div className="safety-note">Fixture mode is active. This dashboard does not call Google Places.</div></div><form className="card auth-card" onSubmit={submit}><p className="eyebrow">{mode === 'sign-in' ? 'Welcome back' : 'Password reset'}</p><h2>{mode === 'sign-in' ? 'Sign in' : 'Reset your password'}</h2><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></label>{mode === 'sign-in' && <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>}{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Send reset email'}</button><button type="button" className="text-button" onClick={() => setMode(mode === 'sign-in' ? 'reset' : 'sign-in')}>{mode === 'sign-in' ? 'Forgot password?' : 'Back to sign in'}</button></form></section>;
}

function Dashboard({ session, setNotice }) {
  const [form, setForm] = useState({ query: 'auto repair', location: 'Modesto, CA', maxResults: 10 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const loadUsage = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/leads/usage`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load usage.');
      setUsage(data);
    } catch (usageRequestError) { setUsageError(usageRequestError.message); }
  };

  useEffect(() => {
    loadUsage();
  }, [session.access_token]);

  const search = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/leads/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, maxResults: Number(form.maxResults) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The search could not be completed.');
      setResult(data);
      await loadUsage();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const fixtureMode = usage?.fixtureMode ?? true;
  const resultMaximum = fixtureMode ? 50 : 20;

  return <section className="dashboard"><div className="page-heading"><div><p className="eyebrow">Lead workspace</p><h1>Discover a focused batch.</h1><p>Signed in as {session.user.email}</p></div><div className="heading-actions"><div className={`mode-pill ${fixtureMode ? '' : 'live'}`}><span /> {fixtureMode ? 'Fixture mode' : 'Live Google mode'}</div><button className="text-button" onClick={() => setShowPasswordForm(!showPasswordForm)}>Set password</button></div></div>{showPasswordForm && <AccountPassword onComplete={() => { setShowPasswordForm(false); setNotice('Your password has been updated.'); }} />}<UsageCard usage={usage} error={usageError} /><form className="search-card card" onSubmit={search}><label>Business type<input value={form.query} onChange={event => setForm({ ...form, query: event.target.value })} required /></label><label>Location<input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} required /></label><label>Results<input type="number" min="1" max={resultMaximum} value={form.maxResults} onChange={event => setForm({ ...form, maxResults: event.target.value })} required /></label><button className="primary" disabled={busy}>{busy ? 'Searching…' : 'Find leads'}</button></form>{error && <p className="form-error large-error">{error}</p>}{result && <LeadResults result={result} />}</section>;
}

function UsageCard({ usage, error }) {
  if (error) return <p className="form-error large-error">Usage: {error}</p>;
  if (!usage) return <div className="usage-card card"><p className="eyebrow">Usage protection</p><p>Loading usage…</p></div>;
  const fixtureMode = usage.fixtureMode;
  return <section className="usage-card card"><div><p className="eyebrow">Usage protection</p><h2>{fixtureMode ? 'Google is disabled' : 'Live Google Places is active'}</h2><p>{fixtureMode ? 'Fixture searches do not consume provider allowance.' : 'Each live search reserves one request before Google is contacted.'}</p></div><div className="usage-stats"><UsageStat label="Today" value={usage.daily.used} limit={usage.daily.limit} /><UsageStat label="This month" value={usage.monthly.used} limit={usage.monthly.limit} /></div></section>;
}

function UsageStat({ label, value, limit }) { return <div className="usage-stat"><span>{label}</span><strong>{value} <small>/ {limit}</small></strong><em>{limit - value} remaining</em></div>; }

function AccountPassword({ onComplete }) { return <section className="account-password card"><div><p className="eyebrow">Account</p><h2>Set or update password</h2></div><SetPasswordForm onComplete={onComplete} compact /></section>; }

function SetPasswordForm({ onComplete, compact = false }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); if (password.length < 8) return setError('Use at least 8 characters.'); if (password !== confirmation) return setError('The passwords do not match.'); setBusy(true); setError(''); const { error: updateError } = await supabase.auth.updateUser({ password }); setBusy(false); if (updateError) return setError(updateError.message); onComplete(); };
  return <form className={compact ? 'password-form compact' : 'password-form'} onSubmit={submit}><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength="8" autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength="8" autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button></form>;
}

function LeadResults({ result }) {
  const download = () => {
    const rows = result.leads.map(lead => [lead.placeId, lead.name, lead.address, lead.phone, lead.website, lead.rating, lead.reviewCount, lead.category, lead.recipientEmail, lead.emailStatus]);
    const csv = [csvHeaders, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = result.export.filename; link.click(); URL.revokeObjectURL(link.href);
  };
  return <section className="results"><div className="results-heading"><div><p className="eyebrow">Search complete</p><h2>{result.leads.length} new lead{result.leads.length === 1 ? '' : 's'}</h2></div><button className="quiet-button" onClick={download}>Download CSV</button></div>{result.leads.length === 0 ? <div className="empty card">No new leads in this result set. Previously collected businesses are automatically skipped.</div> : <div className="table-wrap card"><table><thead><tr><th>Business</th><th>Rating</th><th>Reviews</th><th>Category</th><th>Contact</th></tr></thead><tbody>{result.leads.map(lead => <tr key={lead.placeId}><td><strong>{lead.name}</strong><small>{lead.address || 'No address listed'}</small></td><td>{lead.rating ?? '—'}</td><td>{lead.reviewCount ?? '—'}</td><td><span className="tag">{lead.category || 'Uncategorized'}</span></td><td>{lead.phone || '—'}</td></tr>)}</tbody></table></div>}</section>;
}
