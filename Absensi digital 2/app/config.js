// =====================================================================
// Konfigurasi publik Supabase — SATU kali oleh pemilik aplikasi.
//
// Versi produksi (Next.js di Vercel): JANGAN isi file ini. Atur di
//   Vercel → Project → Settings → Environment Variables
//     NEXT_PUBLIC_SUPABASE_URL              = https://<ref>.supabase.co
//     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = sb_publishable_...
//     (proyek lama boleh memakai NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...)
// lalu Redeploy. Next.js menyisipkan nilai NEXT_PUBLIC_* saat build.
//
// Prototipe HTML ini membaca nilai yang sama dari objek di bawah.
// Hanya URL + publishable/anon key (aman di browser bila RLS aktif).
// JANGAN PERNAH menaruh service_role key / secret key (sb_secret_...) di sini.
// =====================================================================
window.__ALAT_GURU_ENV__ = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://qpdbhvtlepqpyhauhmon.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_LSgD3W26JHaAp96AhrJxQQ_zm_NN2nq',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
};
