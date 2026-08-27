# Tutorial: CMS Kalender Islam

Panduan lengkap fitur **Kalender Islam** (`calendar-entry`) di Ensiklopedia Doa CMS:
apa isinya, cara menambahkan datanya, aturan validasinya, cara import massal,
dan cara aplikasi mengambilnya lewat API.

---

## 1. Konsep dasar

1. Semua data kalender disimpan dalam **satu collection type**: `Kalender Islam`
   (UID `api::calendar-entry.calendar-entry`, tabel `calendar_entries`).
2. Yang membedakan isi tiap baris adalah field **`type`** (3 pilihan):
   - `hari_besar` — hari besar Islam, mis. *"Milad Imam Ali bin Abi Thalib as (13 Rajab)"*
   - `astronomi` — catatan falak, mis. *"Equinox Maret, matahari di atas Garis Khatulistiwa"*
   - `awal_bulan_hijriah` — baris tabel konversi Masehi → Hijriah, mis. *1 Ramadan 1447 = 2026-02-19*
3. Form di admin panel bersifat **kondisional**: field yang tidak relevan dengan
   `type` terpilih otomatis disembunyikan.
4. Setiap entri juga punya tiga field Hijriah turunan: **`hijriDate`** (teks, mis.
   `13 Rajab 1446`), **`hijriMonth`**, dan **`hijriYear`**. Untuk hari besar dan
   astronomi ketiganya **diisi otomatis** dari tabel awal bulan setiap kali entri
   disimpan — jangan diketik manual, nilainya akan ditimpa. Untuk baris awal bulan,
   `hijriMonth`/`hijriYear` justru diisi editor dan tidak diutak-atik; hanya
   `hijriDate` yang diturunkan. Ketiganya ada supaya **Filters dan Search bawaan
   Strapi** bisa bekerja pada tanggal Hijriah (lihat poin 4).
5. **Draft & Publish dimatikan** (`draftAndPublish: false`). Begitu entri disimpan,
   entri itu langsung live di API. Tidak ada tombol Publish.
6. Entri `awal_bulan_hijriah` bersifat **kritis**: satu baris salah membuat konversi
   tanggal aplikasi meleset untuk rentang satu bulan penuh. Karena itu ada validasi
   ketat di `lifecycles.ts` (lihat poin 5).

---

## 2. Anatomi file fitur (kalau perlu membuat ulang / menambah ke project lain)

Enam file di bawah `src/api/calendar-entry/` — urutan ini juga urutan kerjanya:

0. **`hijri.ts`** (di root folder `calendar-entry/`) — modul murni tanpa dependensi Strapi:
   daftar bulan (dibaca langsung dari enum di `schema.json`, jadi satu sumber kebenaran),
   konversi Masehi ↔ Hijriah, dan pembangun tabel awal bulan. Dipakai oleh lifecycle,
   service, **dan** komponen admin — satu implementasi untuk ketiganya.
1. **`content-types/calendar-entry/schema.json`** — definisi field.
   - `date` : `date`, **required** (untuk semua tipe)
   - `type` : `enumeration` [`hari_besar`, `astronomi`, `awal_bulan_hijriah`], required, default `hari_besar`
   - `title` : `string`, hanya muncul kalau `type != awal_bulan_hijriah`
   - `hijriDate` : `string`, diisi otomatis lifecycle (mis. `13 Rajab 1446`); dipakai untuk search & filter
   - `hijriMonth` / `hijriYear` : diisi editor untuk awal bulan, diturunkan otomatis untuk tipe lain
   - `hijriMonth` : `enumeration` 12 nama bulan (Muharam … Zulhijah), hanya muncul kalau `type == awal_bulan_hijriah`
   - `hijriYear` : `integer`, min `1300` max `1600`, hanya muncul kalau `type == awal_bulan_hijriah`

   Kunci form kondisionalnya ada di properti `conditions.visible` tiap field, contoh:

   ```json
   "hijriMonth": {
     "type": "enumeration",
     "enum": ["Muharam", "Safar", "..."],
     "conditions": {
       "visible": { "==": [{ "var": "type" }, "awal_bulan_hijriah"] }
     }
   }
   ```

