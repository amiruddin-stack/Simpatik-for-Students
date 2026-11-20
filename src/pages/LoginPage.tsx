import React from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#061b49_0%,#073b86_42%,#0878d1_100%)] px-5 py-10 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-32 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-24 h-[28rem] w-[28rem] rounded-full bg-blue-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-1/3 top-24 h-28 w-[160%] rotate-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl" />

      <section className="simpatik-enter relative z-10 mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="relative mb-7 flex h-52 w-52 items-center justify-center sm:mb-8 sm:h-60 sm:w-60">
          <div aria-hidden="true" className="absolute inset-2 rounded-full bg-white/20 blur-2xl" />
          <img
            src={`${import.meta.env.BASE_URL}logo-alwasi.png`}
            alt="Logo SMP Islam Al-Wasi’"
            className="relative h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,12,48,0.35)]"
          />
        </div>

        <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-blue-100">SMP Islam Al-Wasi’</p>
        <h1 className="mt-2 text-4xl font-black tracking-[0.08em] text-white drop-shadow-lg sm:text-5xl">SIMPATIK</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-cyan-200 via-white to-cyan-200 shadow-[0_0_18px_rgba(255,255,255,0.75)]" />

        <p className="mt-6 text-lg font-extrabold text-white">Selamat Datang</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-blue-100">
          Silakan masuk menggunakan akun Google resmi sekolah untuk melanjutkan ke aplikasi.
        </p>

        <button
          type="button"
          onClick={() => void loginWithGoogle()}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/70 bg-gradient-to-b from-white to-blue-50 px-5 py-4 text-sm font-extrabold text-[#08387f] shadow-[0_10px_30px_rgba(0,16,56,0.25),inset_0_1px_0_rgba(255,255,255,1)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,16,56,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 rounded-full bg-white p-0.5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.65 5.94c4.47-4.13 7.12-10.2 7.12-17.59Z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/>
            <path fill="#3462a8" d="M24 48c6.48 0 11.93-2.13 15.9-5.86l-7.65-5.94c-2.12 1.43-4.84 2.28-8.25 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 43.62 14.62 48 24 48Z"/>
          </svg>
          {loading ? 'SIMPATIK sedang dipersiapkan…' : 'Masuk dengan Google Sekolah'}
        </button>

        <div className="mt-6">
          <p className="text-xs font-bold text-white">Akun yang diizinkan</p>
          <p className="mt-1 text-xs font-medium text-blue-100">@smpialwasi-maros.sch.id</p>
        </div>
        <p className="mt-8 text-[10px] font-semibold tracking-wide text-blue-100/80">Qurani, Ramah Anak dan Berkarakter</p>
      </section>
    </main>
  );
}
