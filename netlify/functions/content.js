// Öffentliche Function: liefert den aktuellen Seiteninhalt als JSON.
// Wird sowohl von der Website (site.js) als auch vom Adminpanel benutzt.
const { contentStore } = require('./_lib/store');
const { defaultContent } = require('./_lib/defaults');
const { ok, fail } = require('./_lib/respond');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return fail(405, 'Nur GET erlaubt.');
  }
  try {
    const store = contentStore();
    const saved = await store.get('site', { type: 'json' });
    const content = saved || defaultContent();
    return ok({ content }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (err) {
    return fail(500, 'Inhalt konnte nicht geladen werden: ' + err.message);
  }
};
