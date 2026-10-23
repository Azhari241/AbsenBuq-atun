// =====================================================================
// Lapisan data ALAT GURU
//  - SupabaseBackend : penyimpanan utama (PostgreSQL + Auth + RLS)
//  - DemoBackend     : mode demo terisolasi di perangkat ini (diberi label jelas)
// Semua mutasi menunggu konfirmasi backend sebelum cache UI diperbarui.
// =====================================================================
(function () {
  const SERVER_KEY = 'alatguru.server.v1';
  const DEMO_KEY = 'alatguru.demo.data.v1';
  const DEMO_SESSION = 'alatguru.demo.session.v1';

  const TABLES = ['profiles','academic_years','semesters','classes','students','meetings','meeting_modules',
    'attendance_records','memorization_targets','memorization_records','assignments','assignment_records',
    'activity_records','student_notes','note_history','module_settings','semester_exemption_rules',
    'semester_exemption_reviews','learning_materials','attention_followups','audit_logs'];

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const nowIso = () => new Date().toISOString();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------------- Konfigurasi server: HANYA dari Environment Variables ----------------
  // Di Next.js/Vercel nilai ini berasal dari NEXT_PUBLIC_SUPABASE_URL dan
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (atau NEXT_PUBLIC_SUPABASE_ANON_KEY untuk proyek lama).
  // Di prototipe ini nilainya dibaca dari app/config.js. Pengguna tidak pernah memasukkannya.
  try { localStorage.removeItem(SERVER_KEY); } catch { /* bersihkan konfigurasi lama per-perangkat */ }
  function getServer() {
    const env = window.__ALAT_GURU_ENV__ || {};
    const url = String(env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const key = String(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return { missing: true, errors: { env: 'Environment Variables Supabase belum diatur.' } };
    const errors = validateServerInput(url, key);
    if (Object.keys(errors).length) return { invalid: true, errors };
    return { url: url.replace(/\/+$/, ''), key };
  }
  // Pemeriksaan tabel yang benar-benar dipakai aplikasi (bukan sekadar satu tabel).
  const REQUIRED_TABLES = ['profiles', 'academic_years', 'semesters', 'classes', 'students', 'meetings', 'attendance_records', 'module_settings', 'student_notes'];
  async function checkSchema(client) {
    const missing = [];
    let network = false;
    await Promise.all(REQUIRED_TABLES.map(async t => {
      const { error } = await client.from(t).select('id', { head: true, count: 'exact' }).limit(1);
      if (!error) return;
      if (/does not exist|PGRST205|42P01|schema cache/i.test((error.message || '') + ' ' + (error.code || ''))) missing.push(t);
      else if (/fetch|network/i.test(error.message || '')) network = true;
    }));
    return { ok: !missing.length && !network, missing, network };
  }

  function decodeJwtRole(key) {
    try {
      const p = key.split('.')[1];
      const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      return json.role || null;
    } catch { return null; }
  }
  function validateServerInput(url, key) {
    const errs = {};
    const u = (url || '').trim();
    const k = (key || '').trim();
    if (!u) errs.url = 'Project URL wajib diisi.';
    else {
      let parsed = null;
      try { parsed = new URL(u); } catch { /* */ }
      if (!parsed || parsed.protocol !== 'https:') errs.url = 'Gunakan URL https, contoh: https://abcd1234.supabase.co';
      else if (!/\.supabase\.(co|in)$/.test(parsed.hostname) && !/^(localhost|127\.0\.0\.1)$/.test(parsed.hostname))
        errs.url = 'URL harus berupa domain proyek Supabase (…supabase.co).';
      else if (parsed.pathname.replace(/\/+$/, '') !== '') errs.url = 'Masukkan URL proyek saja tanpa path tambahan.';
    }
    if (!k) errs.key = 'Publishable key / anon key wajib diisi.';
    else if (/^sb_secret_/.test(k)) errs.key = 'Ini adalah secret key. Jangan gunakan secret / service role key di browser.';
    else if (k.startsWith('eyJ')) {
      const role = decodeJwtRole(k);
      if (role === 'service_role') errs.key = 'Ini adalah service role key. Gunakan anon key atau publishable key.';
      else if (role && role !== 'anon') errs.key = 'Key tidak dikenali sebagai anon key.';
    } else if (!/^sb_publishable_/.test(k)) errs.key = 'Format key tidak dikenali. Gunakan publishable key (sb_publishable_…) atau anon key.';
    return errs;
  }

  function makeClient(url, key) {
    if (!window.supabase || !window.supabase.createClient) throw new Error('Library Supabase gagal dimuat. Periksa koneksi internet.');
    const host = new URL(url).hostname.split('.')[0];
    return window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'alatguru-auth-' + host },
    });
  }

  // Uji koneksi lewat permintaan nyata: endpoint Auth + keberadaan tabel aplikasi.
  async function testConnection(url, key) {
    const u = url.trim().replace(/\/+$/, ''), k = key.trim();
    const res = { ok: false, authOk: false, schemaOk: false, message: '' };
    if (!navigator.onLine) { res.message = 'Perangkat sedang offline.'; return res; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(u + '/auth/v1/settings', { headers: { apikey: k }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.status === 401 || r.status === 403) { res.message = 'Server merespons, tetapi key ditolak. Periksa kembali publishable/anon key.'; return res; }
      if (!r.ok) { res.message = 'Server merespons dengan status ' + r.status + '. Pastikan URL proyek benar.'; return res; }
      res.authOk = true;
    } catch (e) {
      res.message = e.name === 'AbortError' ? 'Koneksi habis waktu (10 detik). Periksa URL dan jaringan.' : 'Tidak dapat menjangkau server. Periksa URL proyek dan koneksi internet.';
      return res;
    }
    try {
      const client = makeClient(u, k);
      const { error } = await client.from('module_settings').select('id', { head: true, count: 'exact' });
      if (error) {
        if (/does not exist|PGRST205|42P01|schema cache/i.test(error.message + ' ' + (error.code || ''))) {
          res.message = 'Koneksi berhasil, tetapi tabel aplikasi belum ditemukan. Jalankan migration SQL terlebih dahulu.';
          res.ok = true; res.schemaOk = false; return res;
        }
        res.message = 'Koneksi berhasil, tetapi pemeriksaan tabel gagal: periksa migration.';
        res.ok = true; return res;
      }
      res.ok = true; res.schemaOk = true;
      res.message = 'Koneksi berhasil dan tabel aplikasi ditemukan.';
    } catch (e) {
      res.message = 'Koneksi Auth berhasil, tetapi pemeriksaan database gagal.';
      res.ok = true;
    }
    return res;
  }

  // Pesan kesalahan ramah — tanpa detail teknis/kredensial.
  function friendlyError(e) {
    const m = ((e && (e.message || e.error_description)) || '').toLowerCase();
    const code = (e && e.code) || '';
    if (!navigator.onLine || m.includes('failed to fetch') || m.includes('network')) return 'Koneksi terputus. Data belum tersimpan — coba lagi setelah online.';
    if (m.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
    if (m.includes('email not confirmed')) return 'Email belum diverifikasi. Periksa kotak masuk Anda.';
    if (m.includes('already registered') || m.includes('already been registered') || code === 'user_already_exists') return 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa kata sandi.';
    if (m.includes('rate limit') || code === 'over_email_send_rate_limit') return 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.';
    if (m.includes('password should be') || code === 'weak_password') return 'Kata sandi belum memenuhi kebijakan keamanan server.';
    if (m.includes('jwt expired') || m.includes('session') && m.includes('expired')) return 'Sesi berakhir. Silakan masuk kembali.';
    if (code === '23505' || m.includes('duplicate')) return 'Data yang sama sudah ada (duplikat).';
    if (code === '23503') return 'Data masih terhubung dengan data lain sehingga tidak dapat diproses.';
    if (code === '42501' || m.includes('row-level security') || m.includes('bukan milik')) return 'Akses ditolak oleh kebijakan keamanan database (RLS): data ini bukan milik akun Anda.';
    if (m.includes('does not exist') || code === 'PGRST205') return 'Database belum siap (tabel belum tersedia). Hubungi pengelola aplikasi.';
    if (code === 'PGRST202' || m.includes('could not find the function')) return 'Fitur ini memerlukan pembaruan database (migration 0002). Hubungi pengelola aplikasi.';
    if (e && e.code === 'NOT_OWNED') return 'Data tidak ditemukan atau bukan milik akun Anda. Tidak ada yang diubah.';
    if (e && e.code === 'P0001' && e.message) return e.message;
    if (e && e.friendly) return e.message;
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }

  // ---------------- Backend Supabase ----------------
  function SupabaseBackend(client) {
    const strip = r => { const { owner_id, ...rest } = r; return rest; };
    const chk = ({ data, error }) => { if (error) throw error; return data; };
    return {
      kind: 'supabase', client,
      async selectAll(table) {
        // Paginasi agar tidak terpotong batas 1000 baris.
        let all = [], from = 0; const size = 1000;
        for (;;) {
          const rows = chk(await client.from(table).select('*').range(from, from + size - 1));
          all = all.concat(rows); if (rows.length < size) break; from += size;
        }
        return all;
      },
      async insert(table, rows) { return chk(await client.from(table).insert([].concat(rows).map(strip)).select()); },
      async update(table, id, patch) {
        const rows = chk(await client.from(table).update(strip(patch)).eq('id', id).select());
        // RLS menyaring baris milik akun lain → 0 baris. Jangan anggap berhasil.
        if (!rows.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return rows[0];
      },
      async upsert(table, rows, onConflict) {
        if (!rows.length) return [];
        return chk(await client.from(table).upsert(rows.map(strip), { onConflict }).select());
      },
      async remove(table, id) {
        const rows = chk(await client.from(table).delete().eq('id', id).select('id'));
        if (!rows.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return true;
      },
      async removeMany(table, ids) {
        if (!ids.length) return 0;
        const rows = chk(await client.from(table).delete().in('id', ids).select('id'));
        if (rows.length !== ids.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return rows.length;
      },
      // Penghapusan berelasi dijalankan sebagai fungsi database (satu transaksi, RLS tetap berlaku).
      async rpc(name, args) { return chk(await client.rpc(name, args)); },
    };
  }

  // ---------------- Backend Demo (terisolasi, hanya untuk mencoba) ----------------
  function DemoBackend() {
    let store = null;
    const load = () => {
      if (store) return store;
      try { store = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { store = null; }
      if (!store) { store = {}; TABLES.forEach(t => store[t] = []); }
      TABLES.forEach(t => store[t] = store[t] || []);
      return store;
    };
    const persist = () => localStorage.setItem(DEMO_KEY, JSON.stringify(store));
    const net = async () => { await sleep(160 + Math.random() * 180); if (!navigator.onLine) { const e = new Error('Failed to fetch'); throw e; } };
    const stamp = r => ({ id: uuid(), owner_id: 'demo-user', created_at: nowIso(), updated_at: nowIso(), ...r });
    const UNIQUE = {
      attendance_records: ['meeting_id','student_id'], memorization_records: ['meeting_id','student_id'],
      activity_records: ['meeting_id','student_id'], assignment_records: ['assignment_id','student_id'],
      meetings: ['class_id','semester_id','number'], meeting_modules: ['meeting_id','module'],
      semester_exemption_reviews: ['semester_id','student_id'], attention_followups: ['student_id','category'],
      semester_exemption_rules: ['owner_id','semester_id'],
    };
    const conflictFor = (table, row, data) => {
      const keys = UNIQUE[table]; if (!keys) return null;
      return data.find(x => keys.every(k => (k === 'owner_id' ? true : x[k] === row[k])));
    };
    return {
      kind: 'demo',
      async selectAll(table) { await sleep(20); return JSON.parse(JSON.stringify(load()[table] || [])); },
      async insert(table, rows) {
        await net(); const s = load(); const out = [];
        for (const r of [].concat(rows)) {
          const row = stamp(r);
          if (conflictFor(table, row, s[table])) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
          if (table === 'students' && row.nis && s.students.some(x => x.nis && x.nis === row.nis)) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
          s[table].push(row); out.push(row);
        }
        persist(); return JSON.parse(JSON.stringify(out));
      },
      async update(table, id, patch) {
        await net(); const s = load(); const i = s[table].findIndex(x => x.id === id);
        if (i < 0) { const e = new Error('not found'); throw e; }
        if (table === 'students' && patch.nis && s.students.some(x => x.id !== id && x.nis && x.nis === patch.nis)) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
        s[table][i] = { ...s[table][i], ...patch, id, updated_at: nowIso() }; persist();
        return JSON.parse(JSON.stringify(s[table][i]));
      },
      async upsert(table, rows) {
        await net(); const s = load(); const out = [];
        for (const r of rows) {
          const ex = (r.id && s[table].find(x => x.id === r.id)) || conflictFor(table, r, s[table]);
          if (ex) { Object.assign(ex, r, { id: ex.id, updated_at: nowIso() }); out.push(ex); }
          else { const row = stamp(r); s[table].push(row); out.push(row); }
        }
        persist(); return JSON.parse(JSON.stringify(out));
      },
      async remove(table, id) {
        await net(); const s = load();
        if (!s[table].some(x => x.id === id)) { const e = new Error('not owned'); e.code = 'NOT_OWNED'; throw e; }
        // Tiru FK: restrict untuk siswa yang punya riwayat
        if (table === 'students' && ['attendance_records', 'memorization_records', 'activity_records', 'assignment_records', 'student_notes', 'semester_exemption_reviews'].some(t => s[t].some(r => r.student_id === id))) { const e = new Error('fk'); e.code = '23503'; throw e; }
        if (table === 'assignments') { s.assignment_records = s.assignment_records.filter(r => r.assignment_id !== id); s.student_notes.forEach(n => { if (n.related_assignment_id === id) n.related_assignment_id = null; }); }
        if (table === 'student_notes') s.note_history = s.note_history.filter(h => h.note_id !== id);
        if (table === 'memorization_targets') s.memorization_records.forEach(r => { if (r.target_id === id) r.target_id = null; });
        if (table === 'students') s.attention_followups = s.attention_followups.filter(f => f.student_id !== id);
        s[table] = s[table].filter(x => x.id !== id); persist(); return true;
      },
      async removeMany(table, ids) { await net(); const s = load(); const set = new Set(ids); s[table] = s[table].filter(x => !set.has(x.id)); persist(); return ids.length; },
      async rpc(name, args) {
        await net(); const s = load();
        const err = (msg, code) => { const e = new Error(msg); e.code = code; throw e; };
        if (name === 'delete_meeting') {
          const id = args.p_meeting_id;
          if (!s.meetings.some(m => m.id === id)) err('Pertemuan tidak ditemukan atau bukan milik Anda', 'NOT_OWNED');
          const cnt = t => s[t].filter(r => r.meeting_id === id).length;
          const out = { attendance: cnt('attendance_records'), memorization: cnt('memorization_records'), activity: cnt('activity_records') };
          ['attendance_records', 'memorization_records', 'activity_records', 'meeting_modules'].forEach(t => s[t] = s[t].filter(r => r.meeting_id !== id));
          s.assignments.forEach(a => { if (a.meeting_id === id) a.meeting_id = null; });
          s.student_notes.forEach(n => { if (n.origin_meeting_id === id) n.origin_meeting_id = null; });
          s.meetings = s.meetings.filter(m => m.id !== id);
          s.audit_logs.push(stamp({ action: 'hapus', entity: 'meetings', entity_id: id, detail: out }));
          persist(); return out;
        }
        if (name === 'delete_class') {
          const id = args.p_class_id;
          if (!s.classes.some(c => c.id === id)) err('Kelas tidak ditemukan atau bukan milik Anda', 'NOT_OWNED');
          if (s.students.some(x => x.class_id === id) || s.meetings.some(m => m.class_id === id) || s.student_notes.some(n => n.class_id === id)) err('Kelas masih memiliki siswa, pertemuan, atau catatan. Arsipkan kelas sebagai gantinya.', 'P0001');
          s.assignments = s.assignments.filter(a => !(a.class_id === id && !s.assignment_records.some(r => r.assignment_id === a.id)));
          s.memorization_targets = s.memorization_targets.filter(t => t.class_id !== id);
          s.classes = s.classes.filter(c => c.id !== id);
          persist(); return null;
        }
        err('Could not find the function', 'PGRST202');
      },
      reset() { localStorage.removeItem(DEMO_KEY); store = null; },
      hasData() { const s = load(); return s.classes.length > 0; },
      seed(seedObj) { store = {}; TABLES.forEach(t => store[t] = seedObj[t] || []); persist(); },
    };
  }

  window.DB = {
    TABLES, uuid, nowIso, getServer, checkSchema, REQUIRED_TABLES, validateServerInput, makeClient, testConnection,
    friendlyError, SupabaseBackend, DemoBackend,
    demoSession: { get: () => localStorage.getItem(DEMO_SESSION) === '1', set: v => v ? localStorage.setItem(DEMO_SESSION, '1') : localStorage.removeItem(DEMO_SESSION) },
  };
})();
