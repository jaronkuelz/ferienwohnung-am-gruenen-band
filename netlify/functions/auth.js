// Anmeldung, Ersteinrichtung, Abmelden, Passwort ändern.
// Aufruf über ?action=status|setup|login|logout|password
const { configStore } = require('./_lib/store');
const { hashPassword, verifyPassword, passwordProblem } = require('./_lib/password');
const { createSessionCookie, clearCookies, isAuthorized } = require('./_lib/session');
const { lockoutRemaining, registerFailure, clearFailures } = require('./_lib/attempts');
const { ok, fail } = require('./_lib/respond');

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (e) {
    return {};
  }
}

exports.handler = async function (event) {
  const action = (event.queryStringParameters || {}).action;
  const store = configStore();

  if (action === 'status' && event.httpMethod === 'GET') {
    const hash = await store.get('password-hash');
    const authed = await isAuthorized(event, false);
    return ok({ needsSetup: !hash, loggedIn: authed });
  }

  if (event.httpMethod !== 'POST') {
    return fail(405, 'Nur POST erlaubt.');
  }

  if (action === 'setup') {
    const existing = await store.get('password-hash');
    if (existing) {
      return fail(400, 'Das Adminpanel ist bereits eingerichtet.');
    }
    const remaining = await lockoutRemaining(event);
    if (remaining > 0) {
      return fail(429, `Zu viele Fehlversuche. Bitte in ${Math.ceil(remaining / 60)} Minute(n) erneut versuchen.`);
    }
    const setupCode = process.env.SETUP_CODE;
    if (!setupCode) {
      return fail(
        500,
        'Die Ersteinrichtung ist noch nicht vorbereitet: Es fehlt die Umgebungsvariable SETUP_CODE in den Netlify-Website-Einstellungen.'
      );
    }
    const body = parseBody(event);
    const code = String(body.code || '').trim();
    if (code !== setupCode) {
      await registerFailure(event);
      return fail(401, 'Der Einrichtungscode stimmt nicht.');
    }
    const problem = passwordProblem(body.password);
    if (problem) return fail(422, problem);
    if (body.password !== body.password2) {
      return fail(422, 'Die beiden Passwörter sind nicht gleich.');
    }
    await store.set('password-hash', hashPassword(body.password));
    await clearFailures(event);
    const { cookie, csrfCookie, csrfToken } = await createSessionCookie();
    return ok({ csrfToken }, { cookies: [cookie, csrfCookie] });
  }

  if (action === 'login') {
    const remaining = await lockoutRemaining(event);
    if (remaining > 0) {
      return fail(429, `Zu viele Fehlversuche. Bitte in ${Math.ceil(remaining / 60)} Minute(n) erneut versuchen.`);
    }
    const hash = await store.get('password-hash');
    if (!hash) {
      return fail(400, 'Das Adminpanel ist noch nicht eingerichtet.');
    }
    const body = parseBody(event);
    if (verifyPassword(String(body.password || ''), hash)) {
      await clearFailures(event);
      const { cookie, csrfCookie, csrfToken } = await createSessionCookie();
      return ok({ csrfToken }, { cookies: [cookie, csrfCookie] });
    }
    await registerFailure(event);
    return fail(401, 'Das Passwort ist nicht richtig.');
  }

  if (action === 'logout') {
    return ok({}, { cookies: clearCookies() });
  }

  if (action === 'password') {
    const authed = await isAuthorized(event, true);
    if (!authed) return fail(401, 'Die Sitzung ist abgelaufen. Bitte neu anmelden.');
    const hash = await store.get('password-hash');
    const body = parseBody(event);
    if (!hash || !verifyPassword(String(body.current || ''), hash)) {
      return fail(401, 'Das aktuelle Passwort ist nicht richtig.');
    }
    const problem = passwordProblem(body.next);
    if (problem) return fail(422, problem);
    if (body.next !== body.next2) {
      return fail(422, 'Die beiden neuen Passwörter sind nicht gleich.');
    }
    await store.set('password-hash', hashPassword(body.next));
    return ok({});
  }

  return fail(400, 'Unbekannte Aktion.');
};
