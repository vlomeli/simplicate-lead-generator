import { useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from './supabase.js';

const csvHeaders = ['place_id', 'business_name', 'address', 'phone', 'website', 'rating', 'review_count', 'category', 'recipient', 'email_status'];

// Render's free backend may need time to wake. Retry dashboard reads only;
// never retry a request that starts a list or contacts Google Places.
async function readDashboardData(url, accessToken) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 2_000 * (attempt + 1)));
      continue;
    }
    if (response.status >= 500 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 2_000 * (attempt + 1)));
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load dashboard data.');
    return data;
  }
}

export default function App() {
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [notice, setNotice] = useState('');
  const [passwordAction, setPasswordAction] = useState(() => getPasswordActionFromUrl());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordAction('recovery');
      if (event === 'SIGNED_IN' && getPasswordActionFromUrl() === 'invite') setPasswordAction('invite');
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
          <button className="help-button" onClick={() => setShowHelp(true)} aria-label="How Simplicate Leads works">?</button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme">
            {theme === 'light' ? '◐ Dark' : '◑ Light'}
          </button>
          {session && <button className="quiet-button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      {!isSupabaseConfigured ? <SetupNotice /> : passwordAction && session
        ? <SetPassword action={passwordAction} onComplete={() => { clearAuthLinkFromUrl(); setPasswordAction(null); setNotice('Your password has been updated.'); }} />
        : session ? <Dashboard session={session} /> : <AuthCard setNotice={setNotice} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function SetPassword({ action, onComplete }) {
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

  const isInvite = action === 'invite';
  return <section className="auth-layout"><div className="intro"><p className="eyebrow">{isInvite ? 'You are invited' : 'Account recovery'}</p><h1>Choose a new password.</h1><p>{isInvite ? 'Set a password to finish joining Simplicate Leads.' : 'Your reset link has securely signed you in just long enough to set a new password.'}</p></div><form className="card auth-card" onSubmit={submit}><p className="eyebrow">One last step</p><h2>Set your password</h2><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength="8" autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength="8" autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : isInvite ? 'Set password and continue' : 'Save password'}</button></form></section>;
}

function getPasswordActionFromUrl() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = search.get('type') || hash.get('type');
  return type === 'invite' || type === 'recovery' ? type : null;
}

function clearAuthLinkFromUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function HelpModal({ onClose }) {
  return <div className="confirmation-backdrop" role="presentation"><section className="help-modal card" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="help-heading"><div><p className="eyebrow">Quick guide</p><h2 id="help-title">How Simplicate Leads works</h2></div><button type="button" className="help-close" onClick={onClose} aria-label="Close help">×</button></div><ol className="help-steps"><li><strong>Sign in securely.</strong> Invited users choose a password from their email link. Existing users can use <em>Forgot password?</em> from the sign-in screen.</li><li><strong>Choose a business type and starting city.</strong> Set a target of up to 50 businesses, then review the confirmation before the search begins.</li><li><strong>Search fresh city areas.</strong> Live lists sample new small areas near the starting city on repeated searches. If the city samples are sparse and regional fallback is enabled, the app may try the state. Each list uses at most six Google Places requests; Google may still return fewer than 50 new businesses.</li><li><strong>Check public websites.</strong> The app looks for visibly published email addresses on up to three likely pages per business. It does not guess addresses, bypass blocked sites, or render JavaScript-only pages.</li><li><strong>Export what you need.</strong> The full CSV includes every business checked. The outreach CSV includes only businesses with a public email. Lists remain available for seven days.</li></ol><p className="confirmation-note">The coverage diagram shows sampled areas, not complete city coverage. Fixture mode makes no Google requests.</p><div className="confirmation-actions"><button type="button" className="primary" onClick={onClose}>Got it</button></div></section></div>;
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

  return <section className="auth-layout"><div className="intro"><p className="eyebrow">Private lead discovery</p><h1>Find the next business worth helping.</h1><p>Review a focused batch of leads, export it, and keep every search deliberate.</p></div><form className="card auth-card" onSubmit={submit}><p className="eyebrow">{mode === 'sign-in' ? 'Welcome back' : 'Password reset'}</p><h2>{mode === 'sign-in' ? 'Sign in' : 'Reset your password'}</h2><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></label>{mode === 'sign-in' && <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>}{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Send reset email'}</button><button type="button" className="text-button" onClick={() => setMode(mode === 'sign-in' ? 'reset' : 'sign-in')}>{mode === 'sign-in' ? 'Forgot password?' : 'Back to sign in'}</button></form></section>;
}

function Dashboard({ session }) {
  const [form, setForm] = useState({ query: 'auto repair', location: 'Modesto, CA', targetCount: 50, includeNearby: true });
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState('');
  const [usageLoading, setUsageLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentJobsError, setRecentJobsError] = useState('');
  const [recentJobsLoading, setRecentJobsLoading] = useState(true);
  const [pendingSearch, setPendingSearch] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [coverageError, setCoverageError] = useState('');
  const [cityMarkets, setCityMarkets] = useState([]);
  const [citiesError, setCitiesError] = useState('');
  const [citiesLoading, setCitiesLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const loadUsage = async () => {
    setUsageLoading(true);
    setUsageError('');
    setUsage(null);
    try {
      const data = await readDashboardData(`${apiUrl}/api/leads/usage`, session.access_token);
      setUsage(data);
    } catch (usageRequestError) {
      setUsage(null);
      setUsageError(usageRequestError.message);
    } finally { setUsageLoading(false); }
  };

  useEffect(() => {
    loadUsage();
  }, [session.access_token]);

  const loadCoverage = async (query, location) => {
    const params = new URLSearchParams({ query, location });
    const data = await readDashboardData(`${apiUrl}/api/outreach/coverage?${params}`, session.access_token);
    setCoverage(data); setCoverageError('');
  };

  const retryCoverage = () => loadCoverage(form.query, form.location)
    .catch(requestError => setCoverageError(requestError.message));

  const loadSearchedCities = async () => {
    setCitiesLoading(true);
    try {
      const data = await readDashboardData(`${apiUrl}/api/outreach/coverage/cities`, session.access_token);
      setCityMarkets(data); setCitiesError('');
    } catch (requestError) { setCitiesError(requestError.message); }
    finally { setCitiesLoading(false); }
  };

  useEffect(() => { loadSearchedCities(); }, [session.access_token]);

  useEffect(() => {
    setCoverage(null);
    if (!form.query.trim() || !form.location.trim()) return undefined;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ query: form.query, location: form.location });
        const data = await readDashboardData(`${apiUrl}/api/outreach/coverage?${params}`, session.access_token);
        if (!cancelled) { setCoverage(data); setCoverageError(''); }
      } catch (requestError) { if (!cancelled) setCoverageError(requestError.message); }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [form.query, form.location, session.access_token]);

  const loadRecentJobs = async () => {
    setRecentJobsLoading(true);
    try {
      const data = await readDashboardData(`${apiUrl}/api/outreach/jobs`, session.access_token);
      setRecentJobs(data); setRecentJobsError('');
    } catch (requestError) { setRecentJobsError(requestError.message); }
    finally { setRecentJobsLoading(false); }
  };

  const loadJob = async jobId => {
    const response = await fetch(`${apiUrl}/api/outreach/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load outreach-list progress.');
    setJob(data);
    if (data.status === 'completed') await Promise.all([
      loadUsage(), loadRecentJobs(), loadCoverage(data.query, data.location), loadSearchedCities(),
    ]);
  };

  useEffect(() => { loadRecentJobs(); }, [session.access_token]);

  useEffect(() => {
    if (!job?.id || ['completed', 'failed', 'stopped'].includes(job.status)) return undefined;
    const interval = window.setInterval(() => loadJob(job.id).catch(jobError => setError(jobError.message)), 1_500);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status]);

  const requestSearchConfirmation = event => {
    event.preventDefault();
    if (!usage || usageLoading) return;
    setError('');
    setPendingSearch({ ...form, targetCount: Number(form.targetCount) });
  };

  const buildList = async search => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/outreach/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(search),
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

  const fixtureMode = usage?.fixtureMode;
  const modeLabel = !usage ? (usageError ? 'Connection unavailable' : 'Connecting to backend…')
    : fixtureMode ? 'Google disabled' : 'Live Google mode';
  return <section className="dashboard">
    <div className="page-heading"><div><p className="eyebrow">Lead workspace</p><h1>Build an outreach list.</h1><p>Signed in as {session.user.email}</p></div><div className="heading-actions"><div className={`mode-pill ${usage && !fixtureMode ? 'live' : ''}`}><span /> {modeLabel}</div></div></div>
    <UsageCard usage={usage} error={usageError} loading={usageLoading} onRetry={loadUsage} />
    <form className="search-card card" onSubmit={requestSearchConfirmation}>
      <label>Business type<input value={form.query} onChange={event => setForm({ ...form, query: event.target.value })} required /></label>
      <label>Starting location<input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} required /></label>
      <label className="target-field">Target businesses<input type="number" min="1" max="50" value={form.targetCount} onChange={event => setForm({ ...form, targetCount: event.target.value })} required /><small className="field-hint">Up to 50. Google may return fewer results.</small></label>
      <label className="nearby-option"><input type="checkbox" checked={form.includeNearby} onChange={event => setForm({ ...form, includeNearby: event.target.checked })} />Expand to region</label>
      <button className="primary" disabled={!usage || usageLoading || busy || ['queued', 'running'].includes(job?.status)}>{busy ? 'Starting…' : 'Build list'}</button>
    </form>
    <CityHistoryMap markets={cityMarkets} error={citiesError} loading={citiesLoading} onRetry={loadSearchedCities} onChoose={market =>
      setForm(current => ({ ...current, query: market.query, location: formatCityName(market.location) }))} />
    <CoverageMap coverage={coverage} error={coverageError} onRetry={retryCoverage} query={form.query} location={form.location} />
    {error && <p className="form-error large-error">{error}</p>}
    {pendingSearch && usage && !usageLoading && <SearchConfirmation search={pendingSearch} fixtureMode={fixtureMode} onCancel={() => setPendingSearch(null)} onConfirm={() => { const search = pendingSearch; setPendingSearch(null); buildList(search); }} />}
    {job && <OutreachJob job={job} onDownload={downloadCsv} />}
    {recentJobsLoading && <p className="dashboard-loading">Loading recent lists…</p>}
    {recentJobsError && <p className="form-error large-error">Recent lists: {recentJobsError} <button type="button" className="quiet-button" onClick={loadRecentJobs}>Retry</button></p>}
    <RecentOutreachJobs jobs={recentJobs} onOpen={jobToOpen => {
      setForm(current => ({ ...current, query: jobToOpen.query, location: jobToOpen.location }));
      loadJob(jobToOpen.id).catch(openError => setError(openError.message));
    }} />
  </section>;
}

function SearchConfirmation({ search, fixtureMode, onCancel, onConfirm }) {
  const maximumRequests = 6;
  return <div className="confirmation-backdrop" role="presentation"><section className="confirmation card" role="dialog" aria-modal="true" aria-labelledby="confirm-search-title"><p className="eyebrow">Confirm search</p><h2 id="confirm-search-title">Start this list?</h2><dl><div><dt>Business type</dt><dd>{search.query}</dd></div><div><dt>Starting location</dt><dd>{search.location}</dd></div><div><dt>Target</dt><dd>{search.targetCount} businesses</dd></div>{search.includeNearby && <div><dt>Regional fallback</dt><dd>Search the surrounding state if needed</dd></div>}</dl><p className="confirmation-note">{fixtureMode ? 'Fixture mode is active. This search will not contact Google.' : `This search can use up to ${maximumRequests} Google Places requests.`}</p><div className="confirmation-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button type="button" className="primary" onClick={onConfirm}>Confirm search</button></div></section></div>;
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
    ? `${job.primaryBusinessesFound} found in ${job.location}; ${job.nearbyBusinessesFound} added from the regional fallback.`
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
    {job.status === 'completed' && <p className="job-note">Results expire after seven days. The outreach CSV contains only publicly listed emails; full results includes every checked business. A target of 50 is not guaranteed.</p>}
    {job.results.length > 0 && <div className="table-wrap"><table><thead><tr><th>Business</th><th>Email status</th><th>Reviews</th><th>Contact</th></tr></thead><tbody>{job.results.map(result => <tr key={result.placeId}><td><strong>{result.name}</strong><small>{result.address || 'No address listed'}</small></td><td><span className="tag">{result.emailStatus.replaceAll('_', ' ')}</span></td><td>{result.reviews ?? '—'}</td><td>{result.email || result.phone || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}

function ProgressStat({ label, value, target }) { return <div className="usage-stat"><span>{label}</span><strong>{value}{target ? <small> / {target}</small> : null}</strong></div>; }

function formatListDate(value) { return value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date'; }

function UsageCard({ usage, error, loading, onRetry }) {
  if (error) return <div className="usage-card card"><div><p className="eyebrow">Usage protection</p><h2>Connection unavailable</h2><p>Could not confirm Google mode or remaining allowance. {error}</p></div><button type="button" className="quiet-button" onClick={onRetry} disabled={loading}>Retry</button></div>;
  if (!usage || loading) return <div className="usage-card card"><p className="eyebrow">Usage protection</p><p>Connecting to backend… This may take a moment after inactivity.</p></div>;
  const fixtureMode = usage.fixtureMode;
  return <section className="usage-card card"><div><p className="eyebrow">Usage protection</p><h2>{fixtureMode ? 'Google is disabled' : 'Live Google Places is active'}</h2><p>{fixtureMode ? 'Fixture searches do not consume provider allowance.' : 'Each Google Places request reserves allowance before the call.'}</p></div><div className="usage-stats"><UsageStat label="Today" value={usage.daily.used} limit={usage.daily.limit} /><UsageStat label="This month" value={usage.monthly.used} limit={usage.monthly.limit} /></div></section>;
}

function UsageStat({ label, value, limit }) { return <div className="usage-stat"><span>{label}</span><strong>{value} <small>/ {limit}</small></strong><em>{limit - value} remaining</em></div>; }

// A small offline reference outline of the contiguous US. No map tiles,
// geocoding service, or browser-side API key is needed for these markers.
const usOutline = [
  [-124.7, 48.5], [-117, 49], [-108, 49], [-98, 49], [-95, 49],
  [-90, 47], [-86, 46], [-83, 42], [-79, 43], [-73, 45], [-71, 45],
  [-67, 47], [-70, 43], [-72, 41], [-74, 40], [-75, 37], [-78, 34],
  [-81, 29], [-80, 25], [-82, 25], [-85, 30], [-89, 30], [-93, 29],
  [-97, 26], [-100, 29], [-104, 29], [-106, 31], [-111, 31],
  [-114, 32], [-117, 32], [-120, 37], [-123, 42],
];

function mapPosition(latitude, longitude) {
  return { x: (longitude + 125) / 59 * 100, y: (50 - latitude) / 26 * 100 };
}

function formatCityName(value) {
  return value.split(',').map((part, index) => {
    const cleaned = part.trim();
    if (index > 0 && cleaned.length === 2) return cleaned.toUpperCase();
    return cleaned.replace(/\b\p{L}/gu, letter => letter.toUpperCase());
  }).join(', ');
}

function CityHistoryMap({ markets, error, loading, onRetry, onChoose }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const citiesByLocation = new Map();
  for (const market of markets) {
    const city = citiesByLocation.get(market.location) ?? {
      location: market.location, latitude: market.latitude, longitude: market.longitude, searches: [],
    };
    city.searches.push(market);
    citiesByLocation.set(market.location, city);
  }
  const cities = [...citiesByLocation.values()].sort((a, b) => a.location.localeCompare(b.location));
  const selected = cities.find(city => city.location === selectedLocation) ?? cities[0];
  const outlinePoints = usOutline.map(([longitude, latitude]) => {
    const point = mapPosition(latitude, longitude);
    return `${point.x},${point.y}`;
  }).join(' ');
  return <section className="city-history card" aria-label="Cities searched">
    <div className="city-history-heading"><div><p className="eyebrow">Search history map</p><h2>Cities searched</h2><p>Red dots mark starting cities tracked for this workspace since coverage was enabled. Choose a city to view the business types searched there.</p></div><strong>{loading ? 'Loading…' : `${cities.length} ${cities.length === 1 ? 'city' : 'cities'}`}</strong></div>
    {loading && <p className="dashboard-loading">Loading searched cities…</p>}
    {error && <p className="form-error">{error} <button type="button" className="quiet-button" onClick={onRetry} disabled={loading}>Retry</button></p>}
    <div className="city-history-body"><div className="city-map-plot" role="group" aria-label="Searched cities on a map of the contiguous United States">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={outlinePoints} /></svg>
      {cities.filter(city => city.latitude >= 24 && city.latitude <= 50 && city.longitude >= -125 && city.longitude <= -66).map(city => {
        const point = mapPosition(city.latitude, city.longitude);
        return <button type="button" key={city.location} className={`city-map-dot ${selected?.location === city.location ? 'selected' : ''}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => setSelectedLocation(city.location)}
          aria-label={`${formatCityName(city.location)}: ${city.searches.length} business types`} />;
      })}
      {!cities.length && !loading && !error && <span className="city-map-empty">Live searches will appear here</span>}
    </div><div className="city-history-detail">
      {selected ? <><h3>{formatCityName(selected.location)}</h3><p>{selected.searches.length} {selected.searches.length === 1 ? 'business type' : 'business types'} tracked</p>
        <div className="city-searches">{selected.searches.map(market => <button type="button" key={market.query} onClick={() => onChoose(market)}>
          <strong>{market.query}</strong><span>View sampled areas</span>
        </button>)}</div></> : !loading && !error ? <p>No cities tracked yet. Fixture lists and older searches without saved coordinates do not create dots.</p> : null}
      {cities.length > 1 && <div className="city-list" aria-label="All tracked cities">{cities.map(city =>
        <button type="button" key={city.location} className={selected?.location === city.location ? 'selected' : ''}
          onClick={() => setSelectedLocation(city.location)}>{formatCityName(city.location)}</button>)}</div>}
    </div></div>
    <p className="city-map-note">Approximate lower-48 outline. Other locations remain listed when tracked, but are not plotted here.</p>
  </section>;
}