2. **`content-types/calendar-entry/lifecycles.ts`** — validasi `beforeCreate` + `beforeUpdate`
   (isi aturannya di poin 5). Di sinilah semua pesan error berbahasa Indonesia berasal.
   File ini juga yang mengisi field Hijriah turunan saat simpan, dan lewat `afterCreate`/
   `afterUpdate`/`afterDelete`/`afterDeleteMany` memanggil `syncHijriFields()` setiap kali
   ada baris awal bulan yang berubah — termasuk kalau sebuah baris **berhenti** menjadi
   awal bulan karena `type`-nya diganti.
3. **`controllers/calendar-entry.ts`** — controller default:
   `factories.createCoreController('api::calendar-entry.calendar-entry')`
4. **`routes/calendar-entry.ts`** — router default: `factories.createCoreRouter(...)`
5. **`services/calendar-entry.ts`** — service default plus satu method kustom,
   **`syncHijriFields()`**: membaca semua baris sekali, menghitung ulang ketiga field
   Hijriah, dan menulis **hanya baris yang berubah** dalam satu transaksi. Mengembalikan
   jumlah baris yang ditulis. Dipanggil oleh lifecycle (cascade) dan `npm run sync:hijri`.

Setelah file dibuat, jalankan `npm run develop`. Strapi akan membuat tabelnya
otomatis dan meregenerasi `types/generated/contentTypes.d.ts`.

> Catatan sejarah: fitur ini dulu terpisah jadi dua content type
> (`calendar-event` + `hijri-month-start`) dan sudah digabung jadi satu
> (`calendar-entry`) pada commit `3416f30`. Jangan hidupkan lagi dua content type lama itu.

---

## 3. Cara menambah entri lewat Admin Panel

### 3.1 Masuk ke menu

1. Jalankan CMS: `npm run develop` (lokal) lalu buka `http://localhost:1337/admin`.
2. Sidebar kiri → **Content Manager**.
3. Pilih collection type **Kalender Islam**.
4. Klik tombol **Create new entry** di kanan atas.

### 3.2 Menambah Hari Besar (`hari_besar`)

1. Isi **date** dengan tanggal **Masehi** kejadiannya (mis. `2026-03-21`).
2. Pilih **type** = `hari_besar`.
3. Isi **title** dengan nama peristiwa. Konvensi data yang ada:
   sertakan tanggal Hijriah dalam kurung, mis. `Milad Imam Muhammad al-Baqir as (1 Rajab)`.
4. Field `hijriMonth` dan `hijriYear` tidak akan muncul — memang tidak dipakai.
5. Kosongkan **hijriDate** — diisi otomatis saat disimpan, bersama `hijriMonth`
   dan `hijriYear` yang memang tidak muncul di form untuk tipe ini.
6. Klik **Save**. Entri langsung live (tidak ada Publish).

### 3.3 Menambah Catatan Astronomi (`astronomi`)

1. Isi **date** (Masehi).
2. Pilih **type** = `astronomi`.
3. Isi **title**, mis. `Matahari di atas Ka'bah (16:17:54 WIB)` atau
   `Ijtima' awal Syawal / gerhana matahari parsial (tidak terlihat)`.
4. Klik **Save**.

### 3.4 Menambah Awal Bulan Hijriah (`awal_bulan_hijriah`)

Ini yang paling ketat aturannya — baca poin 5 dulu sebelum menyimpan.

1. Isi **date** dengan tanggal **Masehi hari pertama** bulan Hijriah tersebut
   (yaitu tanggal 1 bulan itu), mis. `2026-02-19`.
2. Pilih **type** = `awal_bulan_hijriah`.
3. Field **title** akan hilang dari form, dan muncul dua field baru.
4. Pilih **hijriMonth** dari dropdown, mis. `Ramadan`.
   Ejaan wajib persis seperti di dropdown (Muharam, Safar, Rabiulawal, Rabiulakhir,
   Jumadilawal, Jumadilakhir, Rajab, Syakban, Ramadan, Syawal, Zulqaidah, Zulhijah).
