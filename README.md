# Cooksnap

Prototipe aplikasi mobile (web) untuk manajemen pantry & pengurangan food waste.
Scan bahan makanan, lacak stok + tanggal kedaluwarsa, dan dapatkan saran resep untuk
bahan yang akan basi. Dibangun sebagai satu file (`index_cooksnap.html`) dengan Tailwind
(CDN), FontAwesome, vanilla JavaScript, dan integrasi deteksi bahan via Roboflow.

## Menjalankan secara lokal

Scanner memakai webcam (`getUserMedia`) yang butuh origin aman, jadi jalankan lewat
HTTP server lokal (bukan buka file langsung via `file://`):

```bash
# salah satu:
python -m http.server 8000
# atau
npx serve .
```

Lalu buka `http://localhost:8000/index_cooksnap.html`.

## Konfigurasi API key (Roboflow)

Key TIDAK di-hardcode di dalam `index_cooksnap.html`. Ia dibaca dari file lokal
`cooksnap.config.js` yang di-`.gitignore` (tidak ikut ter-commit).

1. Salin template:
   ```bash
   copy cooksnap.config.example.js cooksnap.config.js   # Windows
   # cp cooksnap.config.example.js cooksnap.config.js    # macOS/Linux
   ```
2. Buka `cooksnap.config.js` dan isi `ROBOFLOW_API_KEY` dengan key milikmu.
3. Jika `cooksnap.config.js` tidak ada atau key kosong, aplikasi tetap jalan; hanya
   fitur scan AI yang menampilkan pesan bahwa key belum diset.

## Catatan keamanan (penting sebelum deploy publik)

Saat dijalankan lewat `file://` atau static server biasa dengan `cooksnap.config.js`,
key memang terkirim ke browser (bisa dibaca lewat DevTools). Itu wajar untuk dev lokal.
Untuk deployment publik, gunakan proxy di bawah supaya key tidak pernah sampai ke browser.

## Deploy ke Netlify (key aman lewat serverless proxy)

Aplikasi memanggil `/api/scan` di produksi. Request diteruskan oleh Netlify Function
(`netlify/functions/scan.js`) yang menyimpan key sebagai environment variable di server,
jadi key TIDAK pernah dikirim ke browser.

Langkah:

1. Push repo ini ke GitHub (tanpa `cooksnap.config.js` — sudah di-`.gitignore`).
2. Di Netlify: **Add new site -> Import from Git**, pilih repo ini.
3. Build settings sudah dibaca dari `netlify.toml` (publish `.`, functions `netlify/functions`).
4. **Site settings -> Environment variables**, tambahkan:
   - `ROBOFLOW_API_KEY` = key Roboflow kamu (wajib)
   - `ROBOFLOW_MODEL_URL` = override model (opsional)
5. Deploy. Tombol scan AI akan jalan tanpa key apa pun di front-end.

Untuk tes proxy secara lokal, pakai Netlify CLI: `npx netlify dev`
(set `ROBOFLOW_API_KEY` dulu sebagai environment variable di terminal).

Jika `/api/scan` tidak tersedia (mis. buka `index_cooksnap.html` langsung tanpa Netlify),
aplikasi otomatis fallback memanggil Roboflow langsung memakai key dari
`cooksnap.config.js` bila ada.

## Struktur file

| File | Keterangan |
|------|------------|
| `index_cooksnap.html` | Seluruh aplikasi (UI + logika). |
| `netlify.toml` | Konfigurasi deploy & redirect `/api/scan`. |
| `netlify/functions/scan.js` | Proxy serverless ke Roboflow (menyimpan key via env var). |
| `cooksnap.config.example.js` | Template config, aman di-commit. |
| `cooksnap.config.js` | Config lokal berisi key asli (di-`.gitignore`). |
| `.gitignore` | Mengecualikan `cooksnap.config.js` dari commit. |
