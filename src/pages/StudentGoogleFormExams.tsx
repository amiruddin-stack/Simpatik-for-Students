import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { CalendarClock, CheckCircle2, FileText, ShieldAlert, Timer } from 'lucide-react';
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
    const q = query(collection(db, 'googleFormExams'), where('classLevel', '==', classLevel), where('status', '==', 'Aktif'));
    const stop = onSnapshot(q, snapshot => {
      const nowValue = Date.now();
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as StudentFormExam))
        .filter(item => {
          const scheduleOn = item.enableSchedule ?? Boolean(item.startAt || item.endAt);
          return !scheduleOn || ((!item.startAt || new Date(item.startAt).getTime() <= nowValue) && (!item.endAt || new Date(item.endAt).getTime() >= nowValue));
        });
      setExams(rows);
      if (examRoomId && rows.some(item => item.id === examRoomId)) setSelectedId(examRoomId);
      setLoading(false);
    }, error => {
      console.error('Gagal memuat daftar Ujian Form siswa:', error);
      setLoading(false);
    });
    return stop;
  }, [classLevel, examRoomId]);

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

  const startExam = () => {
    if (!selected || !storageKey || attempt) return;
    const next: ExamAttempt = { startedAt: Date.now(), lockUntil: 0, violations: 0, lastExitAt: 0 };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      localStorage.setItem(activeKey, JSON.stringify({ examId: selected.id, title: selected.title, startedAt: next.startedAt }));
    } catch (error) {
      console.error('Gagal menyimpan awal ujian:', error);
    }
    setAttempt(next);
    setNow(Date.now());
    setOpenError('');
    onEnterExam(selected.id);
    window.dispatchEvent(new Event('simpatik-exam-start'));
  };

  const continueExam = () => {
    if (!selected || !attempt) return;
    try { localStorage.setItem('simpatik_exam_resume_request_' + selected.id, String(Date.now())); } catch (error) { console.error('Gagal menandai lanjut ujian:', error); }
    setOpenError('');
    onEnterExam(selected.id);
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
    if (loading || !selected || !attempt) return <main className="flex min-h-screen items-center justify-center bg-[#F7FBF8] p-5 text-center text-sm font-semibold text-slate-500">Menyiapkan ruang ujian SIMPATIK…</main>;
    if (attempt.completedAt) return <main className="fixed inset-0 z-40 flex h-[100dvh] w-screen items-center justify-center overflow-auto bg-[#F7FBF8] p-5"><section className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm"><CheckCircle2 className="mx-auto text-emerald-600" size={42}/><h1 className="mt-3 text-xl font-black text-slate-800">Ujian telah ditandai selesai</h1><p className="mt-2 text-sm leading-6 text-slate-500">Terima kasih. Status ini merupakan konfirmasi dari siswa; SIMPATIK tidak dapat membaca tombol Kirim Google Forms secara langsung.</p><button type="button" onClick={returnToStudentPortal} className="mt-5 w-full rounded-xl bg-[#087F49] px-4 py-3 text-sm font-extrabold text-white">Kembali ke Dashboard</button></section></main>;
    return (
      <main className="fixed inset-0 z-40 h-[100dvh] w-screen overflow-hidden bg-[#F7FBF8]">
        {timeWarningOpen && <div role="alert" className="fixed right-3 top-[80px] z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">Peringatan waktu ujian</p><p className="mt-2 text-sm leading-6">Waktu pengerjaan tinggal <strong>10 menit</strong>. Segera periksa jawaban dan tekan tombol <strong>Kirim</strong> pada Google Form sebelum waktu habis.</p></div><button type="button" aria-label="Tutup peringatan" onClick={() => setTimeWarningOpen(false)} className="shrink-0 rounded-lg px-2 py-1 text-lg font-bold text-amber-900 hover:bg-amber-100">×</button></div><button type="button" onClick={() => setTimeWarningOpen(false)} className="mt-3 rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white hover:bg-amber-900">Mengerti</button></div>}
        <header className="fixed inset-x-0 top-0 z-50 w-full bg-[#087F49] px-3 pb-2 pt-[max(7px,env(safe-area-inset-top))] text-white shadow-md">
          <div className="relative mb-1 flex items-center justify-center">
            <h1 className="text-center text-sm font-black tracking-wider">SIMPATIK EXAM</h1>

          </div>
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[11px] font-semibold text-emerald-50">{studentName}</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-black leading-tight">{selected.title}</p>
            </div>
            <div className="shrink-0 text-right"><p className="text-[9px] font-bold tracking-wider text-emerald-100">SISA WAKTU</p><p className="text-xl font-black tabular-nums leading-6">{selected.enableCountdown !== false ? timeLabel : '—'}</p></div>
          </div>
        </header>
        <section className="absolute inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] top-[calc(70px+env(safe-area-inset-top))] overflow-hidden bg-white">
          {isLocked && <div role="alertdialog" aria-modal="true" className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-5"><div className="w-full max-w-md rounded-3xl border-2 border-amber-300 bg-white p-7 text-center shadow-2xl"><ShieldAlert className="mx-auto text-amber-600" size={54}/><h2 className="mt-4 text-xl font-black text-slate-900">Penalti Perpindahan Tab</h2><p className="mt-2 text-sm leading-6 text-slate-600">Ruang ujian dikunci sementara. Jangan berpindah aplikasi atau tab.</p><p className="mt-5 text-5xl font-black tabular-nums text-rose-600">{formatTime(remainingPenalty)}</p><p className="mt-3 text-xs font-bold text-slate-500">Total pelanggaran: {attempt.violations}</p><p className="mt-2 text-xs text-slate-500">Pop-up ini akan hilang otomatis setelah waktu penalti selesai.</p></div></div>}
          {examExpired && <div className="absolute inset-0 z-30 flex items-center justify-center bg-rose-50 p-5 text-center"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-lg"><h2 className="text-xl font-black text-rose-800">Waktu ujian telah habis</h2><p className="mt-2 text-sm text-slate-600">Selesaikan konfirmasi untuk menandai ujian telah berakhir.</p></div></div>}
          {!isLocked && !examExpired && <iframe title={selected.title} src={selectedFormUrl} className="block h-full w-full border-0 bg-white" referrerPolicy="strict-origin-when-cross-origin" allow="camera; microphone; geolocation"/>}
        </section>
        <footer className="fixed inset-x-0 bottom-0 z-50 w-full bg-white px-3 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"><button type="button" onClick={() => setConfirmStep(1)} disabled={Boolean(attempt.completedAt)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#087F49] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"><CheckCircle2 size={18}/> Selesaikan Ujian</button></footer>
        {confirmStep > 0 && <div role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#087F49]"><CheckCircle2 size={30}/></div>{confirmStep === 1 ? <><h2 id="exam-confirm-title" className="mt-4 text-center text-lg font-black text-slate-900">Apakah Anda telah mengirim jawaban Google Form?</h2><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setConfirmStep(2)} className="rounded-xl bg-[#087F49] px-4 py-3 text-sm font-extrabold text-white">Ya</button><button type="button" onClick={() => setConfirmStep(0)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700">Belum</button></div></> : <><h2 id="exam-confirm-title" className="mt-4 text-center text-lg font-black text-slate-900">Yakin selesaikan ujian?</h2><p className="mt-2 text-center text-sm leading-6 text-slate-500">Setelah dikonfirmasi, ruang ujian akan ditandai selesai.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => { setConfirmStep(0); finishExam(); }} className="rounded-xl bg-[#087F49] px-4 py-3 text-sm font-extrabold text-white">Ya</button><button type="button" onClick={() => setConfirmStep(0)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-700">Kembali Ke Ujian</button></div></>}</div></div>}
      </main>
    );

  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D5EADB] bg-[#F2FBF5] p-4"><h2 className="font-extrabold text-slate-800">Ujian G-Form</h2><p className="mt-1 text-xs leading-5 text-slate-500">Pilih ujian untuk kelas {className}. Tekan Mulai Ujian saat sudah siap.</p></div>
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Memuat ujian…</div> : exams.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-7 text-center"><FileText size={28} className="mx-auto text-slate-300"/><p className="mt-2 text-sm font-bold text-slate-600">Belum ada ujian aktif</p><p className="mt-1 text-xs text-slate-400">Ujian dari guru akan muncul di sini sesuai kelas.</p></div> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">{exams.map(exam => <button key={exam.id} type="button" onClick={() => setSelectedId(exam.id)} className={'rounded-xl border p-4 text-left transition ' + (selectedId === exam.id ? 'border-[#0B8F4D] bg-[#F2FBF5] ring-2 ring-[#D5EADB]' : 'border-slate-200 bg-white hover:border-emerald-300')}><span className="text-sm font-extrabold text-slate-800">{exam.title}</span><span className="mt-1 block text-xs text-slate-500">{exam.subject} · {exam.duration || 60} menit</span>{exam.endAt && <span className="mt-2 flex items-center gap-1 text-[11px] text-slate-400"><CalendarClock size={13}/> Batas: {new Date(exam.endAt).toLocaleString('id-ID')}</span>}</button>)}</div>
          {selected && !selectedFormUrl && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Tautan Google Form belum valid. Guru perlu memeriksa tautan ujian di SIMPATIK.</div>}
          {selected && selectedFormUrl && !started && <section className="rounded-2xl border border-[#D5EADB] bg-white p-4 shadow-sm"><h3 className="text-sm font-extrabold text-slate-800">{selected.title}</h3><p className="mt-1 text-xs text-slate-500">{selected.subject} · {selected.examType || 'Ujian Form'}</p><p className="mt-3 text-xs leading-5 text-slate-600">Saat menekan Mulai Ujian, halaman akan berpindah ke ruang ujian di dalam aplikasi SIMPATIK. Waktu ujian dimulai pada saat itu.</p><button type="button" onClick={startExam} className="mt-4 w-full rounded-xl bg-[#087F49] px-4 py-3 text-sm font-extrabold text-white">Mulai Ujian</button>{openError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">{openError}</p>}</section>}
          {selected && started && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-extrabold text-emerald-800"><CheckCircle2 size={18}/> Ujian sedang berlangsung</div><p className="mt-2 text-xs leading-5 text-emerald-800">Lanjutkan ujian di ruang ujian aplikasi. Jawaban dan waktu ujian tetap tersimpan; tidak membuat sesi baru. Pelanggaran tercatat: {attempt?.violations || 0}.</p><button type="button" onClick={continueExam} className="mt-3 w-full rounded-xl bg-[#087F49] px-4 py-3 text-sm font-extrabold text-white">Lanjutkan Ujian</button>{openError && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">{openError}</p>}</section>}
        </>
      )}
      <p className="text-[11px] leading-5 text-slate-400">Status dan waktu ujian disimpan di perangkat siswa. Penalti bergantung pada kemampuan browser mendeteksi perpindahan tab/aplikasi. Google Forms berasal dari layanan Google sehingga SIMPATIK tidak dapat membaca secara langsung apakah tombol Kirim sudah berhasil ditekan.</p>
    </div>
  );
};