function CoverageMap({ coverage, error, onRetry, query, location }) {
  const [selected, setSelected] = useState(null);
  const areas = coverage?.areas ?? [];
  const center = coverage?.center;
  const displayed = areas.find(area => area.index === selected) ?? areas.at(-1);
  const totals = areas.reduce((sum, area) => ({
    duplicates: sum.duplicates + area.duplicates,
    newBusinesses: sum.newBusinesses + area.newBusinesses,
  }), { duplicates: 0, newBusinesses: 0 });
  return <section className="coverage-card card" aria-label="Search coverage">
    <div className="coverage-copy"><p className="eyebrow">Area samples for selected search</p><h2>{query || 'Business type'} near {location || 'starting city'}</h2><p>These dots show small areas sampled for this business type and starting city. Counts are across all lists for this search. The initial broad city lookup is not plotted; the latest list’s full total is shown below.</p>
      <div className="coverage-totals"><span>{areas.length} areas sampled</span><span>{totals.newBusinesses} saved from mapped areas</span><span>{totals.duplicates} already collected in mapped areas</span></div>
      {error && <p className="form-error">{error} <button type="button" className="quiet-button" onClick={onRetry}>Retry</button></p>}
      {displayed && <div className="coverage-detail"><strong>Area {displayed.index + 1}</strong><span>Sampled {formatListDate(displayed.searchedAt)}</span><span>{displayed.returned} Google candidates · {displayed.duplicates} already collected · {displayed.newBusinesses} saved</span></div>}
    </div>
    <div className="coverage-plot" role="group" aria-label="Sampled areas around the starting city">
      <span className="coverage-north">N</span><span className="coverage-city">Starting city</span>
      {center && areas.map(area => {
        const x = 50 + ((area.longitude - center.longitude) * Math.cos(center.latitude * Math.PI / 180) * 111.32 / 5) * 3.5;
        const y = 50 - ((area.latitude - center.latitude) * 111.32 / 5) * 3.5;
        return <button key={area.index} type="button" className={`coverage-dot ${selected === area.index ? 'selected' : ''}`}
          style={{ left: `${Math.max(4, Math.min(96, x))}%`, top: `${Math.max(4, Math.min(96, y))}%` }}
          onClick={() => setSelected(area.index)} aria-label={`Area ${area.index + 1}: ${area.newBusinesses} new businesses`} />;
      })}
      {!areas.length && <span className="coverage-empty">No live areas sampled yet</span>}
    </div>
  </section>;
}

