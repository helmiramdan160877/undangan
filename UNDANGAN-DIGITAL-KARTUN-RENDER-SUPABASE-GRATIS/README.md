# UNDANGAN DIGITAL KARTUN — HOSTING GRATIS

**Versi 2.0 | Node.js + Render (website) + Supabase (database & foto)**

Website pernikahan dengan desain pasangan kartun, panel admin, RSVP, ucapan, galeri, musik MP3, dan tautan personal tamu. Desain publik tetap memakai ilustrasi kartun dari proyek awal. Paket ini **belum terpasang di internet** — ikuti langkah di bawah supaya mendapatkan alamat publik `https://nama-website.onrender.com`.

> PENTING: Render Free **menghapus file yang ditulis pada servernya ketika restart**. Oleh karena itu, untuk online aplikasi ini WAJIB memakai Supabase (data SQL + media Storage). Tanpa Supabase, proses start di Render ditolak; aplikasi tidak akan diam-diam menyimpan ke disk sementara. Mode lokal Windows masih tersedia untuk pengujian saja.

## LANGKAH 1 — Siapkan Supabase (gratis)

1. Buka **https://supabase.com/dashboard** dan daftar/masuk. Buat project baru menggunakan plan **Free**.
2. Setelah project siap, pilih menu **SQL Editor → New query**.
3. Buka file paket ini **`database/init.sql`**, salin **seluruh isinya** ke SQL Editor, lalu tekan **Run**. Script ini menyiapkan tiga tabel: konfigurasi undangan, RSVP, ucapan tamu. Data lama tidak dihapus jika script dijalankan ulang.
4. Buka **Storage → New bucket**. Isi nama bucket **persis `undangan-media`** (huruf kecil), nyalakan **Public bucket**, lalu Create. *Public* berarti foto dan musik dapat ditampilkan oleh pengunjung; hanya backend menggunakan Secret Key yang diperbolehkan mengunggah.
5. Salin **Project URL**: dari tombol **Connect** atau menu konfigurasi API di dashboard, bentuknya `https://abcdefgh.supabase.co`.
6. Salin **Secret API key** (`sb_secret_...`) dari **Settings → API Keys → Secret keys**. **Jangan** memakai Publishable key (`sb_publishable_...`) dan **jangan** taruh secret dalam file apa pun yang diunggah ke GitHub. Simpan sendiri, nanti masukkan melalui Render.

**Catatan:** Supabase paket Free bisa dijeda (paused) setelah sekitar 7 hari tidak aktif. Jika undangan tak bisa diakses karena database dijeda, buka proyek Supabase dan lakukan restore/unpause. Lakukan backup data jika acara penting.

## LANGKAH 2 — Unggah isi ZIP ke GitHub (gratis)

1. Buka **https://github.com/new** lalu buat repository baru, contoh `undangan-pernikahan-kartun` (boleh Private).
2. **Ekstrak ZIP ini** di komputer. Buka foldernya, lalu unggah **semua isi di dalam folder**, bukan ZIP-nya, ke direktori paling atas (root) repo GitHub memakai **Add file → Upload files → Commit changes**.
3. Pastikan `render.yaml`, `server.js`, `persistence.js`, `package.json`, `public/`, dan `database/` ada di root repository.
4. Folder `data/` dan `uploads/` boleh kosong; jangan pernah mengunggah `.env` atau berkas rahasia apa pun. File `.gitignore` sudah menolak `.env` dan data lokal.

## LANGKAH 3 — Publish di Render (gratis)

1. Buka **https://dashboard.render.com/**, masuk, dan hubungkan GitHub.
2. Pilih **New → Blueprint**, lalu pilih repo undangan tadi. Render akan membaca file `render.yaml` dan menyiapkan **Web Service — Free**.
3. Pada formulir rahasia **Environment Variables**, isikan:

   | Nama variabel | Isi |
   | --- | --- |
   | `ADMIN_PASSWORD` | Password admin buatan sendiri, minimal 12 karakter, kuat dan tidak dibagikan |
   | `SUPABASE_URL` | URL project dari Langkah 1, misalnya `https://abcdefgh.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Secret key Supabase yang diawali `sb_secret_` |

   `REQUIRE_SUPABASE=1` dan `NODE_ENV=production` sudah diatur di `render.yaml`.
4. Klik **Deploy Blueprint**. Cek Deploy/Logs jika ada kesalahan. Jangan tambahkan kredensial ke GitHub atau commit kode.
5. Jika status aplikasi **Live**, buka URL yang diberikan Render (nama acak bisa berbeda dari contoh). Misalnya `https://undangan-kartun.onrender.com`.
6. Buka **`https://URL-KAMU.onrender.com/admin`**. Masuk dengan `ADMIN_PASSWORD` dari tahap 3. Isi nama pengantin, tanggal, alamat, foto, dan lain-lain; klik **Simpan & Terbitkan**.
7. Di panel admin, pilih menu **Link Undangan**, isi nama tamu jika ingin membuat tautan personal, kemudian gunakan **Bagikan WhatsApp**.

