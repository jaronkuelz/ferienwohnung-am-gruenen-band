// Frühere Versionen auflisten und eine davon in den Editor zurückholen
// (veröffentlicht wird sie erst, wenn man danach auf "Speichern" klickt).
const { backupsStore, connectBlobs } = require('./_lib/store');
const { isAuthorized } = require('./_lib/session');
const { ok, fail } = require('./_lib/respond');

exports.handler = async function (event) {
  connectBlobs(event);
  const authed = await isAuthorized(event, event.httpMethod !== 'GET');
  if (!authed) return fail(401, 'Die Sitzung ist abgelaufen. Bitte neu anmelden.');

  const store = backupsStore();

  if (event.httpMethod === 'GET') {
    const { blobs } = await store.list();
    const items = blobs
      .map((b) => b.key)
      .sort()
      .reverse()
      .map((key) => ({
        key,
        label: formatLabel(key),
      }));
    return ok({ backups: items });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return fail(400, 'Ungültiges JSON.');
    }
    if (!body.key || typeof body.key !== 'string') return fail(400, 'Welche Version soll geladen werden?');
    const content = await store.get(body.key, { type: 'json' });
    if (!content) return fail(404, 'Diese Sicherung gibt es nicht.');
    return ok({ content });
  }

  return fail(405, 'Nicht erlaubt.');
};

function formatLabel(isoLikeKey) {
  // Schlüssel ist ein ISO-Zeitstempel mit ersetzten Doppelpunkten, z. B.
  // 2026-09-25T14-03-00-000Z
  const iso = isoLikeKey.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    '$1:$2:$3.$4Z'
  );
  const date = new Date(iso);
  if (isNaN(date.getTime())) return isoLikeKey;
  return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) + ' Uhr';
}
