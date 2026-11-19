# SIMPATIK for Students

Aplikasi khusus siswa SMP Islam Al-Wasi’. Aplikasi ini dipisahkan dari SIMPATIK utama yang digunakan guru.

## Fitur siswa
- Login siswa menggunakan NISN dan pemulihan sesi pada perangkat.
- Dashboard, profil, biodata, dan keamanan akun.
- Tahsin dan bacaan sholat (menu disiapkan).
- Ujian semester dan ujian sekolah.
- Ujian Google Form dengan ruang ujian pada tab baru, identitas siswa, hitung mundur, dan status ujian.
- Penyimpanan jawaban ujian secara lokal dan sinkronisasi sesuai dukungan fitur ujian.
- Pendaftaran siswa baru untuk menunggu verifikasi sekolah.

## Backend
Aplikasi menggunakan konfigurasi Firebase sekolah yang sama dengan SIMPATIK utama. Guru menerbitkan ujian dari aplikasi utama; siswa mengakses ujian aktif sesuai kelas.

## Identitas aplikasi
- Web/PWA: SIMPATIK for Students
- Android application ID: `id.sch.smpialwasi.siswa`
- GitHub Pages base path: `/Simpatik-for-Students/`

## Build
```bash
npm install
npm run build
```

## Catatan pemeliharaan
Alur autentikasi siswa, penyimpanan sesi, pemulihan sesi Firebase, dan validasi identitas merupakan bagian kritis. Jangan mengubahnya saat melakukan pemisahan tampilan atau deployment.
