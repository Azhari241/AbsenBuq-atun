// Halaman autentikasi: Masuk, Daftar, Lupa kata sandi, Atur kata sandi baru, Ganti server.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function pwPolicy(pw) {
  const errs = [];
  if (pw.length < 8) errs.push('minimal 8 karakter');
  if (!/[a-z]/.test(pw)) errs.push('huruf kecil');
  if (!/[A-Z]/.test(pw)) errs.push('huruf besar');
  if (!/\d/.test(pw)) errs.push('angka');
  return errs;
}
function PwInput({ value, onChange, placeholder, autoComplete, err, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="inwrap">
      <input id={id} className={'input ' + (err ? 'err' : '')} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} style={{ height: 44 }} />
      <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}><Icon n={show ? 'eyeOff' : 'eye'} s={17} /></button>
    </div>
  );
}
function PwStrength({ pw }) {
  if (!pw) return null;
  const miss = pwPolicy(pw);
  const score = 4 - miss.length;
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row" style={{ gap: 4 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < score ? (score >= 4 ? 'var(--teal)' : score >= 2 ? 'var(--izin)' : 'var(--danger)') : '#e6e8eb' }} />)}</div>
      {miss.length > 0 && <span className="tiny muted">Perlu: {miss.join(', ')}.</span>}
    </div>
  );
}

