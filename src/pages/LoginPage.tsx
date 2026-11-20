import React from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#e7eef8] via-white to-[#eaeef5] px-5 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-7 text-center shadow-[0_24px_80px_rgba(8,127,73,0.13)] sm:p-10">
        <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center">
          <img src={`${import.meta.env.BASE_URL}logo-alwasi.png`} alt="Logo SMP Islam Al-Wasi’" className="h-full w-full object-contain" />
        </div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-blue-700">SMP Islam Al-Wasi’</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">SIMPATIK</h1>
        <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-blue-500" />
        <p className="mt-4 text-sm font-extrabold tracking-wide text-[#08387f]">Selamat Datang Guru Hebat</p>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500">Silakan masuk menggunakan akun Google resmi sekolah untuk melanjutkan ke aplikasi.</p>
        <button
          type="button"
          onClick={() => void loginWithGoogle()}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#08387f] to-[#0b4396] px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 rounded-full bg-white p-0.5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.94c4.47-4.13 7.12-10.2 7.12-17.59Z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/>
            <path fill="#3462a8" d="M24 48c6.48 0 11.93-2.13 15.9-5.86l-7.65-5.94c-2.12 1.43-4.84 2.28-8.25 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 43.62 14.62 48 24 48Z"/>
          </svg>
          {loading ? 'SIMPATIK sedang dipersiapkan…' : 'Masuk dengan Google Sekolah'}
        </button>
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-left">
          <p className="text-xs font-extrabold text-blue-950">Akun yang diizinkan</p>
          <p className="mt-1 text-xs font-medium text-blue-800">@smpialwasi-maros.sch.id</p>
        </div>
        <p className="mt-6 text-[10px] font-medium tracking-wide text-slate-400">Qurani, Ramah Anak dan Berkarakter</p>
      </section>
    </main>
  );
}
