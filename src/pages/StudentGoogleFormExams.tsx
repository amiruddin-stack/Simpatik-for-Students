import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardList, Clock3, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { db } from '../firebase/config';
import { getClassLevel } from '../lib/classes';

type StudentFormExam = {
  id: string;
  title: string;
  examType?: string;
  subject: string;
  className: string;
  classLevel: string;
  formUrl: string;
  enableSchedule?: boolean;
  startAt?: string;
  endAt?: string;
  enableCountdown?: boolean;
  duration?: number;
  questionCount?: number;
  totalQuestions?: number;
  enablePenalty?: boolean;
  status: string;
};

type ExamAttempt = { startedAt: number; lockUntil: number; violations: number; lastExitAt: number; completedAt?: number };

const NISN_PREFILL_MARKER = 'SIMPATIK_NISN_PREFILL';
const PENALTY_MS = 3 * 60 * 1000;

function embedUrl(value: string, nisn: string, studentId: string, studentName: string, className: string) {
  try {
    const url = new URL(value);
    const isShortGoogleFormLink = url.hostname === 'forms.gle' && url.pathname.length > 1;
    const isRespondentGoogleFormLink =
      ['docs.google.com', 'forms.google.com'].includes(url.hostname) &&
      /^\/forms\/(?:d\/e\/[^/]+|d\/[^/]+)\/viewform\/?$/.test(url.pathname);
    if (!isShortGoogleFormLink && !isRespondentGoogleFormLink) return '';
    const nisnEntry = Array.from(url.searchParams.keys()).find(key =>
      /^entry\.\d+$/.test(key) && url.searchParams.get(key) === NISN_PREFILL_MARKER
    );
    const codeEntry = Array.from(url.searchParams.keys()).find(key =>
      /^entry\.\d+$/.test(key) && url.searchParams.get(key) === 'SIMPATIK_CODE_PREFILL'
    );
    const nameEntry = Array.from(url.searchParams.keys()).find(key =>
      /^entry\.\d+$/.test(key) && url.searchParams.get(key) === 'SIMPATIK_NAME_PREFILL'
    );
    const classEntry = Array.from(url.searchParams.keys()).find(key =>
      /^entry\.\d+$/.test(key) && url.searchParams.get(key) === 'SIMPATIK_CLASS_PREFILL'
    );
    if (nisnEntry && nisn.trim()) url.searchParams.set(nisnEntry, nisn.trim());
    if (codeEntry && studentId.trim()) url.searchParams.set(codeEntry, studentId.trim());
    if (nameEntry && studentName.trim()) url.searchParams.set(nameEntry, studentName.trim());
    if (classEntry && className.trim()) url.searchParams.set(classEntry, className.trim());
    url.searchParams.set('embedded', 'true');
    return url.toString();
  } catch {
    return '';
  }
}

function attemptStorageKey(examId: string, studentId: string, nisn: string) {
  return 'simpatik_gform_attempt_' + examId + '_' + (studentId || nisn);
}

function activeExamStorageKey(studentId: string) {
  return 'simpatik_active_gform_' + studentId;
}

function readAttempt(key: string): ExamAttempt | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as ExamAttempt : null;
  } catch {
    return null;
  }
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