function AuthShell({ children, footer = true }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 452 }}>{children}</div>
      {footer && <p className="small muted" style={{ marginTop: 22, textAlign: 'center' }}>Semua alat administrasi guru dalam satu tempat.</p>}
    </div>
  );
}
function Brand() {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      <Logo s={42} />
      <div className="col" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 19, letterSpacing: '.02em' }}>ALAT GURU</h1>
        <p className="small muted tw-pretty" style={{ lineHeight: 1.35 }}>Pusat Administrasi dan Perangkat Pembelajaran Guru</p>
      </div>
    </div>
  );
}
// Ditampilkan bila Environment Variables belum diatur / database belum siap.
// Guru hanya melihat pesan singkat; detail teknis ada di panel "Untuk pengelola" yang bisa dibuka.
function ConfigErrorPage({ kind, detail, onDemo, onRetry }) {
  const [open, setOpen] = useState(false);
  const title = kind === 'schema' ? 'Database sedang disiapkan' : kind === 'network' ? 'Server tidak dapat dijangkau' : 'Aplikasi belum siap digunakan';
  const msg = kind === 'network' ? 'Periksa koneksi internet Anda lalu coba lagi.' : 'Pengelola aplikasi sedang menyelesaikan konfigurasi. Silakan coba beberapa saat lagi atau hubungi pengelola sekolah Anda.';
  return (
    <AuthShell>
      <div className="card" style={{ padding: '28px 26px', borderRadius: 16 }}>
        <Brand />
        <div className="col" style={{ gap: 10, marginTop: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f2f4', display: 'grid', placeItems: 'center' }}><Icon n={kind === 'network' ? 'wifiOff' : 'server'} s={20} /></div>
          <h3 style={{ fontSize: 17 }}>{title}</h3>
          <p className="muted tw-pretty" style={{ lineHeight: 1.55 }}>{msg}</p>
          <button className="btn btn-dark btn-block btn-lg" onClick={onRetry}><Icon n="refresh" s={15} />Coba lagi</button>
        </div>
        {kind !== 'network' && <div style={{ marginTop: 18, borderTop: '1px solid var(--line2)', paddingTop: 12 }}>
          <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Sembunyikan' : 'Untuk pengelola aplikasi'}</button>
          {open && <div className="col small" style={{ gap: 8, marginTop: 10, lineHeight: 1.55, color: 'var(--ink2)' }}>
            {kind === 'env' ? <>
              <p>Environment Variables Supabase belum diatur atau tidak valid{detail ? ': ' + detail : '.'}</p>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Vercel → Project → Settings → Environment Variables.</li>
                <li>Tambahkan <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> dan <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span> (atau <span className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>).</li>
                <li>Redeploy proyek.</li>
              </ol>
              <p className="tiny muted">Jangan pernah memakai service_role / secret key.</p>
            </> : <>
              <p>Tabel berikut belum ditemukan di database: <span className="mono">{detail}</span>.</p>
              <p>Jalankan <span className="mono">supabase/migrations/0001_alat_guru_init.sql</span> lalu <span className="mono">0002_ownership_and_safe_delete.sql</span> di Supabase SQL Editor (sekali saja, oleh pengelola).</p>
            </>}
          </div>}
        </div>}
        {kind === 'env' && onDemo && <button className="btn btn-block" style={{ marginTop: 14, height: 42 }} onClick={onDemo}><Icon n="zap" s={15} />Lihat mode demo (data contoh, hanya di perangkat ini)</button>}
      </div>
    </AuthShell>
  );
}

function LoginPage({ client, server, onOpenServer, onDemo, notice }) {
  const [tab, setTab] = useState('masuk');
  const [view, setView] = useState('form'); // form | forgot | verify
  const [verifyEmail, setVerifyEmail] = useState('');
  return (
    <AuthShell>
      <div className="card" style={{ padding: '28px 26px 24px', borderRadius: 16 }}>
        <Brand />
        {view === 'form' && <>
          <div className="seg" style={{ width: '100%', marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button className={tab === 'masuk' ? 'on' : ''} onClick={() => setTab('masuk')} style={{ height: 38 }}>Masuk</button>
            <button className={tab === 'daftar' ? 'on' : ''} onClick={() => setTab('daftar')} style={{ height: 38 }}>Daftar</button>
          </div>
          {notice && <div className={'alert ' + notice.type} style={{ marginTop: 16 }}><Icon n={notice.type === 'ok' ? 'check' : 'info'} s={16} /><div>{notice.text}</div></div>}
          {tab === 'masuk'
            ? <SignInForm client={client} onForgot={() => setView('forgot')} onOpenServer={onOpenServer} />
            : <SignUpForm client={client} onOpenServer={onOpenServer} onVerify={em => { setVerifyEmail(em); setView('verify'); }} />}
        </>}
        {view === 'forgot' && <ForgotForm client={client} onBack={() => setView('form')} onOpenServer={onOpenServer} />}
        {view === 'verify' && <VerifyNotice client={client} email={verifyEmail} onBack={() => { setView('form'); setTab('masuk'); }} />}
      </div>
    </AuthShell>
  );
}

function needServer(client, onOpenServer, setErr) {
  if (!client) { setErr('Aplikasi belum terhubung ke server. Hubungi pengelola aplikasi.'); return true; }
  if (!navigator.onLine) { setErr('Perangkat sedang offline. Periksa koneksi internet.'); return true; }
  return false;
}

function SignInForm({ client, onForgot, onOpenServer }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [fe, setFe] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {};
    if (!email.trim()) v.email = 'Email wajib diisi.'; else if (!EMAIL_RE.test(email.trim())) v.email = 'Format email tidak valid.';
    if (!pw) v.pw = 'Kata sandi wajib diisi.';
    setFe(v); if (Object.keys(v).length) return;
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
      if (!data.session) throw new Error('Email not confirmed');
      setOk(true); // pengalihan dilakukan oleh listener sesi
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 20 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {ok && <div className="alert ok"><Icon n="check" s={16} /><div>Berhasil masuk. Mengalihkan ke Dashboard…</div></div>}
      <Field label="Email" error={fe.email}>
        <input className={'input ' + (fe.email ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" />
      </Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={pw} onChange={e => setPw(e.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" err={fe.pw} />
      </Field>
      <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Memproses…' : 'Masuk'}</button>
      <div className="row small">
        <button type="button" className="link" onClick={onForgot}>Lupa kata sandi?</button>
      </div>
    </form>
  );
}

function SignUpForm({ client, onOpenServer, onVerify }) {
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [fe, setFe] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Nama lengkap wajib diisi.';
    if (!EMAIL_RE.test(f.email.trim())) v.email = 'Format email tidak valid.';
    const miss = pwPolicy(f.pw); if (miss.length) v.pw = 'Kata sandi perlu: ' + miss.join(', ') + '.';
    if (f.pw2 !== f.pw) v.pw2 = 'Konfirmasi kata sandi tidak sama.';
    setFe(v); if (Object.keys(v).length) return;
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: f.email.trim(), password: f.pw,
        // Hanya full_name yang dikirim sebagai metadata. Role selalu ditetapkan 'guru' oleh trigger database.
        options: { data: { full_name: f.name.trim().slice(0, 120) }, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      // Supabase mengembalikan user tanpa identitas bila email sudah terdaftar (proteksi enumerasi).
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw Object.assign(new Error('already registered'), { code: 'user_already_exists' });
      if (!data.session) { onVerify(f.email.trim()); return; }
      // Verifikasi email nonaktif: sesi langsung tersedia → listener sesi mengalihkan.
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 13, marginTop: 20 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      <Field label="Nama lengkap" error={fe.name}><input className={'input ' + (fe.name ? 'err' : '')} style={{ height: 44 }} autoComplete="name" value={f.name} onChange={set('name')} placeholder="mis. Siti Rahmawati, S.Pd." /></Field>
      <Field label="Email" error={fe.email}><input className={'input ' + (fe.email ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="nama@sekolah.sch.id" /></Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={f.pw} onChange={set('pw')} placeholder="Minimal 8 karakter" autoComplete="new-password" err={fe.pw} />
        <PwStrength pw={f.pw} />
      </Field>
      <Field label="Konfirmasi kata sandi" error={fe.pw2}><PwInput value={f.pw2} onChange={set('pw2')} placeholder="Ulangi kata sandi" autoComplete="new-password" err={fe.pw2} /></Field>
      <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Mendaftarkan…' : 'Buat akun'}</button>
    </form>
  );
}

function VerifyNotice({ client, email, onBack }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [cool, setCool] = useState(0);
  useEffect(() => { if (!cool) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const resend = async () => {
    setBusy(true); setMsg(null);
    try {
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      setMsg({ t: 'ok', m: 'Email verifikasi dikirim ulang.' }); setCool(60);
    } catch (e) { setMsg({ t: 'err', m: DB.friendlyError(e) }); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14, marginTop: 24 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f2f4', display: 'grid', placeItems: 'center' }}><Icon n="mail" s={20} /></div>
      <h3 style={{ fontSize: 17 }}>Periksa email Anda</h3>
      <p className="muted tw-pretty" style={{ lineHeight: 1.55 }}>Kami mengirim tautan verifikasi ke <b style={{ color: 'var(--ink)' }}>{email}</b>. Buka tautan tersebut, lalu kembali ke sini untuk masuk. Periksa juga folder spam.</p>
      {msg && <div className={'alert ' + msg.t}><Icon n={msg.t === 'ok' ? 'check' : 'alert'} s={16} /><div>{msg.m}</div></div>}
      <button className="btn btn-block btn-lg" disabled={busy || cool > 0} onClick={resend}>{busy && <span className="spin" />}{cool ? `Kirim ulang (${cool} dtk)` : 'Kirim ulang email verifikasi'}</button>
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Kembali ke Masuk</button>
    </div>
  );
}

function ForgotForm({ client, onBack, onOpenServer }) {
  const [email, setEmail] = useState(''); const [fe, setFe] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!EMAIL_RE.test(email.trim())) { setFe('Format email tidak valid.'); return; } setFe('');
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + '?reset=1' });
      if (error) throw error;
      setSent(true);
    } catch (e2) { setErr(DB.friendlyError(e2)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 24 }}>
      <div className="col" style={{ gap: 4 }}>
        <h3 style={{ fontSize: 17 }}>Lupa kata sandi</h3>
        <p className="muted small tw-pretty" style={{ lineHeight: 1.5 }}>Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur kata sandi baru.</p>
      </div>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {sent ? (
        <div className="alert ok"><Icon n="mail" s={16} /><div>Permintaan telah diproses. Jika email <b>{email}</b> terdaftar, tautan pemulihan akan dikirim. Buka email tersebut dan ikuti tautannya — tautan hanya berlaku sementara.</div></div>
      ) : <>
        <Field label="Email" error={fe}><input className={'input ' + (fe ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" /></Field>
        <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}Kirim tautan pemulihan</button>
      </>}
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Kembali ke Masuk</button>
    </form>
  );
}

function ResetPasswordPage({ client, hasSession, linkError, onDone }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [fe, setFe] = useState({});
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {}; const miss = pwPolicy(pw);
    if (miss.length) v.pw = 'Kata sandi perlu: ' + miss.join(', ') + '.';
    if (pw2 !== pw) v.pw2 = 'Konfirmasi tidak sama.';
    setFe(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { const { error } = await client.auth.updateUser({ password: pw }); if (error) throw error; setOk(true); }
    catch (e2) { setErr(DB.friendlyError(e2)); }
    setBusy(false);
  };
  return (
    <AuthShell>
      <div className="card" style={{ padding: '28px 26px', borderRadius: 16 }}>
        <Brand />
        <h3 style={{ fontSize: 17, marginTop: 24 }}>Atur kata sandi baru</h3>
        {!hasSession ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert err"><Icon n="alert" s={16} /><div>{linkError || 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.'} Silakan minta tautan baru melalui "Lupa kata sandi".</div></div>
            <button className="btn btn-dark btn-block btn-lg" onClick={onDone}>Kembali ke halaman masuk</button>
          </div>
        ) : ok ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert ok"><Icon n="check" s={16} /><div>Kata sandi berhasil diperbarui.</div></div>
            <button className="btn btn-dark btn-block btn-lg" onClick={onDone}>Lanjut ke Dashboard</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 14 }}>
            {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
            <Field label="Kata sandi baru" error={fe.pw}><PwInput value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" err={fe.pw} /><PwStrength pw={pw} /></Field>
            <Field label="Konfirmasi kata sandi baru" error={fe.pw2}><PwInput value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" err={fe.pw2} /></Field>
            <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}Simpan kata sandi</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

// ---------------- Panel pengelola (hanya untuk profiles.role = 'admin') ----------------
// Tidak ada formulir URL/key: koneksi berasal dari Environment Variables.
// Panel ini hanya mendiagnosis koneksi & skema serta menampilkan SQL migration untuk pengelola.
function AdminServerPanel() {
  const { backend } = useApp();
  const server = DB.getServer();
  const [st, setSt] = useState(null); const [sqlTab, setSqlTab] = useState('0002'); const [copied, setCopied] = useState(false);
  const run = async () => {
    setSt({ busy: true });
    const conn = await DB.testConnection(server.url, server.key);
    const schema = backend.client ? await DB.checkSchema(backend.client) : { ok: false, missing: [] };
    let rpc = false;
    try { const { error } = await backend.client.rpc('is_admin'); rpc = !error; } catch { rpc = false; }
    setSt({ conn, schema, rpc });
  };
  const sql = sqlTab === '0001' ? window.MIGRATION_SQL : window.MIGRATION_0002_SQL;
  const file = sqlTab === '0001' ? window.MIGRATION_FILE : window.MIGRATION_0002_FILE;
  const copy = async () => { try { await navigator.clipboard.writeText(sql); } catch { const t = document.createElement('textarea'); t.value = sql; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const host = server && server.url ? new URL(server.url).hostname : '—';
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card card-pad col" style={{ gap: 12 }}>
        <div className="row between wrap" style={{ gap: 8 }}><b>Koneksi server (Environment Variables)</b><span className="badge dark">Khusus pengelola</span></div>
        <div className="row small" style={{ gap: 8 }}><Icon n="server" s={15} /><span className="mono">{host}</span><span className="tiny muted">key: {server && server.key ? server.key.slice(0, 16) + '…' : '—'}</span></div>
        <p className="tiny muted tw-pretty" style={{ lineHeight: 1.5 }}>Untuk mengganti server, ubah <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> dan <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span> di Vercel lalu Redeploy. Data di server lama tidak terpengaruh.</p>
        <div className="row" style={{ gap: 8 }}><button className="btn" onClick={run} disabled={st && st.busy}>{st && st.busy ? <span className="spin" /> : <Icon n="refresh" s={15} />}Diagnosa koneksi & skema</button></div>
        {st && !st.busy && <div className="col" style={{ gap: 6 }}>
          <div className={'alert ' + (st.conn.authOk ? 'ok' : 'err')}><Icon n={st.conn.authOk ? 'check' : 'alert'} s={16} /><div>Auth: {st.conn.authOk ? 'terhubung' : st.conn.message}</div></div>
          <div className={'alert ' + (st.schema.ok ? 'ok' : 'warn')}><Icon n="db" s={16} /><div>Skema 0001: {st.schema.ok ? 'tabel inti lengkap (' + DB.REQUIRED_TABLES.length + ')' : 'tabel hilang: ' + st.schema.missing.join(', ')}</div></div>
          <div className={'alert ' + (st.rpc ? 'ok' : 'warn')}><Icon n="shield" s={16} /><div>Migration 0002 (penghapusan aman): {st.rpc ? 'terpasang' : 'belum terpasang — jalankan 0002'}</div></div>
        </div>}
      </div>
      <div className="card card-pad col" style={{ gap: 10 }}>
        <div className="row between wrap" style={{ gap: 8 }}>
          <Seg value={sqlTab} onChange={setSqlTab} options={[{ v: '0001', l: '0001 init' }, { v: '0002', l: '0002 keamanan & hapus' }]} />
          <button className="btn btn-sm" onClick={copy}><Icon n={copied ? 'check' : 'copy'} s={14} />{copied ? 'Tersalin' : 'Salin SQL'}</button>
        </div>
        <span className="mono tiny muted">{file}</span>
        <pre className="code">{sql}</pre>
        <div className="alert info"><Icon n="info" s={16} /><div>Jalankan berurutan di Supabase → SQL Editor, sekali saja. Keduanya aditif & idempoten: tidak menghapus tabel/data dan tidak mematikan RLS. Menyalin SQL tidak berarti migration sudah berjalan — gunakan Diagnosa untuk memastikan.</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPage, ResetPasswordPage, ConfigErrorPage, AdminServerPanel, pwPolicy, EMAIL_RE });
