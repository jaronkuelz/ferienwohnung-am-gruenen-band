// Speichert den kompletten Seiteninhalt (nach Anmeldung). Legt vorher eine
// Sicherung der bisherigen Version an.
const { contentStore, backupsStore } = require('./_lib/store');
const { isAuthorized } = require('./_lib/session');
const { ok, fail } = require('./_lib/respond');

const MAX_BACKUPS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB reicht für Text-Inhalte bei weitem.
const LINK_FIELDS = [
  ['allgemein', 'airbnbLink'],
  ['buchen', 'bookingLink'],
  ['buchen', 'landkreisLink'],
];

function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/[^\s"<>]+$/.test(value);
}

function validate(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return 'Ungültige Daten.';
  }
  const requiredSections = [
    'allgemein', 'kontakt', 'menue', 'hero', 'wohnung', 'ausstattung', 'lage',
    'preise', 'verfuegbarkeit', 'buchen', 'abschluss', 'footer', 'impressum', 'datenschutz',
  ];
  for (const key of requiredSections) {
    if (!(key in content)) return `Der Bereich „${key}" fehlt.`;
  }
  for (const [section, field] of LINK_FIELDS) {
    const value = content[section] && content[section][field];
    if (value && !isHttpsUrl(value)) {
      return `Der Link bei „${section}.${field}" muss mit https:// beginnen und darf keine Leerzeichen enthalten.`;
    }
  }
  if (content.kontakt.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.kontakt.email)) {
    return 'Die E-Mail-Adresse sieht nicht gültig aus.';
  }
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return fail(405, 'Nur POST erlaubt.');

  const authed = await isAuthorized(event, true);
  if (!authed) return fail(401, 'Die Sitzung ist abgelaufen. Bitte neu anmelden.');

  if (event.body && event.body.length > MAX_BODY_BYTES) {
    return fail(413, 'Die gesendeten Daten sind zu groß.');
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return fail(400, 'Ungültiges JSON.');
  }

  const content = body.content;
  const problem = validate(content);
  if (problem) return fail(422, problem);

  try {
    const store = contentStore();
    const previous = await store.get('site', { type: 'json' });
    if (previous) {
      const backups = backupsStore();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await backups.setJSON(stamp, previous);
      const list = (await backups.list()).blobs.map((b) => b.key).sort();
      const toDelete = list.slice(0, Math.max(0, list.length - MAX_BACKUPS));
      for (const key of toDelete) await backups.delete(key);
    }
    await store.setJSON('site', content);
    return ok({ savedAt: new Date().toISOString() });
  } catch (err) {
    return fail(500, 'Speichern fehlgeschlagen: ' + err.message);
  }
};
