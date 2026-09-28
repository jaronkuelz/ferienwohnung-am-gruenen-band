// Kleine Helfer, damit jede Function gleich antwortet (JSON, gleiche Header).

// `opts.cookies` ist optional: eine Liste von Set-Cookie-Werten. Netlify
// Functions (Lambda-Format) brauchen dafür "multiValueHeaders", ein
// einzelner Header kann sonst nur einen Set-Cookie-Wert transportieren.
function json(status, data, opts) {
  opts = opts || {};
  const res = {
    statusCode: status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      opts.headers || {}
    ),
    body: JSON.stringify(data),
  };
  if (opts.cookies && opts.cookies.length) {
    res.multiValueHeaders = { 'Set-Cookie': opts.cookies };
  }
  return res;
}

function ok(data, opts) {
  return json(200, Object.assign({ ok: true }, data || {}), opts);
}

function fail(status, error, opts) {
  return json(status, { ok: false, error }, opts);
}

module.exports = { json, ok, fail };