5. Isi **hijriYear**, mis. `1447` (harus antara 1300–1600).
6. Klik **Save**. Kalau baris ini bentrok dengan baris lain, Strapi menolak simpan
   dan menampilkan pesan error berbahasa Indonesia — perbaiki sesuai poin 5.

> **Selalu tambahkan bulan secara berurutan.** Menambah `Syawal 1447` sebelum
> `Ramadan 1447` ada di database akan ditolak kalau jaraknya tidak masuk akal.

### 3.5 Mengedit / menghapus

1. Klik baris yang ingin diubah dari daftar Kalender Islam → ubah field → **Save**.
   Validasi yang sama berlaku saat update.
2. Untuk menghapus, buka entri → **Delete entry**.
   Hati-hati menghapus baris `awal_bulan_hijriah` di tengah rangkaian:
   penghapusan **tidak divalidasi**, jadi rangkaian bisa berlubang tanpa peringatan.
   Kalau terpaksa, hapus dari bulan paling akhir ke belakang.

---

## 4. Filter & pencarian di list view

Hampir semuanya lewat **Filters** dan **Search** bawaan Strapi. Yang membuatnya
bisa memfilter tanggal Hijriah adalah tiga field turunan yang diisi otomatis
untuk **setiap** entri: `hijriDate`, `hijriMonth`, `hijriYear`.

Satu-satunya tombol tambahan adalah **Date range** (poin 4.3), karena rentang
di Filters bawaan butuh dua chip yang harus ditambahkan satu per satu — dan tidak
bisa dinyatakan dalam penanggalan Hijriah sama sekali. Label tombol ini berbahasa
Inggris mengikuti bahasa admin panel.

### 4.1 Filter bulan / tahun Hijriah

1. Klik **Filters** → **Add filter**.
2. Pilih field **hijriMonth** → `is` → pilih bulan dari dropdown (enumerasi asli,
   bukan ketik bebas).
3. Klik **Add filter** lagi → **hijriYear** → `is` → mis. `1447`.
4. Dua chip itu digabung dengan AND, hasilnya semua entri sepanjang Ramadan 1447 —
   hari besar, astronomi, maupun baris awal bulan.

`hijriYear` bertipe angka, jadi juga tersedia `is greater than` / `is less than`
untuk rentang beberapa tahun sekaligus.

### 4.2 Filter tanggal Hijriah persis

Untuk satu tanggal seperti *10 Muharam*, pakai field **hijriDate**:

- `starts with` → `10 Muharam` — cocok untuk semua tahun
- `is` → `10 Muharam 1447` — satu tanggal persis

Pakai **starts with**, jangan **contains**: `contains` `1 Rajab` juga akan
mencocokkan `21 Rajab` dan `31 Rajab`.

### 4.3 Rentang tanggal (Gregorian atau Hijri)

Pakai tombol **Date range** di header list view (ikon kalender, di sebelah
**Filters**). Dropdown **Calendar** di dalamnya memilih penanggalan.

**Calendar: Gregorian**

1. Isi **From** dan/atau **To** lewat date picker.
2. Boleh salah satu sisi saja — isi *From* saja berarti "sejak tanggal itu".

**Calendar: Hijri**

1. Isi baris **From**: Day (opsional) + Month + Year, mis. `— / Ramadan / 1447`.
2. Isi baris **To** dengan cara yang sama.
3. Kolom **Day** boleh dikosongkan:
   - kosong di *From* → dihitung dari **hari pertama** bulan itu;
   - kosong di *To* → dihitung sampai **hari terakhir** bulan itu.
   Jadi `Ramadan 1447` → `Ramadan 1447` berarti sebulan penuh.
4. Baris di bawah menampilkan hasil konversinya ke Masehi sebelum diterapkan,
   supaya tidak ada tebak-tebakan.

Konversinya dibaca dari baris `awal_bulan_hijriah` di koleksi ini sendiri — tabel
yang sama yang dipakai lifecycle. Kalau bulan/tahun yang dipilih belum ada di
tabel, tombol **Apply** dimatikan dan alasannya ditulis.

