import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, ClipboardCheck,
  GraduationCap, KeyRound, LogOut, ShieldCheck, UserRound,
  UserSquare2
} from 'lucide-react';
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizeStudentNisn, studentNisnHash } from '../lib/studentLookup';
import { getClassDisplayName } from '../lib/classes';
import {
  buildVerifiedStudentProfileFromDirectory,
  validateStoredStudentSession,
  type StudentProfile,
} from '../lib/studentAuth';
import { SIMPATIK_API_BASE_URL, simpatikApi } from '../lib/backendApi';
import { RegistrationPage } from './MasterDataPage';
import { ExamPage } from './ExamPage';
import { StudentGoogleFormExams } from './StudentGoogleFormExams';

type StudentView = 'home' | 'register' | 'login';
type StudentMenu = 'dashboard' | 'profil' | 'biodata' | 'tahsin' | 'bacaan-sholat' | 'ujian-semester' | 'ujian-sekolah' | 'ujian-form' | 'keamanan';

const menuTitles: Record<StudentMenu, string> = {
  dashboard: 'Dashboard',
  profil: 'Profil', biodata: 'Biodata Siswa', tahsin: 'Tahsin',
  'bacaan-sholat': 'Bacaan Sholat', 'ujian-semester': 'Ujian Semester',
  'ujian-sekolah': 'Ujian Sekolah', 'ujian-form': 'Ujian Form', keamanan: 'Keamanan'
};

