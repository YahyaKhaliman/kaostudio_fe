# Panduan Rilis Versi (Release Guide)

Dokumen ini menjelaskan langkah-langkah untuk melakukan rilis versi baru pada proyek **Kaostudio FE** menggunakan sistem Git Tags yang terintegrasi dengan GitHub Actions.

---

## Langkah-Langkah Rilis (Release Steps)

Kami menggunakan tag Git dengan format semantic versioning `v*.*.*` (contoh: `v1.0.0`, `v1.1.2`) untuk memicu proses build, rilis, dan deployment otomatis.

### Langkah 1: Tentukan Versi Rilis

Gunakan aturan Semantic Versioning (SemVer):

- **Major (X.0.0):** Jika ada perubahan besar yang tidak kompatibel dengan versi sebelumnya (breaking changes).
- **Minor (0.X.0):** Jika ada penambahan fitur baru yang kompatibel dengan versi sebelumnya.
- **Patch (0.0.X):** Jika ada perbaikan bug yang kompatibel dengan versi sebelumnya.

### Langkah 2: Buat Tag Baru di Lokal

Jalankan perintah berikut di terminal proyek Anda untuk membuat tag baru (ganti `v1.0.0` dengan versi yang Anda inginkan):

```bash
git tag v1.0.0
```

_Catatan: Anda juga bisa menambahkan pesan deskripsi pada tag menggunakan parameter `-a` (annotated tag):_

```bash
git tag -a v1.0.0 -m "Rilis versi 1.0.0 - Fitur Editor Kaos"
```

### Langkah 3: Push Tag ke GitHub

Dorong tag baru tersebut ke repositori GitHub untuk memicu alur GitHub Actions:

```bash
git push origin v1.0.0
```

---

## 3. Apa yang Terjadi Setelah Tag Di-Push?

GitHub Actions akan secara otomatis mendeteksi tag baru dan menjalankan workflow [.github/workflows/deploy.yml](file:///D:/Coding/kaostudio_fe/.github/workflows/deploy.yml) yang akan melakukan:

1. **Update package.json:** Mengupdate versi proyek secara dinamis pada [package.json](file:///D:/Coding/kaostudio_fe/package.json) di lingkungan build.
2. **Build Project:** Menjalankan perintah `npm run build` untuk mengompilasi kode frontend.
3. **GitHub Release:** Membuat rilis baru di halaman repositori GitHub secara otomatis lengkap dengan _Changelog_ otomatis berdasarkan commit log.
4. **Deploy ke VPS:** Mengirim berkas hasil kompilasi dari folder `dist/` ke VPS production menggunakan rsync.

---

## 4. Membatalkan atau Menghapus Rilis (Rollback/Delete Tag)

Jika Anda melakukan kesalahan penamaan versi atau menemukan bug kritis segera setelah tag dibuat, Anda dapat menghapus tag tersebut dengan langkah berikut:

### Menghapus Tag Lokal:

```bash
git tag -d v1.0.0
```

### Menghapus Tag di Remote (GitHub):

```bash
git push origin --delete v1.0.0
```

> [!WARNING]
> Menghapus tag setelah dideploy tidak akan membatalkan kode yang sudah terkirim ke VPS secara otomatis. Jika perlu melakukan rollback ke versi sebelumnya di VPS, Anda harus men-push tag versi sebelumnya kembali atau memicu alur build ulang secara manual.