Lalu klik **Apply**. Label tombol berubah jadi rentang yang aktif,
mis. *01 Jan 2026 – 31 Dec 2026*. **Reset** membersihkannya.

**Kedua mode menghasilkan filter yang sama**: chip `date` ≥ dan ≤ di Filters
bawaan. Chip-nya muncul normal dan bisa dihapus lewat UI chip biasa, dan kalau
kamu membuat chip `date` ≥/≤ sendiri lewat **Filters**, tombolnya ikut
menampilkan rentang itu. Filter `date` lain yang kamu buat manual (`is`,
`is not`, dan sebagainya) tidak diutak-atik tombol ini.

> Catatan: untuk bulan Hijriah **paling akhir** di tabel, panjang bulannya belum
> bisa dipastikan (belum ada bulan sesudahnya sebagai pembanding), jadi dianggap
> 30 hari. Isi kolom **Day** secara eksplisit kalau butuh presisi di bulan itu.

### 4.4 Filter jenis entri

**Filters** → **type** → `is` → `hari_besar` / `astronomi` / `awal_bulan_hijriah`.
Berguna untuk memisahkan tabel konversi dari daftar hari besar.

### 4.5 Kotak Search

Ketik `Ramadan 1447` atau `13 Rajab 1446` di kotak **Search**. Karena `hijriDate`
berupa teks, search bawaan ikut mencocokkannya, selain tetap mencari di `title`.

### 4.6 Menampilkan kolomnya

Kolom Hijriah tidak otomatis tampil. Klik **⚙ Configure the view** di kanan atas
list view → aktifkan **hijriDate** (dan `hijriMonth`/`hijriYear` kalau perlu) →
**Save**.

### 4.7 Mengurutkan

Klik header kolom **date** untuk mengurutkan kronologis — cara tercepat
memeriksa apakah rangkaian awal bulan masih rapat 29/30 hari.

> **Kalau filter Hijriah mengembalikan kosong**, hampir pasti field turunannya
> masih NULL. Jalankan `npm run sync:hijri` (poin 6.6).

## 5. Aturan validasi (dan cara membaca pesan errornya)

Semua diberlakukan di `src/api/calendar-entry/content-types/calendar-entry/lifecycles.ts`.

### 5.1 Untuk `hari_besar` dan `astronomi`

1. **`title` wajib diisi** dan tidak boleh berisi spasi saja.
   - Error: *"Judul wajib diisi untuk entri hari besar atau astronomi."*

### 5.2 Untuk `awal_bulan_hijriah`

1. **`hijriMonth` dan `hijriYear` wajib diisi.**
   - Error: *"Entri awal bulan Hijriah wajib mengisi bulan Hijriah dan tahun Hijriah."*
2. **Tidak boleh duplikat bulan.** Satu kombinasi bulan+tahun hanya boleh punya satu baris.
   - Error: *"Ramadan 1447 sudah terdaftar (mulai 2026-02-19). Ubah entri yang sudah ada, jangan membuat duplikat."*
   - Solusi: cari baris yang sudah ada lalu edit, jangan bikin baru.
3. **Tidak boleh duplikat tanggal.** Satu tanggal Masehi tidak boleh jadi awal dua bulan.
   - Error: *"Tanggal 2026-02-19 sudah dipakai sebagai awal Ramadan 1447."*
4. **Urutan harus konsisten.** Bulan yang lebih akhir secara Hijriah wajib bertanggal
   Masehi lebih akhir juga.
   - Error: *"Urutan tanggal tidak konsisten: Ramadan 1447 harus sesudah Syakban 1447 (2026-01-21)."*
   - Solusi: biasanya salah ketik tahun atau salah pilih bulan.
5. **Jarak antar bulan berdekatan harus 29 atau 30 hari** — dicek ke bulan sebelumnya
   *dan* bulan sesudahnya kalau keduanya sudah ada di database.
   - Error: *"Jarak dari awal Syakban 1447 (2026-01-21) harus 29 atau 30 hari, sekarang 31 hari."*
   - Solusi: koreksi tanggal Masehinya; kalender Hijriah tidak pernah punya bulan 28 atau 31 hari.
