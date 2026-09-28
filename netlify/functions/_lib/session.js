// Anmeldung ohne eigenen Server: ein signiertes Cookie statt einer Sitzung in
// einer Datenbank. Wer das Cookie hat und dessen Unterschrift stimmt, ist
// eingeloggt. Der geheime Schlüssel zum Unterschreiben steckt entweder in der
// Umgebungsvariable SESSION_SECRET (bei Netlify unter "Environment variables"
// einstellbar) oder wird beim allerersten Aufruf einmalig erzeugt und in
// Netlify Blobs abgelegt, damit nichts manuell eingerichtet werden muss.
const crypto = require('crypto');
const { configStore } = require('./store');

const COOKIE_NAME = 'fw_admin';
const SESSION_HOURS = 12;

let cachedSecret = null;

async function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  const store = configStore();
  let secret = await store.get('session-secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    await store.set('session-secret', secret);
  }
  cachedSecret = secret;
  return secret;
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

async function createSessionCookie() {
  const secret = await getSecret();
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: expires })).toString('base64url');
  const signature = sign(payload, secret);
  const token = payload + '.' + signature;
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const cookie =
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
  const csrfCookie = `fw_csrf=${csrfToken}; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
  return { cookie, csrfCookie, csrfToken };
}

function clearCookies() {
  return [
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    `fw_csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  ];
}

function readCookie(headerValue, name) {
  if (!headerValue) return null;
  const parts = headerValue.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return part.slice(idx + 1).trim();
  }
  return null;
}

// Prüft Cookie UND (bei state-verändernden Aufrufen) den CSRF-Header.
async function isAuthorized(event, requireCsrf) {
  const cookieHeader = event.headers.cookie || event.headers.Cookie;
  const token = readCookie(cookieHeader, COOKIE_NAME);
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const secret = await getSecret();
  if (sign(payload, secret) !== signature) return false;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return false;
  }
  if (!data.exp || Date.now() > data.exp) return false;

  if (requireCsrf) {
    const csrfCookie = readCookie(cookieHeader, 'fw_csrf');
    const csrfHeader = event.headers['x-csrf-token'] || event.headers['X-Csrf-Token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return false;
  }
  return true;
}

module.exports = { createSessionCookie, clearCookies, isAuthorized, COOKIE_NAME };
