// =========================================================================
// COOKSNAP CONFIG TEMPLATE (SAFE TO COMMIT)
// =========================================================================
// Ini template. Salin menjadi `cooksnap.config.js` lalu isi key asli di sana.
// `cooksnap.config.js` sudah di-.gitignore sehingga key tidak ikut ter-commit.
//
// Hanya untuk development lokal tanpa Netlify. Di produksi, key disimpan sebagai
// env var GEMINI_API_KEY di Netlify dan file ini tidak diperlukan.
// =========================================================================

window.COOKSNAP_CONFIG = {
  // Ambil dari Google AI Studio (Get API key).
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  // Dipakai otomatis jika model utama kena rate limit (HTTP 429).
  GEMINI_FALLBACK_MODEL: 'gemini-3.1-flash-lite'
};