function LeadResults({ result }) {
  const download = () => {
    const rows = result.leads.map(lead => [lead.placeId, lead.name, lead.address, lead.phone, lead.website, lead.rating, lead.reviewCount, lead.category, lead.recipientEmail, lead.emailStatus]);
    const csv = [csvHeaders, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = result.export.filename; link.click(); URL.revokeObjectURL(link.href);
  };
  return <section className="results"><div className="results-heading"><div><p className="eyebrow">Search complete</p><h2>{result.leads.length} new lead{result.leads.length === 1 ? '' : 's'}</h2></div><button className="quiet-button" onClick={download}>Download CSV</button></div>{result.leads.length === 0 ? <div className="empty card">No new leads in this result set. Previously collected businesses are automatically skipped.</div> : <div className="table-wrap card"><table><thead><tr><th>Business</th><th>Rating</th><th>Reviews</th><th>Category</th><th>Contact</th></tr></thead><tbody>{result.leads.map(lead => <tr key={lead.placeId}><td><strong>{lead.name}</strong><small>{lead.address || 'No address listed'}</small></td><td>{lead.rating ?? '—'}</td><td>{lead.reviewCount ?? '—'}</td><td><span className="tag">{lead.category || 'Uncategorized'}</span></td><td>{lead.phone || '—'}</td></tr>)}</tbody></table></div>}</section>;
}