6. Perhitungan jarak memakai **UTC day number**, jadi aman dari perbedaan timezone.
7. Saat **update**, data baru digabung dulu dengan baris tersimpan sebelum divalidasi,
   jadi mengubah satu field saja tetap divalidasi sebagai entri utuh.

### 5.3 Soal field Hijriah turunan

1. Nilainya **selalu dihitung ulang** di `beforeCreate`/`beforeUpdate` — apa pun yang
   diketik manual di field itu akan ditimpa.
2. Untuk baris `awal_bulan_hijriah`, `hijriDate` selalu `1 <bulan> <tahun>`;
   `hijriMonth`/`hijriYear` milik editor dan tidak ditimpa.
3. Untuk hari besar/astronomi, nilainya dicari dari baris awal bulan terakhir yang
   tanggalnya ≤ tanggal entri.
4. Kalau tanggal entri **di luar cakupan** tabel awal bulan (sebelum baris paling awal,
   atau lewat 30 hari dari baris paling akhir), ketiganya dibiarkan **kosong** —
   lebih baik kosong daripada salah bulan. Import awal bulan untuk tahun itu — cascade
   akan mengisi sisanya otomatis.
5. Mengubah/menghapus satu baris awal bulan otomatis memicu **hitung ulang** field
   Hijriah semua entri. Hanya baris yang nilainya benar-benar berubah yang ditulis ulang,
   dalam satu transaksi.

---

## 6. Import massal dari dataset falak

Untuk mengisi banyak tahun sekaligus, jangan input manual — pakai importer.

1. **Sumber data**: `data/falak-abi-calendar.json`.
   File ini di-generate dari repo aplikasi mobile:
   `ensiklopedia-doa/scripts/falak-abi/generate.js` → `cms-export.json`,
   lalu disalin ke sini dengan nama `data/falak-abi-calendar.json`.
2. **Bentuk file** — dua array:

   ```json
   {
     "monthStarts": [{ "g": "2026-02-19", "hy": 1447, "hm": 8 }],
     "events": [{ "date": "2025-03-20", "kind": "astro", "text": "Equinox Maret, ..." }]
   }
   ```
   - `g` = tanggal Masehi, `hy` = tahun Hijriah, `hm` = **index bulan 0–11**
     (0 = Muharam … 11 = Zulhijah).
   - `kind` = `event` → tersimpan sebagai `hari_besar`; `kind` = `astro` → `astronomi`.
   - Cakupan file saat ini: 76 awal bulan (`2024-12-03` s/d `2030-12-26`) dan 338 event.
3. **Jalankan importer**:

   ```bash
   npm run import:calendar
   ```
4. **Sifatnya idempotent** — aman dijalankan berulang:
   - awal bulan dilewati kalau sudah ada baris dengan `date` + `type` yang sama;
   - event dilewati kalau sudah ada baris dengan `date` + `title` yang sama.
   Output di terminal: `Month starts: X created, Y skipped` dan `Events: X created, Y skipped`.
5. **Urutan insert sudah diurutkan berdasarkan tanggal**, supaya validasi kontinuitas
   di poin 5.2 selalu melihat bulan sebelumnya lebih dulu.
6. **Sinkronkan field Hijriah** kalau ada baris lama:

   ```bash
   npm run sync:hijri
   ```
   Import dan setiap simpan sudah mengisi field Hijriah lewat lifecycle, jadi ini hanya
   perlu untuk baris yang sudah ada **sebelum** field-nya ditambahkan (masih NULL) — dan
   selama masih NULL, **semua filter Hijriah mengembalikan hasil kosong**. Script ini
   memanggil `syncHijriFields()` dan melaporkan berapa baris yang ditulis. Idempotent:
   kalau semuanya sudah benar, hasilnya `0 entries updated`.
