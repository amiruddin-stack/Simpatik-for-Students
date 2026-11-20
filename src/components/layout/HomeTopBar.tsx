import React, { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { NavTab } from './Sidebar';
import { Header } from './Header';

interface HomeTopBarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

export const HomeTopBar: React.FC<HomeTopBarProps> = ({ activeTab, onNavigate }) => {
  const [globalSearch, setGlobalSearch] = useState('');

  const handleGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = globalSearch.trim().toLowerCase();
    if (!query) return;
    const destinations: [string[], NavTab][] = [
      [['presensi', 'kehadiran', 'absen', 'hadir', 'izin', 'sakit'], 'attendance'],
      [['jurnal', 'kbm', 'pembelajaran', 'materi'], 'journal'],
      [['nilai', 'penilaian', 'tugas', 'ulangan'], 'assessment'],
      [['kelas', 'rombel'], 'classes'],
      [['mapel', 'mata pelajaran', 'kurikulum'], 'subjects'],
      [['ujian', 'soal', 'cbt', 'tes'], 'exams'],
      [['wali', 'rapor', 'rekap', 'capaian'], 'grades'],
      [['bk', 'konseling', 'bimbingan'], 'counseling'],
      [['laporan', 'cetak', 'rekapitulasi'], 'reports'],
      [['siswa', 'guru', 'data master', 'sekolah'], 'master'],
      [['perilaku', 'karakter', 'sikap', 'prestasi', 'pelanggaran'], 'behavior'],
      [['pengaturan', 'profil', 'aplikasi'], 'settings'],
    ];
    const match = destinations.find(([keywords]) => keywords.some((keyword) => query.includes(keyword)));
    if (match) onNavigate(match[1]);
  };

  return (
    <div className="relative z-20 w-full border-b border-slate-100 bg-white">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-3 px-3 py-2 md:px-8">
        <div className="md:hidden"><Header activeTab={activeTab} onNavigate={onNavigate} embedded /></div>
        <div className="flex min-w-0 items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo-alwasi.png`} alt="Logo SMP Islam Al-Wasi’" className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10" />
          <span className="max-w-[112px] truncate text-xs font-extrabold tracking-tight text-slate-900 sm:max-w-none sm:text-base">SMP Islam Al-Wasi’</span>
        </div>
        <form onSubmit={handleGlobalSearch} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#d5ddea] bg-[#f8fafc] px-3 sm:h-10 sm:px-4">
          <Search size={17} className="shrink-0 text-[#0b408f]" />
          <input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} type="search" aria-label="Cari siswa atau fitur SIMPATIK" placeholder="Search - siswa atau fitur SIMPATIK" className="min-w-0 w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 sm:text-sm" />
        </form>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 sm:h-10 sm:w-10" aria-label="Notifikasi">
          <Bell size={18} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
};
