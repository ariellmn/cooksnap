// =========================================================================
// COOKSNAP LOCAL CONFIG (NOT COMMITTED TO GIT)
// =========================================================================
// File ini berisi kredensial yang TIDAK boleh ikut ter-commit ke repository.
// Ia dibaca oleh index_cooksnap.html sebelum script utama berjalan.
//
// Cara pakai:
//   1. Salin cooksnap.config.example.js menjadi cooksnap.config.js
//   2. Isi ROBOFLOW_API_KEY dengan key milikmu sendiri
//   3. cooksnap.config.js sudah masuk .gitignore, jadi aman dari commit
//
// PENTING untuk deployment publik:
//   Menaruh API key di sisi browser tetap bisa dibaca siapa pun lewat
//   DevTools / Network tab. Untuk produksi, jangan pakai pola ini -- arahkan
//   pemanggilan Roboflow lewat backend proxy milikmu (lihat README).
// =========================================================================

window.COOKSNAP_CONFIG = {
  ROBOFLOW_API_KEY: 'oi2NhTQPgaWh1FxSrkh2',
  ROBOFLOW_MODEL_URL: 'https://serverless.roboflow.com/ingridient-identification-v2/4',
  ROBOFLOW_CONFIDENCE_THRESHOLD: 0.4
};