7. **Perhatikan database target.** Kedua script memakai env `DATABASE_*` yang sama dengan server:
   - jalankan apa adanya → masuk ke DB dev lokal;
   - untuk CMS production, jalankan dengan env production yang di-load.

### Menambah cakupan tahun baru

1. Regenerate `cms-export.json` di repo aplikasi mobile.
2. Timpa `data/falak-abi-calendar.json` di repo ini.
3. Jalankan `npm run import:calendar` — hanya baris tahun baru yang masuk.
4. Field Hijriah baris yang tadinya di luar cakupan terisi otomatis oleh cascade saat
   awal bulan baru masuk; `npm run sync:hijri` boleh dijalankan untuk memastikan
   (harus `0 entries updated`).
5. Cek jumlah baris di admin panel, dan pastikan bulan terakhir tersambung rapat
   (29/30 hari) dengan bulan pertama tahun baru.

---

## 7. Mengakses data dari aplikasi (REST API)

1. **Aktifkan izin publik dulu**: Settings → **Users & Permissions Plugin** → **Roles**
   → **Public** → cari `Calendar-entry` → centang **find** dan **findOne** → **Save**.
   Tanpa ini, endpointnya membalas `403 Forbidden`.
2. **Endpoint**: `GET /api/calendar-entries` dan `GET /api/calendar-entries/:documentId`.
3. **Ambil tabel konversi Hijriah** (urut tanggal):

   ```
   GET /api/calendar-entries?filters[type][$eq]=awal_bulan_hijriah&sort=date:asc&pagination[pageSize]=100
   ```
4. **Ambil hari besar dalam satu rentang tanggal**:

   ```
   GET /api/calendar-entries?filters[type][$eq]=hari_besar&filters[date][$gte]=2026-01-01&filters[date][$lte]=2026-12-31&sort=date:asc
   ```
5. **Perhatikan paginasi** (`config/api.ts`): `defaultLimit: 25`, `maxLimit: 100`.
   - 76 baris awal bulan → muat dalam satu request `pageSize=100`.
   - 338 event → **wajib** di-loop halaman per halaman (`pagination[page]=1,2,3…`),
     kalau tidak datanya terpotong diam-diam.
   - `withCount: true`, jadi total ada di `meta.pagination.total` untuk dipakai loop.
6. **Cari berdasarkan tanggal Hijriah** — field turunannya ikut terekspos:

   ```
   GET /api/calendar-entries?filters[hijriMonth][$eq]=Ramadan&filters[hijriYear][$eq]=1447&sort=date:asc
   ```
   Untuk satu tanggal persis pakai `$startsWith` pada `hijriDate` (bukan `$contains`,
   supaya `1 Rajab` tidak ikut mencocokkan `21 Rajab`).
7. **Bentuk response** tiap item: `documentId`, `date`, `type`, `title`, `hijriDate`,
   `hijriMonth`, `hijriYear`, `createdAt`, `updatedAt`, `publishedAt`.
   Untuk `hari_besar`/`astronomi`, `hijriMonth` dan `hijriYear` bernilai `null`;
   untuk `awal_bulan_hijriah`, `title` bernilai `null`.

---

## 8. Checklist sebelum dianggap selesai

1. [ ] `npm run develop` jalan tanpa error dan menu **Kalender Islam** muncul.
2. [ ] Ganti-ganti dropdown `type` → field ikut muncul/hilang sesuai poin 1.3.
3. [ ] Coba simpan `hari_besar` tanpa judul → harus ditolak.
4. [ ] Coba simpan awal bulan dengan jarak 31 hari dari bulan sebelumnya → harus ditolak.
5. [ ] `npm run import:calendar` dijalankan dua kali → run kedua semuanya `skipped`.
6. [ ] `npm run sync:hijri` melaporkan `0 entries updated` pada data yang sudah konsisten.
7. [ ] Rangkaian `awal_bulan_hijriah` urut tanggal tanpa lubang bulan.
8. [ ] **Filters** → `hijriMonth` = `Ramadan` + `hijriYear` = `1447` mengembalikan
       hari besar, bukan cuma baris awal bulan.