export const StudentPortalPage: React.FC = () => {
  const [view, setView] = useState<StudentView>('home');
  const [nisn, setNisn] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [studentSession, setStudentSession] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [activeMenu, setActiveMenu] = useState<StudentMenu>('dashboard');
  const [examRoomId, setExamRoomId] = useState(() => new URLSearchParams(window.location.search).get('examRoom') || '');
  const enterExamRoom = (id: string) => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('student', '1');
    nextUrl.searchParams.set('examRoom', id);
    nextUrl.searchParams.delete('page');
    window.history.pushState({}, '', nextUrl);
    setExamRoomId(id);
  };
  const exitExamRoom = () => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('examRoom');
    nextUrl.searchParams.delete('page');
    nextUrl.searchParams.set('student', '1');
    window.history.pushState({}, '', nextUrl);
    setExamRoomId('');
    setActiveMenu('dashboard');
  };

  useEffect(() => {
    const syncExamRoute = () => {
      const currentExamId = new URLSearchParams(window.location.search).get('examRoom') || '';
      setExamRoomId(currentExamId);
      if (!currentExamId) setActiveMenu('dashboard');
    };
    window.addEventListener('popstate', syncExamRoute);
    return () => window.removeEventListener('popstate', syncExamRoute);
  }, []);

  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    const restoreSession = async () => {
      try {
        await auth.authStateReady();
        if (!alive) return;
        unsubscribe = onAuthStateChanged(auth, async user => {
          if (!alive) return;
          if (!user) {
            setStudentSession(false);
            setStudent(null);
            setSessionChecking(false);
            return;
          }
          try {
            const saved = localStorage.getItem('simpatik_student_identity');
            const tokenResult = user.isAnonymous ? undefined : await user.getIdTokenResult();
            if (!alive) return;
            const profile = validateStoredStudentSession({
              rawJson: saved,
              uid: user.uid,
              isAnonymous: user.isAnonymous,
              claims: tokenResult?.claims,
            });
            if (!profile) {
              setStudentSession(false);
              setStudent(null);
              setSessionChecking(false);
              return;
            }
            if (profile.authMode === 'firebase_directory' && typeof navigator !== 'undefined' && navigator.onLine) {
              try {
                const directorySnap = await getDoc(doc(db, 'studentExamDirectory', profile.id));
                if (!alive) return;
                const directoryData = directorySnap.exists() ? directorySnap.data() : undefined;
                if (!directoryData || String(directoryData.status || '').toLowerCase() !== 'aktif') {
                  localStorage.removeItem('simpatik_student_identity');
                  setStudentSession(false);
                  setStudent(null);
                  setSessionChecking(false);
                  return;
                }
              } catch (verifyError) {
                console.warn('Verifikasi direktori sesi siswa dilewati:', verifyError);
              }
            }
            setStudent(profile);
            setStudentSession(true);
            setSessionChecking(false);
          } catch (error) {
            console.error('Gagal memulihkan sesi siswa:', error);
            localStorage.removeItem('simpatik_student_identity');
            setStudentSession(false);
            setStudent(null);
            setSessionChecking(false);
          }
        });
      } catch (error) {
        console.error('Firebase belum selesai memulihkan sesi siswa:', error);
        if (alive) setSessionChecking(false);
      }
    };
    void restoreSession();
    return () => { alive = false; unsubscribe(); };
  }, []);

  const loginStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedNisn = normalizeStudentNisn(nisn);
    if (!normalizedNisn || normalizedNisn.length > 30) {
      setMessage('Masukkan NISN yang benar (maksimal 30 karakter).');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const canTryBackend = Boolean(SIMPATIK_API_BASE_URL) || (typeof window !== 'undefined' && window.location.protocol.startsWith('http'));
      if (canTryBackend) {
        try {
          let backendReady = Boolean(SIMPATIK_API_BASE_URL);
          if (!backendReady) {
            const healthResponse = await fetch(simpatikApi('/api/health'));
            const healthType = healthResponse.headers.get('content-type') || '';
            const healthData = healthType.includes('application/json') ? await healthResponse.json().catch(() => null) : null;
            backendReady = Boolean(healthResponse.ok && healthData?.studentFirestoreConfigured);
          }
          if (backendReady) {
            const response = await fetch(simpatikApi('/api/student-login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nisn: normalizedNisn })
            });
            const contentType = response.headers.get('content-type') || '';
            const result = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
            if (response.ok && result?.success && result?.token && result?.student?.id && result?.student?.name && result?.student?.className) {
              if (auth.currentUser) await signOut(auth);
              await setPersistence(auth, browserLocalPersistence);
              const credential = await signInWithCustomToken(auth, result.token);
              const profile: StudentProfile = {
                id: String(result.student.id),
                name: String(result.student.name),
                className: String(result.student.className),
                nis: String(result.student.nis || ''),
                nisn: normalizedNisn,
                gender: String(result.student.gender || ''),
                authMode: 'custom_token',
                ownerUid: credential.user.uid,
              };
              localStorage.setItem('simpatik_student_identity', JSON.stringify(profile));
              setStudent(profile);
              setStudentSession(true);
              setActiveMenu('dashboard');
              return;
            }
            if (result && response.status !== 404 && response.status !== 405 && !result.fallback) {
              throw new Error(result.message || 'Login siswa belum dapat diproses.');
            }
          }
        } catch (backendError) {
          if (backendError instanceof Error && backendError.message && !/fetch|network|json|abort/i.test(backendError.message)) {
            throw backendError;
          }
        }
      }

      if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
      await setPersistence(auth, browserLocalPersistence);
      const currentUser = auth.currentUser ?? (await signInAnonymously(auth)).user;
      const lookupId = await studentNisnHash(normalizedNisn);
      const lookupSnap = await getDoc(doc(db, 'studentLoginLookup', lookupId));
      const lookupData = lookupSnap.exists() ? lookupSnap.data() : undefined;
      const directoryId = typeof lookupData?.studentId === 'string' ? lookupData.studentId : '';
      const directorySnap = directoryId ? await getDoc(doc(db, 'studentExamDirectory', directoryId)) : null;
      const profile = buildVerifiedStudentProfileFromDirectory({
        normalizedNisn,
        ownerUid: currentUser.uid,
        lookupData,
        directoryData: directorySnap?.exists() ? directorySnap.data() : undefined,
        directoryId,
      });
      localStorage.setItem('simpatik_student_identity', JSON.stringify(profile));
      setStudent(profile);
      setStudentSession(true);
      setActiveMenu('dashboard');
    } catch (error) {
      console.error('Login siswa gagal:', error);
      setMessage(error instanceof Error ? error.message : 'Tidak dapat masuk. Periksa koneksi internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('simpatik_student_identity');
    setStudent(null);
    setStudentSession(false);
    void signOut(auth);
  };

  if (view === 'register') return (
    <div className="min-h-screen bg-[#F7FBF8] px-3 py-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => setView('home')} aria-label="Kembali" className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#0B8F4D] to-[#087640] text-white shadow"><ArrowLeft size={20}/></button>
        <RegistrationPage type="siswa" studentPortal />
      </div>
    </div>
  );

  if (studentSession && student) {
    if (sessionChecking) return <main className="flex min-h-screen items-center justify-center bg-[#F7FBF8] p-5 text-center text-sm font-semibold text-slate-500">Memulihkan sesi siswa…</main>;

  if (examRoomId) return <StudentGoogleFormExams className={student.className} nisn={student.nisn} studentId={student.id} studentName={student.name} examRoomId={examRoomId} onEnterExam={enterExamRoom} onExitExam={exitExamRoom} />;
    const selectMenu = (id: StudentMenu) => { setActiveMenu(id); };
    const activeLabel = menuTitles[activeMenu];
    const renderContent = () => {
      if (activeMenu === 'profil') return (
        <div className="grid gap-4">
          <section className="rounded-2xl border border-[#D9EEE2] bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E3F7EC] text-[#087F49]"><UserRound size={38}/></div>
              <h2 className="mt-3 text-xl font-black text-slate-800">{student.name}</h2>
              <p className="mt-1 text-sm font-semibold text-[#087F49]">Kelas {getClassDisplayName(student.className) || student.className}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#E3F7EC] px-3 py-1.5 text-xs font-bold text-[#087F49]"><span className="h-1.5 w-1.5 rounded-full bg-[#0B8F4D]"/> Akun Aktif</span>
            </div>
          </section>
          <section className="rounded-2xl border border-[#D9EEE2] bg-white p-4 shadow-sm">
            <h3 className="font-extrabold text-slate-800">Ringkasan Akun</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F5FBF7] p-3"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-bold text-[#087F49]">Aktif</p></div>
              <div className="rounded-xl bg-[#F5FBF7] p-3"><p className="text-xs text-slate-500">Kelas</p><p className="mt-1 font-bold text-slate-800">{student.className}</p></div>
            </div>
          </section>
        </div>
      );
      if (activeMenu === 'biodata') return (
        <section className="rounded-2xl border border-[#D9EEE2] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 font-extrabold text-slate-800">Identitas Siswa</h2>
          <dl className="divide-y divide-[#E7F1EA]">
            {[['Nama Lengkap', student.name], ['Kelas', student.className], ['NIS', student.nis || '—'], ['NISN', student.nisn || '—'], ['Jenis Kelamin', student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : '—'], ['Status Akun', 'Aktif']].map(([label, value]) => <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="text-sm font-bold text-slate-800">{value}</dd></div>)}
          </dl>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Jika ada biodata yang perlu diperbaiki, silakan hubungi admin sekolah.</p>
        </section>
      );
      if (activeMenu === 'tahsin' || activeMenu === 'bacaan-sholat') return (
        <section className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-[#D9EEE2] bg-white p-6 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E3F7EC] text-[#087F49]"><BookOpen size={30}/></div>
          <h2 className="mt-4 text-lg font-black text-slate-800">{activeLabel}</h2>
          <span className="mt-3 rounded-full bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">Coming Soon</span>
          <p className="mt-2 max-w-sm text-sm text-slate-500">Materi {activeLabel.toLowerCase()} sedang disiapkan.</p>
        </section>
      );
      if (activeMenu === 'ujian-form') return <StudentGoogleFormExams className={student.className} nisn={student.nisn} studentId={student.id} studentName={student.name} onEnterExam={enterExamRoom} onExitExam={exitExamRoom} />;
      if (activeMenu === 'ujian-semester' || activeMenu === 'ujian-sekolah') return (
        <section className="rounded-2xl border border-[#D9EEE2] bg-white p-3 shadow-sm sm:p-5">
          <div className="mb-4"><h2 className="font-extrabold text-slate-800">{activeLabel}</h2><p className="mt-1 text-xs text-slate-500">Pilih ujian yang tersedia untuk kelas {student.className}.</p></div>
          <ExamPage studentMode />
        </section>
      );
      return (
        <section className="rounded-2xl border border-[#D9EEE2] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E3F7EC] text-[#087F49]"><ShieldCheck size={25}/></div><div><h2 className="font-extrabold text-slate-800">Keamanan Akun</h2><p className="text-xs text-slate-500">Kelola sesi masuk pada perangkat ini.</p></div></div>
          <div className="mt-5 rounded-xl bg-[#F5FBF7] p-4"><p className="text-sm font-bold text-slate-800">Masuk menggunakan NISN</p><p className="mt-1 text-xs leading-5 text-slate-500">Sesi akun tersimpan pada perangkat ini agar siswa tidak perlu masuk berulang kali. Jangan gunakan perangkat bersama tanpa keluar dari akun.</p></div>
          <button type="button" onClick={logout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"><LogOut size={17}/> Keluar dari akun siswa</button>
        </section>
      );
    };

    return (
      <main className="min-h-screen bg-[#F7FBF8]">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-800 sm:text-base">{student.name}</p><p className="text-[11px] font-medium text-slate-500">Kelas {student.className}</p></div>
            <button type="button" aria-label="Notifikasi" title="Notifikasi" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D9EEE2] bg-white text-[#087F49] shadow-sm"><Bell size={19}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"/></button>
          </div>
          {activeMenu === 'dashboard' && (
          <header className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0B8F4D] via-[#087F49] to-[#06663A] px-5 py-6 text-white shadow-lg sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10"/>
            <div className="pointer-events-none absolute -bottom-24 right-24 h-44 w-44 rounded-full bg-white/5"/>
            <img src={`${import.meta.env.BASE_URL}images/Desain%20tanpa%20judul_20261118_110522_0000.png`} alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-0 h-full max-h-[155px] w-[44%] object-contain object-right drop-shadow-[0_8px_8px_rgba(0,0,0,0.12)] sm:max-h-[250px] sm:w-[42%]"/>
            <div className="relative z-10 max-w-[58%] sm:max-w-[62%]">
              <h1 className="whitespace-nowrap text-[clamp(0.7rem,3.6vw,1.5rem)] font-black leading-tight tracking-wide">SIMPATIK FOR STUDENTS</h1>
              <p className="mt-1 text-sm font-bold text-white/90 sm:text-base">SMP Islam Al-Wasi'</p>
              <p className="mt-4 text-xs font-semibold text-white/80">Qurani, Ramah Anak dan Berkarakter</p>
            </div>
          </header>
          )}

          {activeMenu !== 'dashboard' && (
            <header className="mt-4 flex min-h-[82px] items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0B8F4D] to-[#087640] px-4 py-4 text-white shadow-md sm:px-5">
              <button type="button" onClick={() => setActiveMenu('dashboard')} aria-label="Kembali ke dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white transition hover:bg-white hover:text-[#087640]"><ArrowLeft size={20}/></button>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-white/80">SIMPATIK FOR STUDENTS</p><h1 className="truncate text-lg font-black sm:text-xl">{activeLabel}</h1></div>
            </header>
          )}
          {activeMenu === 'dashboard' && (
          <section aria-label="Ringkasan perkembangan siswa" className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            {[
              { label: 'Perkembangan Akademik', icon: GraduationCap, detail: 'Ringkasan nilai belajar' },
              { label: 'Persentase Kehadiran', icon: CalendarDays, detail: 'Rekap kehadiran siswa' },
              { label: 'Bacaan Sholat', icon: BookOpen, detail: 'Progres penguasaan bacaan' },
            ].map(item => { const Icon = item.icon; return (
              <article key={item.label} className="rounded-2xl border border-[#D9EEE2] bg-white p-3 shadow-sm min-[420px]:p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F7EC] text-[#087F49]"><Icon size={18}/></span>
                  <h2 className="min-w-0 text-xs font-extrabold leading-4 text-slate-700">{item.label}</h2>
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight text-slate-400">—</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Data belum tersedia</p>
              </article>
            ); })}
          </section>
          )}
          <section className="mt-4 min-w-0 pb-24">
            {renderContent()}
          </section>
        </div>


              <nav aria-label="Menu utama siswa" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D9EEE2] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(8,127,73,0.08)] backdrop-blur">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {[
              { id: 'dashboard', label: 'Home', icon: GraduationCap },
              { id: 'ujian-form', label: 'Ujian', icon: ClipboardCheck },
              { id: 'profil', label: 'Profil', icon: UserRound },
              { id: 'keamanan', label: 'Akun', icon: ShieldCheck },
            ].map(item => { const Icon = item.icon; const selected = activeMenu === item.id; return (
              <button key={item.id} type="button" onClick={() => selectMenu(item.id as StudentMenu)} aria-current={selected ? 'page' : undefined} className={'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-extrabold transition '+(selected ? 'bg-[#E3F7EC] text-[#087F49]' : 'text-slate-500 hover:bg-[#F5FBF7]')}>
                <Icon size={20} strokeWidth={selected ? 2.5 : 2}/><span>{item.label}</span>
              </button>
            ); })}
          </div>
        </nav>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#E7F8EF] via-[#F9FCFA] to-[#EAF5EF] px-4 py-8">
      <section className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/90 bg-white shadow-[0_24px_75px_rgba(8,127,73,0.14)]">
        <header className="bg-gradient-to-br from-[#087640] via-[#0B8F4D] to-[#20A968] px-6 py-9 text-center text-white">
          <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center"><img src={`${import.meta.env.BASE_URL}logo-alwasi.png`} alt="Logo SMP Islam Al-Wasi’" className="h-full w-full object-contain"/></div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/85">SMP Islam Al-Wasi’</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">SIMPATIK for Student</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/90">Selamat datang siswa-siswi terbaik SMP Islam Al-Wasi’</p>
        </header>
        <div className="grid gap-3 p-5 sm:p-6">
          <button type="button" onClick={() => { setMessage(''); setView('register'); }} className="group flex w-full items-center gap-4 rounded-2xl border border-[#D9EEE2] p-4 text-left transition hover:border-[#0B8F4D] hover:bg-[#F5FCF7]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E3F7EC] text-[#087F49]"><UserRound size={23}/></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-slate-800">Mendaftar</span><span className="mt-1 block text-xs leading-5 text-slate-500">Isi NISN, nama lengkap, dan pilih kelas. Tunggu persetujuan admin.</span></span><ArrowRight className="text-[#087F49]" size={19}/>
          </button>
          <button type="button" onClick={() => { setMessage(''); setView('login'); }} className="group flex w-full items-center gap-4 rounded-2xl border border-[#D9EEE2] p-4 text-left transition hover:border-[#0B8F4D] hover:bg-[#F5FCF7]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E3F7EC] text-[#087F49]"><KeyRound size={23}/></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-slate-800">Masuk</span><span className="mt-1 block text-xs leading-5 text-slate-500">Untuk siswa yang sudah disetujui admin. Masuk menggunakan NISN.</span></span><ArrowRight className="text-[#087F49]" size={19}/>
          </button>
        </div>
        {view === 'login' && <div className="border-t border-[#E7F1EA] px-5 py-5 sm:px-6"><div className="mb-3"><h2 className="font-bold text-slate-800">Masuk SIMPATIK for Student</h2><p className="mt-1 text-xs leading-5 text-slate-500">Masukkan NISN. Perangkat akan diingat setelah login berhasil.</p></div><form onSubmit={loginStudent} className="grid gap-3"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">NISN<input value={nisn} onChange={e => setNisn(e.target.value.slice(0,30))} maxLength={30} required placeholder="Masukkan NISN" className="rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#E3F7EC]"/></label>{message && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{message}</p>}<button type="submit" disabled={busy} className="rounded-xl bg-[#0B8F4D] px-4 py-3 font-bold text-white transition hover:bg-[#087640] disabled:opacity-60">{busy ? 'Memeriksa NISN…' : 'Masuk'}</button></form></div>}
        <footer className="border-t border-[#E7F1EA] px-5 py-4 text-center text-[11px] text-slate-400">Qurani, Ramah Anak dan Berkarakter · SIMPATIK</footer>
      </section>
    </main>
  );
};
