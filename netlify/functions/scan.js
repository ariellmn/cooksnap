// =========================================================================
// NETLIFY FUNCTION: scan — proxy aman ke Roboflow Inference API
// =========================================================================
// Browser mengirim frame base64 ke /api/scan (lihat netlify.toml). Function ini
// menambahkan API key dari environment variable ROBOFLOW_API_KEY lalu meneruskan
// request ke Roboflow. Key TIDAK PERNAH sampai ke browser.
//
// Env var yang dibaca (set di dashboard Netlify):
//   ROBOFLOW_API_KEY   (wajib)
//   ROBOFLOW_MODEL_URL (opsional, ada default di bawah)
// =========================================================================

const DEFAULT_MODEL_URL = 'https://serverless.roboflow.com/ingridient-identification-v2/4';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ROBOFLOW_API_KEY is not configured on the server' })
    };
  }

  const modelUrl = process.env.ROBOFLOW_MODEL_URL || DEFAULT_MODEL_URL;

  // event.body berisi string base64 frame (dikirim apa adanya oleh front-end).
  const frameBase64 = event.body || '';
  if (!frameBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Empty image payload' }) };
  }

  try {
    const response = await fetch(`${modelUrl}?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: frameBase64
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Roboflow request failed with status ${response.status}` })
      };
    }

    const data = await response.json();
    // Teruskan hasil prediksi apa adanya ke browser (tanpa key).
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Roboflow', detail: String(err) }) };
  }
};
