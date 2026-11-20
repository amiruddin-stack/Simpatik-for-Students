import React, { useState } from 'react';
import { GraduationCap, Share2, ArrowUpRight, ChevronRight, Copy, ArrowLeft, Users, ClipboardCheck, BookOpen } from 'lucide-react';

export const MorePage: React.FC = () => {
  const [notice, setNotice] = useState('');
  const [showStudentInfo, setShowStudentInfo] = useState(false);

  const makeLink = (key: string) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set(key, '1');
    return url.toString();
  };

  const studentUrl = makeLink('student');

  const copyLink = async (url: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice(`Tautan ${label} berhasil disalin.`);
        return;
      }
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(field);
      setNotice(copied ? `Tautan ${label} berhasil disalin.` : 'Gagal menyalin tautan. Silakan salin secara manual.');
    } catch {
      setNotice('Gagal menyalin tautan. Silakan coba kembali.');
    }
  };

  const shareLink = async (url: string, title: string, text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await copyLink(url, title);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setNotice('Tautan belum dapat dibagikan. Silakan coba kembali.');
      }
    }
  };

  if (showStudentInfo) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <button type="button" onClick={() => { setShowStudentInfo(false); setNotice(''); }} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[#08387f] hover:bg-[#e3ebf7]">
          <ArrowLeft size={18}/> Kembali ke More
        </button>
        <div className="overflow-hidden rounded-3xl border border-[#d5ddea] bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#08387f] to-[#0b316b] px-6 py-7 text-white">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><GraduationCap size={30}/></div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">Layanan peserta didik</p>
            <h2 className="mt-2 text-2xl font-extrabold">SIMPATIK for Student</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">Portal khusus siswa-siswi SMP Islam Al-Wasi’ yang terhubung dengan layanan SIMPATIK sekolah.</p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f4f6fa] p-4"><Users size={21} className="text-[#08387f]"/><p className="mt-2 text-sm font-extrabold text-slate-800">Pendaftaran</p><p className="mt-1 text-xs leading-5 text-slate-500">Siswa mengajukan pendaftaran dan menunggu persetujuan admin.</p></div>
              <div className="rounded-2xl bg-[#f4f6fa] p-4"><ClipboardCheck size={21} className="text-[#08387f]"/><p className="mt-2 text-sm font-extrabold text-slate-800">Profil Siswa</p><p className="mt-1 text-xs leading-5 text-slate-500">Melengkapi biodata setelah akun disetujui.</p></div>
              <div className="rounded-2xl bg-[#f4f6fa] p-4"><BookOpen size={21} className="text-[#08387f]"/><p className="mt-2 text-sm font-extrabold text-slate-800">Ujian</p><p className="mt-1 text-xs leading-5 text-slate-500">Melihat ujian yang aktif sesuai kelas.</p></div>
            </div>
            <div>
              <label htmlFor="student-portal-link" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Link SIMPATIK for Student</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="student-portal-link" readOnly value={studentUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 outline-none"/>
                <button type="button" onClick={() => void copyLink(studentUrl, 'SIMPATIK for Student')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#08387f] px-4 py-3 text-sm font-bold text-white hover:bg-[#062d68]"><Copy size={17}/> Salin Link</button>
              </div>
            </div>
            <button type="button" onClick={() => void shareLink(studentUrl, 'SIMPATIK for Student', 'Silakan buka portal siswa SIMPATIK SMP Islam Al-Wasi’.')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b9c8de] bg-[#f4f6fa] px-4 py-3 text-sm font-bold text-[#08387f] hover:bg-[#e3ebf7]"><Share2 size={18}/> Bagikan Link</button>
            {notice && <p role="status" className="rounded-xl bg-[#e3ebf7] px-4 py-3 text-xs font-semibold text-[#083476]">{notice}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-3">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Layanan SIMPATIK</p>
      <button type="button" onClick={() => { setShowStudentInfo(true); setNotice(''); }} className="flex w-full items-center gap-3 rounded-2xl border border-[#d5ddea] bg-white p-4 text-left shadow-sm transition hover:border-[#8eabd6] hover:bg-[#f7f9fc]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e3ebf7] text-[#08387f]"><GraduationCap size={25}/></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-800">SIMPATIK for Student</span><span className="mt-1 block text-xs text-slate-500">Informasi portal siswa, salin dan bagikan tautan</span></span>
        <ChevronRight size={19} className="shrink-0 text-[#08387f]"/>
      </button>
      <button type="button" onClick={() => void shareLink(makeLink(''), 'SIMPATIK SMP Islam Al-Wasi’', 'Akses SIMPATIK SMP Islam Al-Wasi’.')} className="flex w-full items-center gap-3 rounded-2xl border border-[#E2E8E5] bg-white p-4 text-left shadow-sm transition hover:border-[#8eabd6] hover:bg-[#f7f9fc]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Share2 size={23}/></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-800">Bagikan Web</span><span className="mt-1 block text-xs text-slate-500">Bagikan tautan SIMPATIK kepada orang lain</span></span>
        <ArrowUpRight size={19} className="shrink-0 text-slate-400"/>
      </button>
      {notice && <p role="status" className="rounded-xl bg-[#e3ebf7] px-4 py-3 text-xs font-semibold text-[#083476]">{notice}</p>}
    </section>
  );
};