9. [ ] **Filters** → `hijriDate` `starts with` `10 Muharam` mengembalikan 10 Muharam
       di semua tahun.
9b. [ ] Tombol **Date range** muncul di list view Kalender Islam dan **tidak**
       muncul di collection lain (Doa, Category); rentang yang diterapkan tampil
       sebagai chip `date` biasa.
9c. [ ] **Calendar: Hijri** — `Ramadan 1447` → `Ramadan 1447` (kolom Day kosong)
       menghasilkan rentang Masehi sepanjang satu bulan penuh.
9d. [ ] Popup-nya tidak terpotong di tepi kanan layar, dan tidak ada input yang
       melewati batas panel.
10. [ ] Ubah tanggal satu baris awal bulan → field Hijriah hari besar di bulan itu ikut bergeser.
11. [ ] Izin Public `find`/`findOne` aktif dan endpoint membalas `200`.

---

## 9. Troubleshooting

| Gejala | Penyebab | Perbaikan |
| --- | --- | --- |
| `403 Forbidden` di `/api/calendar-entries` | Izin role Public belum dicentang | Poin 7.1 |
| Error "sudah terdaftar" saat create | Bulan+tahun itu sudah punya baris | Edit baris lama, bukan bikin baru |
| Error "Jarak … harus 29 atau 30 hari" | Tanggal Masehi salah ketik | Cek ulang ke dataset falak |
| Error "Urutan tanggal tidak konsisten" | Salah pilih bulan atau salah tahun Hijriah | Cek `hijriMonth` + `hijriYear` |
| Data di app kurang / terpotong | Kena `defaultLimit: 25` | Kirim `pagination[pageSize]` dan loop halaman (poin 7.5) |
| Field Hijriah tidak muncul di form | `type` belum diganti ke `awal_bulan_hijriah` | Ganti dropdown `type` dulu |
| Import mengenai DB yang salah | Env `DATABASE_*` tidak sesuai target | Poin 6.7 |
| Field Hijriah kosong di banyak baris | Baris lama, atau di luar cakupan tabel awal bulan | `npm run sync:hijri` (poin 6.6) |
| **Filter Hijriah selalu mengembalikan hasil kosong** | Field turunannya masih NULL | `npm run sync:hijri` — penyebab paling umum |
| Cari `1 Rajab` malah dapat `21 Rajab` | Pakai `contains`, seharusnya `starts with` | Poin 4.2 |
| Admin panel putih polos di `npm run develop` | `NODE_ENV` dipaksa `production` di `.env` | Hapus baris itu, `rm -rf node_modules/.strapi`, restart |
| Admin putih polos setelah `npm run build` | `strapi build` menimpa cache dep Vite dengan bundle produksi yang dipakai bareng dev server | `rm -rf node_modules/.strapi`, restart `npm run develop` |
| Tombol **Date range** tidak muncul | Dev server belum memuat file barunya | Reload admin; kalau perlu restart `npm run develop` |

---

## Referensi file

| File | Isi |
| --- | --- |
| `src/api/calendar-entry/content-types/calendar-entry/schema.json` | Definisi field + form kondisional |
| `src/api/calendar-entry/content-types/calendar-entry/lifecycles.ts` | Semua aturan validasi |
| `src/api/calendar-entry/hijri.ts` | Konversi Masehi ↔ Hijriah; dipakai server dan admin |
| `src/api/calendar-entry/services/calendar-entry.ts` | Service default + `syncHijriFields()` |
| `src/api/calendar-entry/controllers|routes/` | Controller/route default Strapi |
| `scripts/import-calendar.js` | Importer massal (`npm run import:calendar`) |
| `src/admin/components/CalendarDateRangeFilter.tsx` | Tombol "Date range" (Masehi/Hijriah) di list view |
| `src/admin/app.tsx` | Pendaftaran tombol itu ke zona `listView.actions` |
| `scripts/sync-hijri-fields.js` | Pembungkus `syncHijriFields()` (`npm run sync:hijri`) |
| `data/falak-abi-calendar.json` | Dataset falak sumber import |
| `config/api.ts` | Batas paginasi REST |
