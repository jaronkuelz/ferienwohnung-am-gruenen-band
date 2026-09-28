// Schutz gegen Passwort-Raten: nach 5 Fehlversuchen 15 Minuten Sperre,
// pro Besucher (IP-Adresse). Zustand liegt in Netlify Blobs.
const crypto = require('crypto');
const { configStore } = require('./store');

const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientKey(event) {
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    event.headers['x-forwarded-for'] ||
    'unknown';
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

async function lockoutRemaining(event) {
  const store = configStore();
  const key = clientKey(event);
  const data = (await store.get('attempts', { type: 'json' })) || {};
  const entry = data[key];
  if (entry && entry.lockedUntil > Date.now()) {
    return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}

async function registerFailure(event) {
  const store = configStore();
  const key = clientKey(event);
  const data = (await store.get('attempts', { type: 'json' })) || {};
  const now = Date.now();
  let entry = data[key] || { count: 0, first: now, lockedUntil: 0 };
  if (now - entry.first > LOCKOUT_MS) {
    entry = { count: 0, first: now, lockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.count = 0;
    entry.first = now;
  }
  data[key] = entry;
  // Alte Einträge aufräumen.
  for (const k of Object.keys(data)) {
    if (data[k].lockedUntil < now && now - data[k].first > LOCKOUT_MS) delete data[k];
  }
  await store.setJSON('attempts', data);
}

async function clearFailures(event) {
  const store = configStore();
  const key = clientKey(event);
  const data = (await store.get('attempts', { type: 'json' })) || {};
  delete data[key];
  await store.setJSON('attempts', data);
}

module.exports = { lockoutRemaining, registerFailure, clearFailures };
