# Setup login Ramspace dengan Cloudflare Workers

Panduan ini untuk branch `feat/account-api-workers-free` dan PR #7.
**Status: eksperimen, belum siap release.** Target tanpa Container sudah dibuat,
tetapi login dengan database sungguhan dan batas Workers Free belum terverifikasi.
Gunakan database percobaan yang kosong. Selesaikan langkah lokal dahulu; berhenti
kalau build atau login gagal. Daftar pekerjaan tersisa ada di
[WORKER-MIGRATION.md](WORKER-MIGRATION.md).

## 1. Siapkan akun dan alat

| Kebutuhan | Untuk apa | Yang perlu kamu ambil |
| --- | --- | --- |
| Cloudflare | Menjalankan API sebagai Worker | Akun dan subdomain workers.dev |
| PostgreSQL hosted | Menyimpan data akun | Connection string dengan TLS |
| WorkOS AuthKit | Mengirim OTP dan memverifikasi login | API key dan Client ID dari environment yang sama |
| Node dan Bun | Menjalankan setup di PC | Versi sesuai `.mise.toml` di root repo |

Database boleh berasal dari layanan dengan paket gratis yang menyediakan
PostgreSQL. Salin connection string dari dashboard penyedia, termasuk pengaturan
TLS dan encoding password. Jangan mengubah `sslmode` untuk melewati verifikasi
sertifikat. Free tier tiap penyedia mempunyai batas dan dapat berubah.

WorkOS tidak menggantikan hosting API atau database. API key WorkOS dan password
database hanya berada di backend; jangan masukkan ke aplikasi desktop.

## 2. Masuk ke checkout migrasi

Di PC ini, worktree migrasi sudah tersedia terpisah dari build Windows:

```powershell
Set-Location D:\ramspace-workers-free
git branch --show-current
bun install --frozen-lockfile
Set-Location apps\api
```

Nama branch harus `feat/account-api-workers-free`. Kalau memakai PC lain,
checkout branch tersebut di clone sendiri, lalu jalankan langkah yang sama.
Semua perintah berikut dijalankan dari folder `apps/api`, kecuali disebut lain.
Jangan menjalankan `cf:deploy` biasa: skrip itu masih menggunakan target Container.

## 3. Atur WorkOS

1. Buat/pilih aplikasi AuthKit dan environment percobaan di dashboard WorkOS.
2. Ambil API key dan Client ID. Keduanya harus berasal dari environment yang sama.
3. Aktifkan **Magic Auth** di pengaturan Authentication aplikasi agar login OTP
   lewat email tersedia. Periksa pengaturan pengiriman email jika kode tidak masuk.
4. Untuk login lewat browser/provider sosial, konfigurasi provider yang diinginkan
   dan daftarkan redirect loopback `http://127.0.0.1:*/callback`, sesuai
   [panduan API](../README.md). Ini callback desktop, bukan URL Worker.

Mulai dengan OTP dahulu agar koneksi API, database, dan WorkOS dapat diperiksa
sebelum menambahkan login sosial.

## 4. Isi konfigurasi lokal