**Tidak ada link publik otomatis di ZIP.** Link `onrender.com` dibuat oleh Render setelah kamu menghubungkan repo GitHub milikmu dan selesai deploy. `localhost` hanya dapat diakses dari komputer sendiri.

## LANGKAH 4 — Tes hasil upload

- Halaman `https://URL-KAMU.onrender.com/api/health` harus menampilkan `"ok":true` dan `"storage":"supabase"`.
- Ubah salah satu nama pengantin di admin lalu **Simpan & Terbitkan**. Refresh undangan, pastikan berubah.
- Unggah foto pada admin, simpan, buka undangan via HP. Foto harus muncul.
- Kirim RSVP dan ucapan tamu dari halaman undangan; periksa daftar RSVP/ucapan pada admin.
- Lakukan **Manual Deploy** ulang via Render jika ingin memastikan data dan foto masih ada setelah restart/redeploy.

## Informasi penting

- **Render Free** biasanya tidur/spin down setelah 15 menit tanpa akses. Saat dibuka kembali, halaman mungkin menunggu sekitar 1 menit sebelum tampil. Cache/browser atau layanan gratis dapat mengalami gangguan; tidak disarankan untuk undangan berskala besar tanpa upgrade.
- **Supabase Free** punya kuota dan aturan pembatasan. Project tidak aktif dapat dijeda dan perlu dipulihkan dari dashboard Supabase. Penggunaan *gratis* bukan jaminan layanan tanpa batas atau selamanya.
- Jika server Render tidur dan hidup kembali, **admin mungkin harus login ulang**, tetapi data undangan, RSVP, ucapan, dan media tetap di Supabase selama proyek Supabase tersedia.
- **Keamanan:** `SUPABASE_SECRET_KEY` hanya ada di environment backend Render. Jangan bagikan ke tamu ataupun tampilkan di frontend. Pengunjung mengakses website via API Node.js, bukan memakai secret key.
- Bucket `undangan-media` memang **public** untuk foto dan musik. Jangan gunakan untuk dokumen pribadi.
- Password admin disimpan sebagai environment variable. Jangan gunakan password yang sama dengan akun penting lainnya.
- **Data bawaan dari ZIP lama tidak otomatis dipindahkan.** Isi melalui panel admin online; bila sebelumnya sudah punya data tamu pada server lokal, perlu migrasi khusus.
- Jika panel admin menunjukkan pesan database tidak dapat dihubungi, pastikan Supabase aktif, SQL sudah dijalankan, bucket dibuat, dan URL/key benar.

## Jalankan lokal (opsional)

Butuh **Node.js 20 atau lebih baru**. Klik `JALANKAN-WINDOWS.bat` atau jalankan `node server.js`, lalu buka `http://localhost:3000/admin`. Tanpa variabel Supabase, data tersimpan di folder lokal `data/`, dan media ke `uploads/` (JANGAN gunakan mode ini di hosting gratis). Jika ingin menguji mode Supabase di lokal, salin `.env.example` ke `.env`, isi URL/key/ADMIN_PASSWORD milikmu secara privat, lalu jalankan `node server.js`.

## Struktur file

```text
render.yaml            -> konfigurasi deploy Web Service Free Render
server.js              -> web/API/auth/validasi
persistence.js         -> mode SQL + Storage Supabase, fallback lokal saat development
database/init.sql      -> 3 tabel SQL yang perlu dibuat di Supabase
public/index.html      -> website undangan tamu
public/admin.html      -> dashboard/panel admin
public/assets/         -> ilustrasi pasangan kartun bawaan
public/*.js dan *.css  -> interaksi dan tema undangan
.env.example           -> contoh nilai konfigurasi (TIDAK BERISI KUNCI RAHASIA)
test/                  -> tes lokal serta simulasi koneksi Supabase
```

## Pengujian oleh developer

Jalankan `npm test` (Node 20+) untuk menguji alur lokal dan simulasi Supabase menggunakan server palsu (mock). Pengujian otomatis **tidak tersambung ke akun Supabase maupun Render milik pengguna**. Akses deploy sungguhan perlu diuji sendiri setelah tahap 1–3.