export const StudentGoogleFormExams: React.FC<{
  className: string;
  nisn: string;
  studentId: string;
  studentName: string;
  examRoomId?: string;
  onEnterExam: (examId: string) => void;
  onExitExam: () => void;
}> = ({ className, nisn, studentId, studentName, examRoomId, onEnterExam, onExitExam }) => {
  const classLevel = getClassLevel(className);
  const examRoom = Boolean(examRoomId);
  const [exams, setExams] = useState<StudentFormExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(examRoomId || '');
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [now, setNow] = useState(Date.now());
  const [openError, setOpenError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'finished'>('active');
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [timeWarningOpen, setTimeWarningOpen] = useState(false);
  const timeWarningExamRef = useRef('');
  const selected = exams.find(item => item.id === selectedId);
  const storageKey = selected ? attemptStorageKey(selected.id, studentId, nisn) : '';
  const selectedFormUrl = selected ? embedUrl(selected.formUrl, nisn, studentId, studentName, className) : '';
  const started = Boolean(attempt && !attempt.completedAt);
  const countdownEndsAt = attempt && selected?.enableCountdown !== false ? attempt.startedAt + (Math.max(1, selected?.duration || 60) * 60 * 1000) : 0;
  const remainingExam = countdownEndsAt ? Math.max(0, countdownEndsAt - now) : Infinity;
  const remainingPenalty = attempt ? Math.max(0, attempt.lockUntil - now) : 0;
  const examExpired = countdownEndsAt > 0 && remainingExam <= 0;
  const isLocked = Boolean(selected?.enablePenalty && remainingPenalty > 0);
  const timeLabel = useMemo(() => formatTime(remainingExam), [remainingExam]);
  const activeKey = activeExamStorageKey(studentId);

  useEffect(() => {
    if (!classLevel) { setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    const q = query(collection(db, 'googleFormExams'), where('classLevel', '==', classLevel), where('status', '==', 'Aktif'));
    const stop = onSnapshot(q, snapshot => {
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as StudentFormExam));
      setExams(rows);
      if (examRoomId && rows.some(item => item.id === examRoomId)) setSelectedId(examRoomId);
      setLoading(false);
      setLoadError('');
    }, error => {
      console.error('Gagal memuat daftar Ujian Form siswa:', error);
      setLoadError('Daftar ujian belum dapat dimuat. Periksa koneksi internet, lalu coba lagi.');
      setLoading(false);
    });
    return stop;
  }, [classLevel, examRoomId, retryCount]);

  useEffect(() => {
    setAttempt(selected && storageKey ? readAttempt(storageKey) : null);
  }, [selectedId, storageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!examRoom || !started || !selected || selected.enableCountdown === false || remainingExam <= 0 || remainingExam > 10 * 60 * 1000) return;
    if (timeWarningExamRef.current !== selected.id) {
      timeWarningExamRef.current = selected.id;
      setTimeWarningOpen(true);
    }
  }, [examRoom, started, selected?.id, selected?.enableCountdown, remainingExam]);

  useEffect(() => {
    if (!examRoom || !selected || !attempt || !selected.enablePenalty || examExpired || attempt.completedAt) return;
    let lastHandled = attempt.lastExitAt || 0;
    const registerExit = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) return;
      const stamp = Date.now();
      try {
        const resumeKey = 'simpatik_exam_resume_request_' + selected.id;
        const resumeRequest = Number(localStorage.getItem(resumeKey) || 0);
        if (resumeRequest && stamp - resumeRequest < 5000) { localStorage.removeItem(resumeKey); return; }
      } catch (error) { console.warn('Gagal membaca permintaan lanjut ujian:', error); }
      if (stamp - lastHandled < 1800) return;
      lastHandled = stamp;
      setAttempt(current => {
        if (!current || current.completedAt) return current;
        const next: ExamAttempt = {
          ...current,
          violations: current.violations + 1,
          lockUntil: Math.max(stamp, current.lockUntil) + PENALTY_MS,
          lastExitAt: stamp
        };
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (error) { console.error('Gagal menyimpan status ujian lokal:', error); }
        return next;
      });
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') registerExit(); };
    const onBlur = () => registerExit();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [examRoom, selected?.id, attempt?.startedAt, attempt?.lastExitAt, selected?.enablePenalty, examExpired, storageKey]);

  useEffect(() => {
    if (!examRoom || !storageKey) return;
    const syncAttempt = (event: StorageEvent) => {
      if (event.key === storageKey) setAttempt(readAttempt(storageKey));
    };
    window.addEventListener('storage', syncAttempt);
    return () => window.removeEventListener('storage', syncAttempt);
  }, [examRoom, storageKey]);

  const startExam = (exam: StudentFormExam | null | undefined = selected) => {
    if (!exam) return;
    const examStorageKey = attemptStorageKey(exam.id, studentId, nisn);
    const existingAttempt = readAttempt(examStorageKey);
    if (existingAttempt) {
      setSelectedId(exam.id);
      setAttempt(existingAttempt);
      return;
    }
    const next: ExamAttempt = { startedAt: Date.now(), lockUntil: 0, violations: 0, lastExitAt: 0 };
    try {
      localStorage.setItem(examStorageKey, JSON.stringify(next));
      localStorage.setItem(activeKey, JSON.stringify({ examId: exam.id, title: exam.title, startedAt: next.startedAt }));
    } catch (error) {
      console.error('Gagal menyimpan awal ujian:', error);
    }
    setSelectedId(exam.id);
    setAttempt(next);
    setNow(Date.now());
    setOpenError('');
    onEnterExam(exam.id);
    window.dispatchEvent(new Event('simpatik-exam-start'));
  };

  const continueExam = (exam: StudentFormExam | null | undefined = selected) => {
    if (!exam) return;
    const examAttempt = readAttempt(attemptStorageKey(exam.id, studentId, nisn));
    if (!examAttempt || examAttempt.completedAt) return;
    try { localStorage.setItem('simpatik_exam_resume_request_' + exam.id, String(Date.now())); } catch (error) { console.error('Gagal menandai lanjut ujian:', error); }
    setSelectedId(exam.id);
    setAttempt(examAttempt);
    setOpenError('');
    onEnterExam(exam.id);
  };

  const finishExam = () => {
    if (!attempt || !storageKey) return;
    const next = { ...attempt, completedAt: Date.now() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      localStorage.removeItem(activeKey);
    } catch (error) {
      console.error('Gagal menyimpan status selesai ujian:', error);
    }
    setAttempt(next);
    window.dispatchEvent(new Event('simpatik-exam-finish'));
  };

  const returnToStudentPortal = () => {
    onExitExam();
  };

  if (examRoom) {
    if (loading || !selected || !attempt) return <main className="flex min-h-screen items-center justify-center bg-[#f7f9fb] p-5 text-center text-sm font-semibold text-slate-500">Menyiapkan ruang ujian SIMPATIK…</main>;
    if (attempt.completedAt) return <main className="fixed inset-0 z-40 flex h-[100dvh] w-screen items-center justify-center overflow-auto bg-[#f7f9fb] p-5"><section className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm"><CheckCircle2 className="mx-auto text-blue-600" size={42}/><h1 className="mt-3 text-xl font-black text-slate-800">Ujian telah ditandai selesai</h1><p className="mt-2 text-sm leading-6 text-slate-500">Terima kasih. Status ini merupakan konfirmasi dari siswa; SIMPATIK tidak dapat membaca tombol Kirim Google Forms secara langsung.</p><button type="button" onClick={returnToStudentPortal} className="mt-5 w-full rounded-xl bg-[#08387f] px-4 py-3 text-sm font-extrabold text-white">Kembali ke Dashboard</button></section></main>;
    return (
      <main className="fixed inset-0 z-40 h-[100dvh] w-screen overflow-hidden bg-[#f7f9fb]">
        {timeWarningOpen && <div role="alert" className="fixed right-3 top-[80px] z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">Peringatan waktu ujian</p><p className="mt-2 text-sm leading-6">Waktu pengerjaan tinggal <strong>10 menit</strong>. Segera periksa jawaban dan tekan tombol <strong>Kirim</strong> pada Google Form sebelum waktu habis.</p></div><button type="button" aria-label="Tutup peringatan" onClick={() => setTimeWarningOpen(false)} className="shrink-0 rounded-lg px-2 py-1 text-lg font-bold text-amber-900 hover:bg-amber-100">×</button></div><button type="button" onClick={() => setTimeWarningOpen(false)} className="mt-3 rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white hover:bg-amber-900">Mengerti</button></div>}
        <header className="fixed inset-x-0 top-0 z-50 w-full bg-[#08387f] px-3 pb-2 pt-[max(7px,env(safe-area-inset-top))] text-white shadow-md">
          <div className="relative mb-1 flex items-center justify-center">
            <h1 className="text-center text-sm font-black tracking-wider">SIMPATIK EXAM</h1>

          </div>
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[11px] font-semibold text-blue-50">{studentName}</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-black leading-tight">{selected.title}</p>
            </div>
            <div className="shrink-0 text-right"><p className="text-[9px] font-bold tracking-wider text-blue-100">SISA WAKTU</p><p className="text-xl font-black tabular-nums leading-6">{selected.enableCountdown !== false ? timeLabel : '—'}</p></div>
          </div>
        </header>
        <section className="absolute inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] top-[calc(70px+env(safe-area-inset-top))] overflow-hidden bg-white">
          {isLocked && <div role="alertdialog" aria-modal="true" className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-5"><div className="w-full max-w-md rounded-3xl border-2 border-amber-300 bg-white p-7 text-center shadow-2xl"><ShieldAlert className="mx-auto text-amber-600" size={54}/><h2 className="mt-4 text-xl font-black text-slate-900">Penalti Perpindahan Tab</h2><p className="mt-2 text-sm leading-6 text-slate-600">Ruang ujian dikunci sementara. Jangan berpindah aplikasi atau tab.</p><p className="mt-5 text-5xl font-black tabular-nums text-rose-600">{formatTime(remainingPenalty)}</p><p className="mt-3 text-xs font-bold text-slate-500">Total pelanggaran: {attempt.violations}</p><p className="mt-2 text-xs text-slate-500">Pop-up ini akan hilang otomatis setelah waktu penalti selesai.</p></div></div>}
          {examExpired && <div className="absolute inset-0 z-30 flex items-center justify-center bg-rose-50 p-5 text-center"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-lg"><h2 className="text-xl font-black text-rose-800">Waktu ujian telah habis</h2><p className="mt-2 text-sm text-slate-600">Selesaikan konfirmasi untuk menandai ujian telah berakhir.</p></div></div>}
          {!isLocked && !examExpired && <iframe title={selected.title} src={selectedFormUrl} className="block h-full w-full border-0 bg-white" referrerPolicy="strict-origin-when-cross-origin" allow="camera; microphone; geolocation"/>}
        </section>
        <footer className="fixed inset-x-0 bottom-0 z-50 w-full bg-white px-3 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"><button type="button" onClick={() => setConfirmStep(1)} disabled={Boolean(attempt.completedAt)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#08387f] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"><CheckCircle2 size={18}/> Selesaikan Ujian</button></footer>
        {confirmStep > 0 && <div role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#08387f]"><CheckCircle2 size={30}/></div>{confirmStep === 1 ? <><h2 id="exam-confirm-title" className="mt-4 text-center text-lg font-black text-slate-900">Apakah Anda telah mengirim jawaban Google Form?</h2><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setConfirmStep(2)} className="rounded-xl bg-[#08387f] px-4 py-3 text-sm font-extrabold text-white">Ya</button><button type="button" onClick={() => setConfirmStep(0)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700">Belum</button></div></> : <><h2 id="exam-confirm-title" className="mt-4 text-center text-lg font-black text-slate-900">Yakin selesaikan ujian?</h2><p className="mt-2 text-center text-sm leading-6 text-slate-500">Setelah dikonfirmasi, ruang ujian akan ditandai selesai.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => { setConfirmStep(0); finishExam(); }} className="rounded-xl bg-[#08387f] px-4 py-3 text-sm font-extrabold text-white">Ya</button><button type="button" onClick={() => setConfirmStep(0)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-700">Kembali Ke Ujian</button></div></>}</div></div>}
      </main>
    );

  }

  const getExamAttempt = (exam: StudentFormExam) => readAttempt(attemptStorageKey(exam.id, studentId, nisn));
  const getScheduleStart = (exam: StudentFormExam) => exam.startAt ? new Date(exam.startAt).getTime() : 0;
  const getScheduleEnd = (exam: StudentFormExam) => exam.endAt ? new Date(exam.endAt).getTime() : 0;
  const upcomingExams = exams.filter(exam => {
    const startedAttempt = getExamAttempt(exam);
    return !startedAttempt?.completedAt && Boolean(exam.startAt) && getScheduleStart(exam) > now;
  });
  const finishedExams = exams.filter(exam => Boolean(getExamAttempt(exam)?.completedAt));
  const activeExams = exams.filter(exam => {
    const savedAttempt = getExamAttempt(exam);
    const end = getScheduleEnd(exam);
    return !savedAttempt?.completedAt && getScheduleStart(exam) <= now && (!end || end >= now);
  });
  const visibleExams = activeTab === 'active' ? activeExams : activeTab === 'upcoming' ? upcomingExams : finishedExams;
  const formatDate = (value: string | number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
    new Intl.DateTimeFormat('id-ID', options).format(new Date(value));
  const formatDeadline = (value?: string) => value ? formatDate(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Tidak ditentukan';
  const formatDateParts = (value: string) => ({
    day: formatDate(value, { day: '2-digit' }),
    month: formatDate(value, { month: 'short' }).replace('.', '').toUpperCase(),
  });

  return (
    <div className="min-w-0 space-y-5 pb-[calc(88px+env(safe-area-inset-bottom))] text-[#0F172A]">
      <header className="space-y-1">
        <h1 className="text-[22px] font-bold leading-7 tracking-tight text-[#0F172A]">Ujian</h1>
        <p className="text-xs text-[#64748B]">Daftar ujian untuk kelas {className}</p>
      </header>

      <div role="tablist" aria-label="Status ujian" className="grid grid-cols-3 rounded-2xl bg-[#E2E8F0] p-1">
        {[
          { id: 'active' as const, label: 'Aktif', count: activeExams.length },
          { id: 'upcoming' as const, label: 'Mendatang' },
          { id: 'finished' as const, label: 'Selesai' },
        ].map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
            className={'min-h-11 rounded-xl px-2 text-xs font-bold transition-colors duration-200 ' + (activeTab === tab.id ? 'bg-white text-[#163665] shadow-sm' : 'text-[#64748B] hover:text-[#334155]')}>
            {tab.label}{tab.count !== undefined ? ' (' + tab.count + ')' : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Memuat daftar ujian" aria-busy="true">
          {[0, 1].map(item => <div key={item} className="animate-pulse rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="h-5 w-32 rounded-full bg-slate-200"/>
            <div className="mt-4 h-6 w-3/4 rounded-lg bg-slate-200"/>
            <div className="mt-3 h-4 w-1/2 rounded-lg bg-slate-100"/>
            <div className="mt-5 grid grid-cols-3 gap-2">{[0, 1, 2].map(cell => <div key={cell} className="h-14 rounded-xl bg-slate-100"/>)}</div>
            <div className="mt-4 h-12 rounded-xl bg-slate-200"/>
          </div>)}
        </div>
      ) : loadError ? (
        <section role="alert" className="rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
          <CircleAlert size={28} className="mx-auto text-rose-500"/>
          <p className="mt-3 text-sm font-semibold text-[#334155]">{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); setRetryCount(value => value + 1); }} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#163665] px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#154080]">
            <RefreshCw size={16}/> Coba lagi
          </button>
        </section>
      ) : visibleExams.length === 0 ? (
        <section className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-5 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dce9fc] text-[#163665]">
            {activeTab === 'active' ? <ClipboardList size={22}/> : activeTab === 'upcoming' ? <CalendarDays size={22}/> : <CheckCircle2 size={22}/>}
          </span>
          <p className="mt-3 text-sm font-semibold text-[#334155]">
            {activeTab === 'active' ? 'Tidak ada ujian aktif saat ini' : activeTab === 'upcoming' ? 'Tidak ada ujian mendatang' : 'Belum ada ujian yang selesai'}
          </p>
        </section>
      ) : activeTab === 'active' ? (
        <div className="space-y-4">
          {activeExams.map(exam => {
            const savedAttempt = getExamAttempt(exam);
            const inProgress = Boolean(savedAttempt && !savedAttempt.completedAt);
            const questionCount = Number(exam.questionCount ?? exam.totalQuestions ?? 0);
            const examUrl = embedUrl(exam.formUrl, nisn, studentId, studentName, className);
            return (
              <article key={exam.id} className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#163665] to-[#154080] p-4 text-white shadow-[0_12px_26px_rgba(22,101,52,0.16)]">
                <div className="inline-flex rounded-full bg-[#FBBF24] px-3 py-1 text-[11px] font-bold text-[#422006]">Sedang berlangsung</div>
                <h2 className="mt-3 text-xl font-bold leading-6 text-white">{exam.title}</h2>
                <p className="mt-1 text-xs text-white/85">{exam.subject || 'Ujian'} · Kelas {exam.className}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/12 px-2 py-3 text-center">
                    <ClipboardList size={17} className="mx-auto text-white/85"/>
                    <p className="mt-1 text-sm font-bold text-white">{questionCount > 0 ? questionCount : 'Tidak tersedia'}</p>
                    <p className="mt-0.5 text-[10px] text-white/75">Jumlah soal</p>
                  </div>
                  <div className="rounded-xl bg-white/12 px-2 py-3 text-center">
                    <Clock3 size={17} className="mx-auto text-white/85"/>
                    <p className="mt-1 text-sm font-bold text-white">{exam.duration || 60} menit</p>
                    <p className="mt-0.5 text-[10px] text-white/75">Durasi</p>
                  </div>
                  <div className="rounded-xl bg-white/12 px-2 py-3 text-center">
                    <CalendarDays size={17} className="mx-auto text-white/85"/>
                    <p className="mt-1 text-xs font-bold text-white">{formatDeadline(exam.endAt)}</p>
                    <p className="mt-0.5 text-[10px] text-white/75">Batas akhir</p>
                  </div>
                </div>
                {!examUrl ? (
                  <div role="alert" className="mt-4 rounded-xl bg-white/15 px-3 py-3 text-xs leading-5 text-white">Tautan ujian belum valid. Hubungi guru untuk memeriksanya.</div>
                ) : (
                  <button type="button" onClick={() => inProgress ? continueExam(exam) : startExam(exam)} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#163665] transition-colors duration-200 hover:bg-[#f0f5fd]">
                    {inProgress ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                  </button>
                )}
                {openError && selectedId === exam.id && <p role="alert" className="mt-3 rounded-lg bg-white/15 p-3 text-xs font-semibold text-white">{openError}</p>}
              </article>
            );
          })}
        </div>
      ) : activeTab === 'upcoming' ? (
        <div className="space-y-3">
          {upcomingExams.map(exam => {
            const dateParts = formatDateParts(exam.startAt!);
            return (
              <article key={exam.id} className="flex gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
                <div className="flex w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#dce9fc] px-2 py-3 text-[#163665]">
                  <span className="text-2xl font-bold leading-7">{dateParts.day}</span>
                  <span className="mt-0.5 text-[10px] font-bold tracking-wide">{dateParts.month}</span>
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <h2 className="text-sm font-semibold leading-5 text-[#0F172A]">{exam.title}</h2>
                  <p className="mt-1 text-xs text-[#64748B]">{formatDate(exam.startAt!, { hour: '2-digit', minute: '2-digit' })} · {exam.duration || 60} menit</p>
                  <p className="mt-1 text-xs text-[#64748B]">{exam.subject || 'Ujian'} · Kelas {exam.className}</p>
                  <span className="mt-2 inline-flex rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">Terjadwal</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {finishedExams.map(exam => {
            const savedAttempt = getExamAttempt(exam);
            return (
              <article key={exam.id} className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dce9fc] text-[#163665]"><CheckCircle2 size={21}/></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold leading-5 text-[#0F172A]">{exam.title}</h2>
                  <p className="mt-1 text-xs text-[#64748B]">{savedAttempt?.completedAt ? 'Selesai ' + formatDate(savedAttempt.completedAt) : 'Selesai'}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#dce9fc] px-3 py-1.5 text-xs font-bold text-[#163665]">Menunggu nilai</span>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-5 text-[#64748B]">Status dan waktu ujian disimpan di perangkat siswa. Penalti bergantung pada kemampuan browser mendeteksi perpindahan tab/aplikasi. Google Forms berasal dari layanan Google sehingga SIMPATIK tidak dapat membaca secara langsung apakah tombol Kirim sudah berhasil ditekan.</p>
    </div>
  );
};
