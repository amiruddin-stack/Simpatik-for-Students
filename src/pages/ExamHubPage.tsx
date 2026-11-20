import React, { useState } from 'react';
import { ArrowLeft, ClipboardList, FileText, MonitorSmartphone } from 'lucide-react';
import { ExamPage } from './ExamPage';
import { GoogleFormExamPage } from './GoogleFormExamPage';

type ExamSection = 'home' | 'simpatik' | 'gform';

export const ExamHubPage: React.FC = () => {
  const [section, setSection] = useState<ExamSection>('home');

  if (section === 'simpatik') {
    return (
      <section className="space-y-4">
        <button type="button" onClick={() => setSection('home')} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[#087f49] hover:bg-[#e3f7ec]">
          <ArrowLeft size={18}/> Kembali ke Ujian
        </button>
        <ExamPage onBack={() => setSection('home')} />
      </section>
    );
  }

  if (section === 'gform') {
    return (
      <section className="space-y-4">
        <button type="button" onClick={() => setSection('home')} className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[#087f49] hover:bg-[#e3f7ec]">
          <ArrowLeft size={18}/> Kembali ke Ujian
        </button>
        <GoogleFormExamPage />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <p className="text-sm text-slate-500">Pilih jenis ujian yang akan dikelola. Semua fitur ujian tersedia dalam satu pintu masuk.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setSection('simpatik')} className="group rounded-2xl border border-[#bfe8cf] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#16b364] hover:shadow-md sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f7ec] text-[#087f49]"><MonitorSmartphone size={25}/></span>
          <span className="mt-4 block text-lg font-extrabold text-slate-800">Ujian SIMPATIK</span>
          <span className="mt-2 block text-sm leading-6 text-slate-500">Kelola ujian dari sistem SIMPATIK, termasuk seluruh fitur ujian yang sudah tersedia saat ini.</span>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#087f49]">Buka Ujian SIMPATIK <FileText size={16}/></span>
        </button>

        <button type="button" onClick={() => setSection('gform')} className="group rounded-2xl border border-[#C9DDF8] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md sm:p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FileText size={25}/></span>
          <span className="mt-4 block text-lg font-extrabold text-slate-800">Ujian G-Form</span>
          <span className="mt-2 block text-sm leading-6 text-slate-500">Buat, atur jadwal, pratinjau, dan kelola ujian yang menggunakan Google Forms.</span>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">Buka Ujian G-Form <FileText size={16}/></span>
        </button>
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Menu Ujian Form yang lama di navigasi utama tetap dipertahankan sementara selama masa uji coba. Menu tersebut tidak dihapus atau dinonaktifkan.</p>
    </section>
  );
};
