// Nimmt ein Foto entgegen (im Browser bereits verkleinert, siehe admin/app.js)
// und legt es in Netlify Blobs ab. Gibt einen Schlüssel zurück, der dann in
// den Seiteninhalt eingetragen wird (z. B. content.hero.foto = { key }).
const crypto = require('crypto');
const { photosStore } = require('./_lib/store');
const { isAuthorized } = require('./_lib/session');
const { ok, fail } = require('./_lib/respond');

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return fail(405, 'Nur POST erlaubt.');
  const authed = await isAuthorized(event, true);
  if (!authed) return fail(401, 'Die Sitzung ist abgelaufen. Bitte neu anmelden.');

  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const ext = ALLOWED[contentType.split(';')[0].trim()];
  if (!ext) {
    return fail(422, 'Erlaubt sind nur JPG, PNG oder WebP.');
  }

  const buffer = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'binary');

  if (!buffer.length) return fail(400, 'Es wurde keine Datei übertragen.');
  if (buffer.length > MAX_BYTES) return fail(413, 'Das Foto ist größer als 8 MB.');

  const key = `foto-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  try {
    await photosStore().set(key, buffer, { metadata: { contentType } });
    return ok({ key, url: `/fotos/${key}` });
  } catch (err) {
    return fail(500, 'Das Foto konnte nicht gespeichert werden: ' + err.message);
  }
};
