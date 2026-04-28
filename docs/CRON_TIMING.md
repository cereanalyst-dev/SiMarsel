# Cron Timing — Cara dapat fetch eksak di jam 12:00 & 23:59 WIB

## Masalah

Vercel **Hobby plan (gratis)** punya **1-hour flexible window** untuk Cron Jobs.
Artinya cron yang dijadwalkan jam `0 5 * * *` (= 12:00 WIB) bisa dijalankan
kapan saja antara **12:00 – 13:00 WIB**.

Untuk fetch yang HARUS eksak di jam 12:00 dan 23:59, kita perlu solusi
alternatif. Ada 3 opsi:

---

## Opsi A — Upgrade Vercel Pro ($20/bulan)

Vercel Pro plan support **execution eksak** sesuai cron expression. Cuma
bayar bulanan, no setup tambahan. Bonus: function timeout 60s (bukan 10s),
analytics lebih lengkap.

**Setup:**
1. Vercel Dashboard → Settings → Billing → Upgrade to Pro
2. Tidak ada perubahan kode

---

## Opsi B — External Cron Service (gratis, recommended)

Pakai layanan eksternal (cron-job.org, easycron, dll) yang akan hit URL
endpoint kita di waktu eksak. Free tier sudah cukup buat 2 jadwal per hari.

### Setup pakai cron-job.org

1. **Daftar** di https://cron-job.org (gratis)
2. **Buat cron job pertama (jam 12:00 WIB):**
   - Title: `SiMarsel - Markaz Sync 12:00`
   - URL: `https://si-marsel.vercel.app/api/cron/markaz-sync`
   - Schedule: **Custom** → set to `00 05 * * *` (UTC)
     - Note: cron-job.org pakai timezone UTC. 05:00 UTC = 12:00 WIB.
     - Atau pilih timezone Asia/Jakarta dulu, lalu set jam langsung 12:00.
   - **Advanced → Custom HTTP Headers:**
     - Header name: `Authorization`
     - Header value: `Bearer YOUR_CRON_SECRET`
       (ganti `YOUR_CRON_SECRET` dengan nilai env var `CRON_SECRET` kamu)
3. **Buat cron job kedua (jam 23:59 WIB):**
   - Title: `SiMarsel - Markaz Sync 23:59`
   - URL: sama
   - Schedule: `59 16 * * *` UTC (= 23:59 WIB)
   - Header Authorization: sama
4. Test: klik tombol **Test** di cron-job.org, lihat response 200.

### ⚠️ Disable cron Vercel sebelum pakai cron eksternal

Supaya gak double-trigger, hapus section `crons` di `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  ...
  // HAPUS bagian "crons" ini:
  // "crons": [
  //   { "path": "/api/cron/markaz-sync", "schedule": "0 5 * * *" },
  //   { "path": "/api/cron/markaz-sync", "schedule": "59 16 * * *" }
  // ]
}
```

Lalu redeploy.

---

## Opsi C — Tetap pakai Vercel Hobby + accept 1-hour window

Buat banyak use case analytics, geser 30 menit gak masalah. Datanya tetap
masuk DB 2x sehari. Cocok kalau:
- Budget terbatas
- Setup eksternal terlalu ribet
- Akurasi waktu bukan critical (mis. dashboard internal, bukan SLA-bound)

**Tidak ada perubahan setup**, sudah jalan apa adanya.

---

## Rekomendasi

**Opsi B (cron-job.org gratis)** adalah pilihan terbaik untuk budget
gratis + timing eksak. Setup 5 menit, no maintenance.

Kalau pakai Opsi B, kamu bisa juga schedule-in fetch lebih sering
(misal jam 09:00, 12:00, 15:00, 18:00, 23:59) untuk data lebih real-time
tanpa biaya tambahan.

---

## Verifikasi cron jalan tepat waktu

Setelah setup (apapun opsinya), buka tab **Pengaturan Data** di dashboard,
lihat card **Koneksi API Markaz**. Di bawah tiap platform tampil:

```
JADIASN
📅 Data terakhir: 27 Apr 2026 · 🕐 27 Apr, 12:01 [SUCCESS]
```

- **Data terakhir** = tanggal data yang di-fetch (parameter date ke API)
- **Timestamp** (`27 Apr, 12:01`) = kapan cron eksekusi (untuk verify
  apakah eksak sesuai jadwal atau geser)

Kalau **Data terakhir** beberapa hari ke belakang, berarti cron tidak
jalan. Cek log Vercel atau cron-job.org dashboard.
