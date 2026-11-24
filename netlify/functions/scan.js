// =========================================================================
// NETLIFY FUNCTION: scan — proxy aman ke Google Gemini API
// =========================================================================
// Browser mengirim JSON { image: <base64 JPEG tanpa prefix>, mimeType } ke
// /api/scan (lihat netlify.toml). Function ini menambahkan API key dari env var
// GEMINI_API_KEY lalu meminta Gemini mengenali bahan makanan mentah di gambar.
// Key TIDAK PERNAH sampai ke browser.
//
// Model utama: gemini-3.5-flash-lite. Jika kena rate limit (HTTP 429), request
// diulang sekali ke model cadangan gemini-3.1-flash-lite.
//
// Env var yang dibaca (set di dashboard Netlify):
//   GEMINI_API_KEY        (wajib)
//   GEMINI_MODEL          (opsional, default gemini-3.5-flash-lite)
//   GEMINI_FALLBACK_MODEL (opsional, default gemini-3.1-flash-lite)
//
// Respons ke browser: { items: [{ cls, qty }], model }
// =========================================================================

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024; // ~3 MB gambar; frame 1024px jauh di bawah ini

// Kelas yang boleh dikembalikan Gemini, beserta satuannya.
// HARUS sinkron dengan kunci SCAN_CLASS_CONFIG di index.html.
const CLASS_UNITS = {
  milk: 'ml', cheese: 'gram', egg: 'pcs',
  chicken: 'gram', beef: 'gram', pork: 'gram', fish: 'gram', shrimp: 'gram', squid: 'gram',
  tofu: 'gram', tempeh: 'gram',
  tomato: 'pcs', carrot: 'pcs', potato: 'pcs', sweetpotato: 'pcs', onion: 'pcs', shallot: 'pcs',
  garlic: 'pcs', ginger: 'gram', chili: 'gram', bellpepper: 'pcs', cucumber: 'pcs', eggplant: 'pcs',
  corn: 'pcs', longbean: 'gram', broccoli: 'pcs', cauliflower: 'pcs', cabbage: 'pcs', lettuce: 'pcs',
  spinach: 'pack', waterspinach: 'gram', bokchoy: 'gram', scallion: 'gram', mushroom: 'gram',
  pumpkin: 'pcs', lemon: 'pcs', lime: 'pcs', apple: 'pcs', banana: 'pcs', mango: 'pcs'
};

function buildPrompt() {
  const list = Object.entries(CLASS_UNITS).map(([cls, unit]) => `${cls} (${unit})`).join(', ');
  return [
    'You are a food ingredient detector for a fridge inventory app.',
    'Identify RAW, uncooked food ingredients visible in the image. Ignore cooked or prepared dishes, drinks other than milk, utensils, packaging-only items and anything not in the allowed list.',
    `Allowed classes with their unit: ${list}.`,
    'Quantity rules:',
    '- Unit "pcs": return ONE entry per class with qty = number of visible pieces.',
    '- Unit "gram", "ml" or "pack": return ONE entry per separate package or piece, with qty = your best estimate of its weight in grams, volume in ml, or number of packs.',
    'Use whole numbers. If no allowed ingredient is visible, return an empty items array.'
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          cls: { type: 'STRING', enum: Object.keys(CLASS_UNITS) },
          qty: { type: 'INTEGER' }
        },
        required: ['cls', 'qty']
      }
    }
  },
  required: ['items']
};

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// ---- Multi-key failover ----
// Key dibaca dari env var: GEMINI_API_KEY, lalu GEMINI_API_KEY_2 ... GEMINI_API_KEY_9.
// Urutan percobaan: tiap key mencoba model utama lalu model cadangan; jika keduanya
// kena 429 (kuota habis), pindah ke key berikutnya. Key yang kena 429 diistirahatkan
// 60 detik (selama instance function masih hidup) supaya request berikutnya tidak
// membuang waktu di key yang sudah habis. Key yang ditolak (401/403) diistirahatkan 10 menit.
const KEY_COOLDOWN_MS = 60 * 1000;
const BAD_KEY_COOLDOWN_MS = 10 * 60 * 1000;
const keyCooldownUntil = new Map();

function getApiKeys() {
  const keys = [process.env.GEMINI_API_KEY];
  for (let i = 2; i <= 9; i++) keys.push(process.env[`GEMINI_API_KEY_${i}`]);
  return [...new Set(keys.map(k => (k || '').trim()).filter(Boolean))];
}

async function callWithFailover(keys, models, send) {
  const now = Date.now();
  const ready = keys.filter(k => (keyCooldownUntil.get(k) || 0) <= now);
  const ordered = ready.length ? ready : keys;
  let last = null;
  for (const key of ordered) {
    for (const model of models) {
      const response = await send(model, key);
      last = { response, model };
      if (response.status === 429) continue;
      if (response.status === 401 || response.status === 403) {
        keyCooldownUntil.set(key, Date.now() + BAD_KEY_COOLDOWN_MS);
        break;
      }
      return last;
    }
    if (last.response.status === 429) keyCooldownUntil.set(key, Date.now() + KEY_COOLDOWN_MS);
  }
  return last;
}

function callGemini(model, apiKey, image, mimeType) {
  return fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: image } },
          { text: buildPrompt() }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA
      }
    })
  });
}

// Ambil teks JSON dari kandidat pertama lalu buang entri yang tidak valid.
function parseItems(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('');
  if (!text) return [];
  const parsed = JSON.parse(text);
  return (parsed.items || [])
    .filter(it => it && CLASS_UNITS[it.cls] && Number.isFinite(Number(it.qty)))
    .map(it => ({ cls: it.cls, qty: Math.max(1, Math.round(Number(it.qty))) }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return jsonResponse(500, { error: 'GEMINI_API_KEY is not configured on the server' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Body must be JSON' });
  }

  const image = typeof payload.image === 'string' ? payload.image : '';
  const mimeType = payload.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  if (!image) return jsonResponse(400, { error: 'Empty image payload' });
  if (image.length > MAX_IMAGE_BASE64_LENGTH) return jsonResponse(413, { error: 'Image too large' });

  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  try {
    const models = [...new Set([primary, fallback].filter(Boolean))];
    const { response, model } = await callWithFailover(apiKeys, models, (m, key) => callGemini(m, key, image, mimeType));

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return jsonResponse(status, { error: `Gemini request failed with status ${response.status}`, model });
    }

    const data = await response.json();
    return jsonResponse(200, { items: parseItems(data), model });
  } catch (err) {
    return jsonResponse(502, { error: 'Failed to reach Gemini', detail: String(err) });
  }
};
