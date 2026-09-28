// Liefert ein gespeichertes Foto aus (öffentlich, kein Login nötig – Fotos
// sind ja auch auf der fertigen Website für alle sichtbar).
const { photosStore, connectBlobs } = require('./_lib/store');
const { fail } = require('./_lib/respond');

const KEY_RE = /^foto-[a-f0-9]{16}\.(jpg|png|webp)$/;
const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

exports.handler = async function (event) {
  connectBlobs(event);
  const key = (event.queryStringParameters || {}).key || '';
  if (!KEY_RE.test(key)) return fail(400, 'Ungültiger Bildname.');

  const store = photosStore();
  const data = await store.get(key, { type: 'arrayBuffer' });
  if (!data) return fail(404, 'Foto nicht gefunden.');

  const ext = key.split('.').pop();
  return {
    statusCode: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: Buffer.from(data).toString('base64'),
    isBase64Encoded: true,
  };
};