Buat file `apps/api/.env` menggunakan editor. File `.env` sudah diabaikan Git.
Jangan membuat `.dev.vars` bersamaan karena Wrangler memprioritaskan file itu.
Isi template berikut dengan nilai milikmu:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
WORKOS_API_KEY="GANTI_DENGAN_API_KEY_WORKOS"
WORKOS_CLIENT_ID="GANTI_DENGAN_CLIENT_ID_WORKOS"
API_SIGNING_KEY="GANTI_DENGAN_SEED_BASE64URL"
ACCOUNT_BASE_URL="http://localhost:8787"
API_PUBLIC_URL="http://localhost:8787/api/v1"
```

Buat signing seed satu kali dengan perintah berikut, lalu salin hasilnya ke
`API_SIGNING_KEY`. Simpan secara privat dan jangan regenerasi setiap deployment:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Seed ini adalah 32 byte Ed25519 dalam base64url, bukan password bebas atau PEM.
Jangan mengirim isi `.env` ke chat atau memasukkannya dalam commit.
Pastikan Git mengabaikannya:

```powershell
git check-ignore .env
```

Output yang diharapkan: `.env`.

## 5. Siapkan tabel database percobaan

Perintah ini mengubah schema database pada `DATABASE_URL`. Pastikan URL menunjuk
ke database percobaan kosong. Jika memakai database berisi data, buat backup dulu.

```powershell
bun --env-file=.env -e 'import { runMigrations } from "./src/db/migrate.ts"; await runMigrations(process.env.DATABASE_URL); console.log("Migrations applied");'
```

Pemanggilan eksplisit ini menjalankan fungsi migrasi langsung, termasuk pada
Windows; jangan menganggap exit code 0 tanpa pesan berarti schema sudah dibuat.
Verifikasi tabel muncul melalui dashboard database. Worker tidak menjalankan
migrasi secara otomatis setiap request.

## 6. Coba Worker secara lokal

```powershell
bunx --no-install wrangler deploy --dry-run --config wrangler.worker.jsonc
bunx --no-install wrangler dev --config wrangler.worker.jsonc --port 8787
```

`--dry-run` memeriksa bundling, tanpa upload. Kalau gagal, berhenti dan simpan log
error yang tidak mengandung rahasia. Belum ada jaminan bundling target draft ini
berhasil. `wrangler dev` menjalankan runtime Worker lokal; database hosted dan
WorkOS tetap memerlukan koneksi internet.

Arahkan instance Ramspace percobaan ke API lokal dengan environment berikut pada
terminal yang meluncurkan aplikasinya:

```powershell
$env:RAMSPACE_ACCOUNT_URL = "http://localhost:8787"
```

Restart instance percobaan agar membaca konfigurasi itu, lalu coba login OTP dari
UI yang sudah ada. Pakai home directory terpisah dari instalasi sehari-hari;
lihat [README API](../README.md) untuk konfigurasi klien. Login berhasil harus
mencakup pengiriman OTP, verifikasi, akses akun, logout, dan login ulang.

## 7. Deployment staging setelah langkah lokal lulus

**Langkah ini melakukan upload nyata ke Cloudflare.** Lakukan hanya setelah
bundling dan login lokal lulus. Gunakan Worker staging tersendiri, jangan arahkan
aplikasi release ke sana sebelum kualifikasi selesai.

```powershell
bunx --no-install wrangler login
bunx --no-install wrangler whoami
```

Di dashboard Cloudflare Workers, tentukan subdomain workers.dev milik akunmu.
Nama Worker dalam `wrangler.worker.jsonc` adalah `ramspace-account-worker`, sehingga
URL yang perlu disiapkan berbentuk:

```text
https://ramspace-account-worker.SUBDOMAIN-MILIKMU.workers.dev
```

Ubah dua nilai dalam `.env` ke URL staging tersebut:

```dotenv
ACCOUNT_BASE_URL="https://ramspace-account-worker.SUBDOMAIN-MILIKMU.workers.dev"
API_PUBLIC_URL="https://ramspace-account-worker.SUBDOMAIN-MILIKMU.workers.dev/api/v1"
```

Upload secret melalui prompt, satu per satu, agar nilainya tidak ditulis di
riwayat perintah terminal. Wrangler dapat meminta konfirmasi untuk membuat
Worker baru saat secret pertama diunggah.

```powershell
bunx --no-install wrangler secret put DATABASE_URL --config wrangler.worker.jsonc
bunx --no-install wrangler secret put WORKOS_API_KEY --config wrangler.worker.jsonc
bunx --no-install wrangler secret put WORKOS_CLIENT_ID --config wrangler.worker.jsonc
bunx --no-install wrangler secret put API_SIGNING_KEY --config wrangler.worker.jsonc
bunx --no-install wrangler secret put ACCOUNT_BASE_URL --config wrangler.worker.jsonc
bunx --no-install wrangler secret put API_PUBLIC_URL --config wrangler.worker.jsonc
bunx --no-install wrangler deploy --config wrangler.worker.jsonc
```

Pastikan URL pada output deploy sesuai. Ubah `RAMSPACE_ACCOUNT_URL` pada instance
percobaan ke URL staging tanpa `/api/v1`, restart, lalu ulangi pemeriksaan login.
Pantau penggunaan CPU, request, dan koneksi database. Gratis belum berarti semua
beban API ini sudah terbukti muat dalam kuota Workers Free.

## Jika gagal

| Gejala | Yang diperiksa |
| --- | --- |
| `wrangler` tidak ditemukan | Install dependency root selesai; jalankan dari `apps/api` |
| Required secret hilang | Enam nama secret harus tepat; lokal membaca `.env`, deployed membaca secret Cloudflare |
| HTTP 503 | Periksa log Worker secara privat: konfigurasi, koneksi PostgreSQL/TLS, WorkOS, atau runtime belum kompatibel |
| OTP tidak masuk | Magic Auth aktif, pengiriman email WorkOS, folder spam, environment API key/Client ID |
| Login sosial menolak redirect | Callback loopback dan provider sosial di WorkOS |
| Runtime/CPU limit | Catat error runtime dan penggunaan; jangan menaikkan paket tanpa menilai penyebabnya |
| APNs/tunnel/billing ditolak | Belum didukung entry point draft ini; jangan aktifkan konfigurasi fitur tersebut |

Untuk membatalkan percobaan, kembalikan `RAMSPACE_ACCOUNT_URL` instance percobaan
ke nilai sebelumnya. Jangan menghapus database untuk menangani kegagalan login.

## Referensi

- [Konfigurasi API Ramspace](../README.md)
- [Status migrasi](WORKER-MIGRATION.md)
- [WorkOS Magic Auth](https://workos.com/docs/authkit/magic-auth)
- [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
