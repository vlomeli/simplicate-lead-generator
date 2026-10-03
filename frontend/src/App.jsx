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
  const [form, setForm] = useState({ query: 'auto repair', location: 'Modesto, CA', targetCount: 50, includeNearby: true });
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [recentJobs, setRecentJobs] = useState([]);

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

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const loadRecentJobs = async () => {
    const response = await fetch(`${apiUrl}/api/outreach/jobs`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load recent outreach lists.');
    setRecentJobs(data);
  };

  const loadJob = async jobId => {
    const response = await fetch(`${apiUrl}/api/outreach/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load outreach-list progress.');
    setJob(data);
    if (data.status === 'completed') await Promise.all([loadUsage(), loadRecentJobs()]);
  };

  useEffect(() => {
    loadRecentJobs().catch(recentJobsError => setError(recentJobsError.message));
  }, [session.access_token]);

  useEffect(() => {
    if (!job?.id || ['completed', 'failed', 'stopped'].includes(job.status)) return undefined;
    const interval = window.setInterval(() => loadJob(job.id).catch(jobError => setError(jobError.message)), 1_500);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status]);

  const buildList = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/outreach/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, targetCount: Number(form.targetCount) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The outreach list could not be started.');
      setJob(data);
      await loadRecentJobs();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const downloadCsv = async type => {
    try {
      const response = await fetch(`${apiUrl}/api/outreach/jobs/${job.id}/export?type=${type}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to download the CSV.');
      }
      const blob = await response.blob();
      const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1]
        || `${type}-list.csv`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (downloadError) { setError(downloadError.message); }
  };

  const fixtureMode = usage?.fixtureMode ?? true;
  return <section className="dashboard"><div className="page-heading"><div><p className="eyebrow">Lead workspace</p><h1>Build an outreach list.</h1><p>Signed in as {session.user.email}</p></div><div className="heading-actions"><div className={`mode-pill ${fixtureMode ? '' : 'live'}`}><span /> {fixtureMode ? 'Fixture mode' : 'Live Google mode'}</div><button className="text-button" onClick={() => setShowPasswordForm(!showPasswordForm)}>Set password</button></div></div>{showPasswordForm && <AccountPassword onComplete={() => { setShowPasswordForm(false); setNotice('Your password has been updated.'); }} />}<UsageCard usage={usage} error={usageError} /><form className="search-card card" onSubmit={buildList}><label>Business type<input value={form.query} onChange={event => setForm({ ...form, query: event.target.value })} required /></label><label>Starting location<input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} required /></label><label>Target businesses<input type="number" min="1" max="50" value={form.targetCount} onChange={event => setForm({ ...form, targetCount: event.target.value })} required /></label><label className="nearby-option"><input type="checkbox" checked={form.includeNearby} onChange={event => setForm({ ...form, includeNearby: event.target.checked })} />Include nearby areas if needed</label><button className="primary" disabled={busy || ['queued', 'running'].includes(job?.status)}>{busy ? 'Starting…' : 'Build list'}</button></form>{error && <p className="form-error large-error">{error}</p>}{job && <OutreachJob job={job} onDownload={downloadCsv} />}<RecentOutreachJobs jobs={recentJobs} onOpen={jobToOpen => loadJob(jobToOpen.id).catch(openError => setError(openError.message))} /></section>;
}

function RecentOutreachJobs({ jobs, onOpen }) {
  if (!jobs.length) return null;
  return <section className="recent-jobs"><p className="eyebrow">Recent lists</p><h2>Available for seven days</h2><div className="recent-job-list">{jobs.map(job => {
    const limitReached = job.failureCode === 'google_places_daily_limit_reached' || job.failureCode === 'google_places_monthly_limit_reached';
    return <button className="recent-job" key={job.id} onClick={() => onOpen(job)}><span><strong>{job.query}</strong><small>{job.location} · Created {formatListDate(job.createdAt)}</small></span><span><em>{limitReached ? 'Provider limit reached' : `${job.emailsFound} email${job.emailsFound === 1 ? '' : 's'}`}</em><small>{limitReached ? 'no request made' : job.status}</small></span></button>;
  })}</div></section>;
}

function OutreachJob({ job, onDownload }) {
  const isWorking = ['queued', 'running'].includes(job.status);
  const dailyLimitReached = job.failureCode === 'google_places_daily_limit_reached';
  const monthlyLimitReached = job.failureCode === 'google_places_monthly_limit_reached';
  const limitMessage = dailyLimitReached
    ? 'Daily Google Places limit reached. Try again tomorrow.'
    : monthlyLimitReached
      ? 'Monthly Google Places limit reached. Try again next month.'
      : null;
  const nearbySummary = job.includeNearby && job.nearbyBusinessesFound > 0
    ? `${job.primaryBusinessesFound} found in ${job.location}; ${job.nearbyBusinessesFound} added from nearby areas.`
    : null;

  return <section className="outreach-job card">
    <div className="results-heading">
      <div>
        <p className="eyebrow">{isWorking ? 'List in progress' : `List ${job.status}`}</p>
        <h2>{limitMessage || `${job.emailsFound} public email${job.emailsFound === 1 ? '' : 's'} found`}</h2>
        <p className="job-created">Created {formatListDate(job.createdAt)}</p>
      </div>
      {job.status === 'completed' && <div className="export-actions"><button className="quiet-button" onClick={() => onDownload('outreach')}>Download outreach CSV</button><button className="quiet-button" onClick={() => onDownload('full')}>Download full results</button></div>}
    </div>
    {!limitMessage && <div className="progress-stats"><ProgressStat label="Businesses found" value={job.businessesFound} target={job.targetCount} /><ProgressStat label="Websites checked" value={job.websitesChecked} /><ProgressStat label="Public emails" value={job.emailsFound} /></div>}
    {nearbySummary && <p className="job-note">{nearbySummary}</p>}
    {isWorking && <p className="job-note">The list is being prepared. This page refreshes progress automatically.</p>}
    {limitMessage && <p className="form-error large-error">No Google request was made.</p>}
    {job.status === 'completed' && <p className="job-note">Results expire after seven days. The outreach CSV contains only publicly listed emails; full results includes every checked business.</p>}
    {job.results.length > 0 && <div className="table-wrap"><table><thead><tr><th>Business</th><th>Email status</th><th>Reviews</th><th>Contact</th></tr></thead><tbody>{job.results.map(result => <tr key={result.placeId}><td><strong>{result.name}</strong><small>{result.address || 'No address listed'}</small></td><td><span className="tag">{result.emailStatus.replaceAll('_', ' ')}</span></td><td>{result.reviews ?? '—'}</td><td>{result.email || result.phone || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}

function ProgressStat({ label, value, target }) { return <div className="usage-stat"><span>{label}</span><strong>{value}{target ? <small> / {target}</small> : null}</strong></div>; }

function formatListDate(value) { return value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date'; }

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
