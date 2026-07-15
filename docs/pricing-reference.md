# Referensi Perhitungan Harga — KaoStudio

> **Sumber**: Diekstrak dari codebase `retail_backend` & `retail_frontend` (Manksi Web)
> **Tanggal**: 15 Juli 2026
> **Tujuan**: Dokumen referensi untuk pengembangan fitur **Estimasi Harga** di KaoStudio

---

## Daftar Isi

1. [Perhitungan Harga Barang (Kaos Polos)](#1-perhitungan-harga-barang-kaos-polos)
2. [Perhitungan Harga Jasa Cetak/Sablon](#2-perhitungan-harga-jasa-cetaksablon)
   - [A. Sablon DTF (SD)](#a-sablon-dtf-direct-to-film--kode-sd)
   - [B. DTF Premium (DP)](#b-dtf-premium--kode-dp)
   - [C. Sablon Plastisol (SB)](#c-sablon-plastisol--kode-sb)
   - [D. Bordir (BR)](#d-bordir--kode-br)
   - [E. Polyflex (PL)](#e-polyflex--kode-pl)
   - [F. DTG (TG)](#f-dtg-direct-to-garment--kode-tg)
3. [Formula Estimasi Total](#3-formula-estimasi-total)
4. [Sumber File di Codebase Retail](#4-sumber-file-di-codebase-retail)

---

## 1. Perhitungan Harga Barang (Kaos Polos)

Harga kaos polos dalam sistem retail ditentukan melalui dua pendekatan:

### Pendekatan A — Barang Jadi (Stok Gudang/DC)

Setiap varian kaos (kombinasi jenis, tipe, lengan, kain, warna, ukuran) sudah memiliki
harga yang ditetapkan di database.

| Tabel DB           | Kolom Harga       | Keterangan                        |
| ------------------ | ----------------- | --------------------------------- |
| `tbarangdc_dtl`    | `brgd_harga`      | Harga jual retail (cabang biasa)  |
| `tbarangdc_dtl`    | `brgd_hpp`        | Harga pokok/modal (cabang pusat)  |
| `tbarangdc_dtl`    | `brgd_hrg3`       | Harga khusus marketplace          |

**Nama barang** dihasilkan dari gabungan kolom di tabel `tbarangdc`:

```
TRIM(CONCAT(brg_jeniskaos, ' ', brg_tipe, ' ', brg_lengan, ' ', brg_jeniskain, ' ', brg_warna))
```

Contoh output: `COMBED 30S KAOS LENGAN PENDEK COTTON PUTIH`

### Pendekatan B — Kaos Custom (Pengajuan Harga)

Untuk pesanan custom, harga dasar kaos diambil dari tabel **`tjeniskaos`** yang menyimpan
harga per ukuran untuk setiap jenis kaos:

| Kolom         | Keterangan          |
| ------------- | ------------------- |
| `jk_Jenis`    | Nama jenis kaos     |
| `jk_custom`   | Flag custom (Y/N)   |
| `jk_s`        | Harga ukuran S      |
| `jk_m`        | Harga ukuran M      |
| `jk_l`        | Harga ukuran L      |
| `jk_xl`       | Harga ukuran XL     |
| `jk_2xl`      | Harga ukuran 2XL    |
| `jk_3xl`      | Harga ukuran 3XL    |
| `jk_4xl`      | Harga ukuran 4XL    |
| `jk_5xl`      | Harga ukuran 5XL    |
| `jk_oversize` | Harga ukuran Oversize |
| `jk_jumbo`    | Harga ukuran Jumbo  |

Selain itu terdapat **biaya tambahan** (bordir & DTF) dari tabel `tbiayatambahan`:

| Kolom           | Keterangan                                 |
| --------------- | ------------------------------------------ |
| `bt_tambahan`   | Jenis biaya (`BORDIR` / `DTF`)             |
| `bt_cm`         | Biaya per cm² (digunakan di Pengajuan Harga) |
| `bt_min`        | Biaya minimum (floor price)                |
| `bt_harga`      | Harga tetap alternatif                     |

---

## 2. Perhitungan Harga Jasa Cetak/Sablon

Biaya jasa dihitung berdasarkan **jenis jasa**, **luas area cetak**, dan **kuantitas order**.
Setiap titik cetak (misal: dada depan, punggung, lengan) dihitung terpisah lalu dijumlahkan.

### A. Sablon DTF (Direct to Film) — Kode: `SD`

| Parameter       | Nilai     |
| --------------- | --------- |
| Harga per cm²   | **Rp 25** |
| Size cetak      | Custom (input manual P × L) |

**Formula:**

```
Harga Jasa per Kaos = Σ (Panjang × Lebar × 25) untuk setiap titik cetak
```

**Contoh:**
- Titik 1: Dada depan 30×20 cm = 600 cm² × Rp25 = Rp15.000
- Titik 2: Punggung 40×30 cm = 1.200 cm² × Rp25 = Rp30.000
- **Total Jasa per Kaos = Rp45.000**

---

### B. DTF Premium — Kode: `DP`

| Parameter       | Nilai     |
| --------------- | --------- |
| Harga per cm²   | **Rp 35** |
| Size cetak      | Custom (input manual P × L) |

**Formula:**

```
Harga Jasa per Kaos = Σ (Panjang × Lebar × 35) untuk setiap titik cetak
```

---

### C. Sablon Plastisol — Kode: `SB`

Menggunakan **tarif tetap (flat rate)** berdasarkan ukuran kertas cetak standar:

| Size Cetak | Harga per Titik |
| ---------- | --------------- |
| **A3**     | Rp 35.000       |
| **A4**     | Rp 20.000       |
| **A5**     | Rp 10.000       |

**Formula:**

```
Harga Jasa per Kaos = Σ harga flat setiap titik cetak
```

**Contoh:**
- Titik 1: Dada depan A4 = Rp20.000
- Titik 2: Punggung A3 = Rp35.000
- **Total Jasa per Kaos = Rp55.000**

---

### D. Bordir — Kode: `BR`

Harga per cm² **berjenjang (tier)** berdasarkan total kuantitas kaos yang dipesan:

| Total Qty Kaos  | Harga per cm²    |
| --------------- | ---------------- |
| ≥ 500 pcs       | **Rp 100**       |
| ≥ 20 pcs        | **Rp 500**       |
| ≥ 11 pcs        | **Rp 1.000**     |
| < 11 pcs        | **Rp 1.500**     |

**Aturan Khusus:**
- **Minimum charge per titik bordir**: Rp 5.000
  (Jika hasil kalkulasi < Rp5.000, otomatis dibulatkan naik ke Rp5.000)

**Formula:**

```
Harga per Titik = MAX(Panjang × Lebar × HargaPerCm², 5000)
Harga Jasa per Kaos = Σ Harga per Titik
```

**Contoh (Qty = 24 pcs → Rp500/cm²):**
- Titik 1: Logo dada 5×3 cm = 15 cm² × Rp500 = Rp7.500 → (> Rp5.000, pakai Rp7.500)
- Titik 2: Label lengan 2×1 cm = 2 cm² × Rp500 = Rp1.000 → (< Rp5.000, **pakai Rp5.000**)
- **Total Jasa per Kaos = Rp12.500**

---

### E. Polyflex — Kode: `PL`

Harga per cm² dipengaruhi oleh **kuantitas** DAN **warna bahan polyflex**:

| Kondisi                    | Warna Gold  | Warna Lainnya |
| -------------------------- | ----------- | ------------- |
| **Grosir** (≥ 10 pcs)     | Rp 55 /cm²  | Rp 40 /cm²    |
| **Eceran** (< 10 pcs)     | Rp 65 /cm²  | Rp 50 /cm²    |

**Formula:**

```
Harga per Titik = Panjang × Lebar × HargaPerCm² (berdasarkan tabel di atas)
Harga Jasa per Kaos = Σ Harga per Titik
```

**Contoh (Qty = 15 pcs, warna biasa → Rp40/cm²):**
- Titik 1: Nama punggung 20×5 cm = 100 cm² × Rp40 = Rp4.000
- **Total Jasa per Kaos = Rp4.000**

---

### F. DTG (Direct to Garment) — Kode: `TG`

DTG menggunakan **tabel harga master di database** (`tukuran_sodtf`) dengan logika
matching otomatis. Tidak menggunakan perkalian per cm² sederhana.

**Alur Penentuan Harga:**

1. **Deteksi warna kaos**:
   - Jika nama barang mengandung kata `PUTIH` → kaos **Terang** (harga lebih murah)
   - Jika tidak → kaos **Gelap/Berwarna** (harga lebih mahal)

2. **Matching ukuran cetak**:
   - Jika ukuran baku (A3, A4, dll) → langsung ambil harga dari master
   - Jika **Custom** → hitung luas (P × L), lalu cari ukuran master terdekat
     yang mampu menampung luasan tersebut (dari terkecil ke terbesar)

3. **Penerapan harga Grosir vs Reguler**:
   - Jika `totalQtyKaos ≥ us_qty` (batas grosir di DB) → pakai `us_promo` (harga grosir)
   - Jika tidak → pakai `us_harga` (harga reguler)

**Tabel Master DTG** (`tukuran_sodtf` WHERE `us_jenis = 'TG'`):

| Kolom         | Keterangan                           |
| ------------- | ------------------------------------ |
| `us_ukuran`   | Nama ukuran (A3, A4, TERANG A3, dll) |
| `us_panjang`  | Panjang area (cm)                    |
| `us_lebar`    | Lebar area (cm)                      |
| `us_qty`      | Batas minimum qty untuk harga grosir |
| `us_promo`    | Harga grosir (jika qty ≥ us_qty)     |
| `us_harga`    | Harga reguler (jika qty < us_qty)    |

> **Catatan:** Harga DTG bersifat dinamis dan bergantung sepenuhnya pada data master
> di database. Tidak ada rumus hardcoded di sisi kode.

---

## 3. Formula Estimasi Total

Rumus umum untuk menghitung estimasi harga per kaos dan total transaksi:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Harga per Kaos = Harga Kaos Polos + Total Harga Jasa      │
│                                                             │
│  Di mana:                                                   │
│    Total Harga Jasa = Σ Harga Jasa setiap Titik Cetak       │
│                                                             │
│  Total Transaksi = Harga per Kaos × Kuantitas (Qty)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Contoh Kalkulasi Lengkap

**Skenario:** 24 pcs Kaos Combed 30s ukuran L, Sablon DTF 2 titik

| Komponen               | Perhitungan                            | Harga      |
| ----------------------- | -------------------------------------- | ---------- |
| Kaos Polos (L)          | Dari tabel `tjeniskaos`                | Rp 40.000  |
| Sablon DTF — Dada       | 30 × 20 cm = 600 cm² × Rp25           | Rp 15.000  |
| Sablon DTF — Punggung   | 40 × 30 cm = 1.200 cm² × Rp25         | Rp 30.000  |
| **Harga per Kaos**      |                                        | **Rp 85.000** |
| **Total (24 pcs)**      | Rp85.000 × 24                          | **Rp 2.040.000** |

---

## 4. Sumber File di Codebase Retail

Berikut adalah file-file sumber yang mengandung logika perhitungan harga tersebut:

### Backend (`retail_backend`)

| File | Fungsi/Logika |
| ---- | ------------- |
| `src/services/settingHargaService.js` | CRUD harga kaos per jenis & ukuran (tabel `tjeniskaos`) |
| `src/services/soDtfFormService.js` → `calculateDtgPrice()` | Kalkulasi harga DTG dari tabel master `tukuran_sodtf` |
| `src/services/priceProposalFormService.js` → `getTshirtTypeDetails()` | Ambil harga kaos + biaya tambahan (bordir/DTF dari `tbiayatambahan`) |
| `src/services/invoiceFormService.js` → `searchProducts()` | Pencarian barang jadi + harga dari `tbarangdc_dtl` |

### Frontend (`retail_frontend`)

| File | Fungsi/Logika |
| ---- | ------------- |
| `src/components/modal/JenisOrderModal.vue` → `calculatePrices()` | **Logika utama** perhitungan harga jasa (SD, DP, SB, BR, PL, TG) |
| `src/views/transaksi/penjualan/PriceProposalCreateView.vue` → `calculateTotals()` | Kalkulasi total pengajuan harga (kaos + bordir + DTF + tambahan) |
| `src/views/transaksi/penjualan/SettingHargaView.vue` | UI setting harga kaos per jenis & ukuran |

---

> **Status:** Menunggu keputusan pendekatan mana yang akan diterapkan di KaoStudio.
