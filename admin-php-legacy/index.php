<?php
require __DIR__ . '/lib.php';

ensure_dirs();
start_session();

$nonce = base64_encode(random_bytes(16));
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
header("Content-Security-Policy: default-src 'none'; script-src 'nonce-$nonce'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");

function json_out($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_body() {
    $data = json_decode((string)file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function require_auth() {
    if (!is_logged_in()) {
        json_out(['ok' => false, 'error' => 'Die Sitzung ist abgelaufen. Bitte neu anmelden.', 'relogin' => true], 401);
    }
}

// ---------------------------------------------------------------------------
// Schnittstelle (POST)
// ---------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_valid()) {
        json_out(['ok' => false, 'error' => 'Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden.'], 403);
    }
    $action = $_GET['action'] ?? '';

    try {
        switch ($action) {
            case 'login': {
                if (($left = lockout_remaining()) > 0) {
                    json_out(['ok' => false, 'error' => 'Zu viele Fehlversuche. Bitte in ' . (int)ceil($left / 60) . ' Minute(n) erneut versuchen.'], 429);
                }
                $cfg = load_config();
                if (!$cfg) {
                    json_out(['ok' => false, 'error' => 'Das Adminpanel ist noch nicht eingerichtet.'], 400);
                }
                $pw = (string)(json_body()['password'] ?? '');
                if ($pw !== '' && password_verify($pw, $cfg['password_hash'])) {
                    clear_failures();
                    log_in();
                    json_out(['ok' => true]);
                }
                register_failure();
                json_out(['ok' => false, 'error' => 'Das Passwort ist nicht richtig.'], 401);
            }

            case 'setup': {
                if (load_config()) {
                    json_out(['ok' => false, 'error' => 'Das Adminpanel ist bereits eingerichtet.'], 400);
                }
                if (($left = lockout_remaining()) > 0) {
                    json_out(['ok' => false, 'error' => 'Zu viele Fehlversuche. Bitte in ' . (int)ceil($left / 60) . ' Minute(n) erneut versuchen.'], 429);
                }
                $b = json_body();
                if (!setup_code_valid($b['code'] ?? '')) {
                    register_failure();
                    json_out(['ok' => false, 'error' => 'Der Einrichtungscode stimmt nicht.'], 401);
                }
                $pw = (string)($b['password'] ?? '');
                if (($problem = password_problem($pw)) !== null) {
                    json_out(['ok' => false, 'error' => $problem], 422);
                }
                if ($pw !== (string)($b['password2'] ?? '')) {
                    json_out(['ok' => false, 'error' => 'Die beiden Passwörter sind nicht gleich.'], 422);
                }
                if (!save_config(password_hash($pw, PASSWORD_DEFAULT))) {
                    json_out(['ok' => false, 'error' => 'Die Einstellungen konnten nicht gespeichert werden. Bitte Schreibrechte für den Ordner admin/data prüfen.'], 500);
                }
                clear_failures();
                log_in();
                json_out(['ok' => true]);
            }

            case 'logout': {
                $_SESSION = [];
                session_destroy();
                json_out(['ok' => true]);
            }

            case 'save': {
                require_auth();
                list($tpl, $defaults) = editor_state();
                $input = json_body()['values'] ?? null;
                if (!is_array($input)) {
                    json_out(['ok' => false, 'error' => 'Keine Daten erhalten.'], 400);
                }
                list($clean, $errors) = sanitize_values($input, $defaults);
                if ($errors) {
                    json_out(['ok' => false, 'errors' => $errors], 422);
                }
                if (!save_content($clean, $defaults)) {
                    json_out(['ok' => false, 'error' => 'Speichern fehlgeschlagen. Bitte Schreibrechte für den Ordner admin/data prüfen.'], 500);
                }
                publish($tpl, $clean);
                cleanup_uploads($clean);
                json_out(['ok' => true, 'counts' => open_counts($clean), 'savedAt' => date('H:i')]);
            }

            case 'upload': {
                require_auth();
                if (!isset($_FILES['file'])) {
                    json_out(['ok' => false, 'error' => 'Es wurde keine Datei übertragen.'], 400);
                }
                list($ok, $res) = handle_image_upload($_FILES['file']);
                if (!$ok) {
                    json_out(['ok' => false, 'error' => $res], 422);
                }
                json_out(['ok' => true, 'path' => $res]);
            }

            case 'password': {
                require_auth();
                $b = json_body();
                $cfg = load_config();
                if (!$cfg || !password_verify((string)($b['current'] ?? ''), $cfg['password_hash'])) {
                    json_out(['ok' => false, 'error' => 'Das aktuelle Passwort ist nicht richtig.'], 401);
                }
                $new = (string)($b['new'] ?? '');
                if (($problem = password_problem($new)) !== null) {
                    json_out(['ok' => false, 'error' => $problem], 422);
                }
                if ($new !== (string)($b['new2'] ?? '')) {
                    json_out(['ok' => false, 'error' => 'Die beiden neuen Passwörter sind nicht gleich.'], 422);
                }
                if (!save_config(password_hash($new, PASSWORD_DEFAULT))) {
                    json_out(['ok' => false, 'error' => 'Das Passwort konnte nicht gespeichert werden.'], 500);
                }
                json_out(['ok' => true]);
            }

            case 'backups': {
                require_auth();
                json_out(['ok' => true, 'backups' => list_backups()]);
            }

            case 'backup_get': {
                require_auth();
                $file = (string)(json_body()['file'] ?? '');
                if (!preg_match('/^content-\d{8}-\d{6}\.json$/', $file) || !is_file(BACKUP_DIR . '/' . $file)) {
                    json_out(['ok' => false, 'error' => 'Diese Sicherung gibt es nicht.'], 404);
                }
                list($tpl, $defaults) = editor_state();
                $over = json_decode((string)file_get_contents(BACKUP_DIR . '/' . $file), true);
                $values = merge_values($defaults, is_array($over) ? $over : []);
                foreach (all_fields() as $key => $f) {
                    if ($f['type'] === 'image' && $values[$key] !== '' && !is_file(SITE_DIR . '/' . $values[$key])) {
                        $values[$key] = '';
                    }
                }
                json_out(['ok' => true, 'values' => $values]);
            }

            default:
                json_out(['ok' => false, 'error' => 'Unbekannte Aktion.'], 400);
        }
    } catch (Throwable $e) {
        json_out(['ok' => false, 'error' => $e->getMessage()], 500);
    }
    exit;
}

// ---------------------------------------------------------------------------
// Oberfläche (GET)
// ---------------------------------------------------------------------------
$boot = ['mode' => !load_config() ? 'setup' : (is_logged_in() ? 'edit' : 'login'), 'csrf' => csrf_token()];
$fatal = null;
if ($boot['mode'] === 'edit') {
    try {
        list($tpl, $defaults, $values) = editor_state();
        $boot['sections'] = field_sections();
        $boot['defaults'] = $defaults;
        $boot['values'] = $values;
        $boot['counts'] = open_counts($values);
        $boot['site'] = '../';
    } catch (Throwable $e) {
        $fatal = $e->getMessage();
        $boot = ['mode' => 'error', 'csrf' => csrf_token()];
    }
}
$bootJson = json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Website bearbeiten</title>
<style>
  :root {
    --wald-dunkel: #142b20; --wald: #1e3d2c; --wald-hell: #375f45; --wald-blass: #e7efe7;
    --papier: #faf7ef; --papier-dunkel: #f1eadb; --lehm: #b3652f; --lehm-hell: #c97d43;
    --text: #1b241c; --text-mild: #4d5b4f; --linie: rgba(20,43,32,0.16);
    --rot: #b3261e; --gruen: #2e7d4f;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--papier); color: var(--text); }
  h1, h2, h3 { line-height: 1.2; margin: 0; }
  button, input, textarea { font: inherit; color: inherit; }
  a { color: var(--wald-hell); }

  .center { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
  .card { background: #fff; border: 1px solid var(--linie); border-radius: 14px; padding: 2rem; width: 100%; max-width: 420px; box-shadow: 0 30px 60px -40px rgba(20,43,32,0.4); }
  .card h1 { font-size: 1.4rem; color: var(--wald-dunkel); margin-bottom: 0.4rem; }
  .card p.lead { color: var(--text-mild); margin: 0 0 1.4rem; }

  .field { margin-bottom: 1.3rem; }
  .field-kopf { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.3rem; }
  label { font-weight: 600; font-size: 0.92rem; color: var(--wald-dunkel); }
  .help { color: var(--text-mild); font-size: 0.84rem; margin-top: 0.25rem; }
  input[type=text], input[type=password], input[type=email], textarea {
    width: 100%; padding: 0.65rem 0.8rem; background: #fff; border: 1px solid var(--linie); border-radius: 9px;
  }
  textarea { resize: vertical; min-height: 5.5rem; }
  textarea.legal { min-height: 18rem; font-family: ui-monospace, Consolas, monospace; font-size: 0.88rem; }
  input:focus, textarea:focus, button:focus-visible { outline: 3px solid rgba(179,101,47,0.35); border-color: var(--lehm); }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.65rem 1.1rem; border-radius: 999px; border: 1px solid transparent; font-weight: 600; cursor: pointer; text-decoration: none; }
  .btn-haupt { background: var(--lehm); color: #fff; }
  .btn-haupt:hover:not(:disabled) { background: #9c5626; }
  .btn-zweit { background: #fff; border-color: var(--linie); color: var(--wald-dunkel); }
  .btn-zweit:hover:not(:disabled) { background: var(--wald-blass); }
  .btn-klein { padding: 0.35rem 0.8rem; font-size: 0.85rem; }
  .btn:disabled { opacity: 0.55; cursor: default; }
  .btn-voll { width: 100%; }
  .link-btn { background: none; border: 0; padding: 0; color: var(--lehm); cursor: pointer; font-size: 0.82rem; text-decoration: underline; }

  .meldung { padding: 0.7rem 0.9rem; border-radius: 9px; margin: 0 0 1rem; font-size: 0.92rem; }
  .meldung.fehler { background: #fbe9e7; color: var(--rot); border: 1px solid #f3c6c1; }
  .meldung.ok { background: #e6f3ea; color: var(--gruen); border: 1px solid #bfe0cb; }

  .topbar { position: sticky; top: 0; z-index: 30; background: var(--wald-dunkel); color: #fff; display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 1.2rem; flex-wrap: wrap; }
  .topbar .titel { font-weight: 700; font-size: 1.05rem; margin-right: auto; }
  .topbar .status { font-size: 0.85rem; color: rgba(250,247,239,0.75); }
  .topbar .status.offen { color: #ffd9b8; font-weight: 600; }
  .topbar a.btn, .topbar .btn-zweit { background: transparent; border-color: rgba(250,247,239,0.35); color: #fff; }
  .topbar .btn-zweit:hover:not(:disabled) { background: rgba(250,247,239,0.12); }

  .layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 1.5rem; max-width: 1180px; margin: 0 auto; padding: 1.5rem 1.2rem 5rem; }
  .side { position: sticky; top: 4.6rem; align-self: start; display: grid; gap: 0.25rem; }
  .side button { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; text-align: left; background: none; border: 0; padding: 0.6rem 0.8rem; border-radius: 9px; cursor: pointer; color: var(--wald-dunkel); font-weight: 500; }
  .side button:hover { background: var(--wald-blass); }
  .side button.aktiv { background: var(--wald); color: #fff; }
  .badge { background: var(--lehm); color: #fff; border-radius: 999px; font-size: 0.72rem; font-weight: 700; padding: 0.05rem 0.5rem; min-width: 1.4rem; text-align: center; }
  .side button.aktiv .badge { background: #fff; color: var(--lehm); }

  .panel { background: #fff; border: 1px solid var(--linie); border-radius: 14px; padding: 1.8rem; }
  .panel > h2 { font-size: 1.4rem; color: var(--wald-dunkel); margin-bottom: 0.3rem; }
  .panel > p.intro { color: var(--text-mild); margin: 0 0 1.6rem; }

  .offen-marke { background: #fff1e4; color: #9c5626; border: 1px solid #f2cfae; border-radius: 999px; font-size: 0.74rem; font-weight: 700; padding: 0 0.55rem; }

  .foto { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 1rem; align-items: start; }
  .foto-vorschau { aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: repeating-linear-gradient(135deg, #dfd9c8 0, #dfd9c8 2px, #eae4d4 2px, #eae4d4 22px); display: grid; place-items: center; color: var(--text-mild); font-size: 0.82rem; text-align: center; padding: 0.5rem; }
  .foto-vorschau img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .foto-knoepfe { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
  .foto-status { font-size: 0.85rem; color: var(--text-mild); margin-bottom: 0.6rem; min-height: 1.2em; }
  .foto-status.fehler { color: var(--rot); }

  .liste { display: grid; gap: 0.5rem; margin: 0.8rem 0 0; padding: 0; list-style: none; }
  .liste li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.6rem 0.8rem; border: 1px solid var(--linie); border-radius: 9px; }
  .abschnitt-trenner { border: 0; border-top: 1px solid var(--linie); margin: 1.8rem 0; }

  .toast { position: fixed; left: 50%; bottom: 1.4rem; transform: translateX(-50%); background: var(--wald-dunkel); color: #fff; padding: 0.7rem 1.3rem; border-radius: 999px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 50; font-weight: 600; }

  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; padding-top: 1rem; }
    .side { position: static; display: flex; overflow-x: auto; padding-bottom: 0.4rem; }
    .side button { white-space: nowrap; }
    .foto { grid-template-columns: 1fr; }
    .panel { padding: 1.2rem; }
  }
</style>
</head>
<body>
<noscript><div class="center"><div class="card"><h1>JavaScript nötig</h1><p class="lead">Das Adminpanel braucht JavaScript. Bitte im Browser aktivieren.</p></div></div></noscript>
<div id="app"></div>
<?php if ($fatal !== null): ?>
<div class="center"><div class="card"><h1>Fehler</h1><p class="lead"><?= esc($fatal) ?></p></div></div>
<?php endif; ?>
<script id="boot" type="application/json"><?= $bootJson ?></script>
<script nonce="<?= esc($nonce) ?>">
(function () {
  'use strict';
  var boot = JSON.parse(document.getElementById('boot').textContent);
  var app = document.getElementById('app');
  var csrf = boot.csrf;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isPlaceholder(v) { return /\[[^\]\n]{2,}\]/.test(v || ''); }

  function api(action, body, isForm) {
    var opts = { method: 'POST', headers: { 'X-CSRF-Token': csrf }, credentials: 'same-origin' };
    if (isForm) { opts.body = body; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body || {}); }
    return fetch('index.php?action=' + action, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Unerwartete Antwort vom Server.' }; });
    }).catch(function () {
      return { ok: false, error: 'Keine Verbindung zum Server.' };
    });
  }

  // ------------------------------------------------------------------ Anmeldung / Einrichtung
  function renderAuth(setup) {
    var box = h('div', { class: 'card' });
    var msg = h('div');
    var code = h('input', { type: 'text', id: 'code', autocomplete: 'off', placeholder: 'XXXX-XXXX-XXXX' });
    var pw = h('input', { type: 'password', id: 'pw', autocomplete: setup ? 'new-password' : 'current-password' });
    var pw2 = h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password' });
    var btn = h('button', { class: 'btn btn-haupt btn-voll', type: 'submit', text: setup ? 'Passwort festlegen' : 'Anmelden' });

    var form = h('form', { onsubmit: function (e) {
      e.preventDefault();
      btn.disabled = true; msg.innerHTML = '';
      var body = setup ? { code: code.value, password: pw.value, password2: pw2.value } : { password: pw.value };
      api(setup ? 'setup' : 'login', body).then(function (res) {
        if (res.ok) { location.reload(); return; }
        btn.disabled = false;
        msg.appendChild(h('div', { class: 'meldung fehler', text: res.error || 'Das hat nicht geklappt.' }));
      });
    } },
      setup && h('div', { class: 'field' }, h('label', { for: 'code', text: 'Einrichtungscode' }), code),
      h('div', { class: 'field' }, h('label', { for: 'pw', text: setup ? 'Neues Passwort (mindestens 10 Zeichen)' : 'Passwort' }), pw),
      setup && h('div', { class: 'field' }, h('label', { for: 'pw2', text: 'Passwort wiederholen' }), pw2),
      btn
    );
    box.appendChild(h('h1', { text: setup ? 'Adminpanel einrichten' : 'Website bearbeiten' }));
    box.appendChild(h('p', { class: 'lead', text: setup
      ? 'Einmalige Einrichtung: Bitte den Einrichtungscode aus der Übergabe eingeben und ein eigenes Passwort festlegen.'
      : 'Bitte mit dem Passwort anmelden.' }));
    box.appendChild(msg);
    box.appendChild(form);
    app.appendChild(h('div', { class: 'center' }, box));
    (setup ? code : pw).focus();
  }

  // ------------------------------------------------------------------ Editor
  function renderEditor() {
    var sections = boot.sections.map(function (s) { return s; });
    sections.push({ id: '_sicherung', title: 'Passwort & Sicherung', intro: '', fields: [], special: true });

    var defaults = boot.defaults;
    var values = clone(boot.values);
    var saved = clone(boot.values);
    var current = sections[0].id;
    var fieldUpdaters = [];
    var saving = false;

    var status = h('span', { class: 'status' });
    var saveBtn = h('button', { class: 'btn btn-haupt', type: 'button', text: 'Speichern & veröffentlichen', onclick: save });
    var side = h('nav', { class: 'side', 'aria-label': 'Bereiche' });
    var main = h('div');
    var flash = h('div');

    function dirty() { return JSON.stringify(values) !== JSON.stringify(saved); }

    function openInSection(s) {
      var n = 0;
      s.fields.forEach(function (f) {
        if (f.type === 'image') { if (!values[f.key]) n++; }
        else if (f.type !== 'legal' && isPlaceholder(values[f.key])) n++;
      });
      return n;
    }
    function totalOpen() {
      var n = 0; sections.forEach(function (s) { n += openInSection(s); }); return n;
    }

    function refresh() {
      side.innerHTML = '';
      sections.forEach(function (s) {
        var n = openInSection(s);
        side.appendChild(h('button', { type: 'button', class: s.id === current ? 'aktiv' : '', onclick: function () { current = s.id; renderPanel(); refresh(); window.scrollTo(0, 0); } },
          h('span', { text: s.title }), n > 0 && h('span', { class: 'badge', title: 'Noch offen', text: String(n) })));
      });
      var d = dirty();
      var open = totalOpen();
      status.className = 'status' + (d ? ' offen' : '');
      status.textContent = d ? 'Nicht gespeicherte Änderungen' : (open > 0 ? open + ' Angabe(n)/Foto(s) noch offen' : 'Alles gespeichert');
      saveBtn.disabled = saving || !d;
      fieldUpdaters.forEach(function (fn) { fn(); });
    }

    function toast(text) {
      var t = h('div', { class: 'toast', role: 'status', text: text });
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3200);
    }
    function showErrors(list) {
      flash.innerHTML = '';
      (list || []).forEach(function (e) { flash.appendChild(h('div', { class: 'meldung fehler', text: e })); });
      window.scrollTo(0, 0);
    }

    // ---- Felder
    function textField(f, id) {
      var isArea = f.type === 'textarea' || f.type === 'legal';
      var input = isArea
        ? h('textarea', { id: id, class: f.type === 'legal' ? 'legal' : '', maxlength: f.max, rows: f.type === 'legal' ? 18 : 3 })
        : h('input', { id: id, type: 'text', maxlength: f.max });
      input.value = values[f.key] || '';
      var mark = h('span', { class: 'offen-marke', text: 'noch offen' });
      var reset = h('button', { type: 'button', class: 'link-btn', text: 'Original wiederherstellen', onclick: function () {
        values[f.key] = defaults[f.key]; input.value = defaults[f.key]; grow(); refresh();
      } });
      function grow() { if (f.type === 'textarea') { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight + 2, 420) + 'px'; } }
      input.addEventListener('input', function () { values[f.key] = input.value; grow(); refresh(); });
      var wrap = h('div', { class: 'field' },
        h('div', { class: 'field-kopf' }, h('label', { for: id, text: f.label }), mark, reset),
        input,
        f.help && h('div', { class: 'help', text: f.help }));
      fieldUpdaters.push(function () {
        mark.hidden = !(f.type !== 'legal' && isPlaceholder(values[f.key]));
        reset.hidden = f.type === 'legal' || values[f.key] === defaults[f.key];
      });
      setTimeout(grow, 0);
      return wrap;
    }

    function imageField(f, id) {
      var altInput = h('input', { id: id + '-alt', type: 'text', maxlength: 200 });
      altInput.value = values[f.alt_key] || '';
      altInput.addEventListener('input', function () { values[f.alt_key] = altInput.value; refresh(); });

      var preview = h('div', { class: 'foto-vorschau' });
      var info = h('div', { class: 'foto-status' });
      var fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (file) upload(file);
      } });
      var pick = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', onclick: function () { fileInput.click(); } });
      var remove = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Foto entfernen', onclick: function () {
        values[f.key] = ''; drawPreview(); refresh();
      } });
      var mark = h('span', { class: 'offen-marke', text: 'noch kein Foto' });

      function drawPreview() {
        preview.innerHTML = '';
        if (values[f.key]) preview.appendChild(h('img', { src: boot.site + values[f.key], alt: '' }));
        else preview.textContent = 'Noch kein Foto – auf der Website erscheint ein Platzhalter.';
        pick.textContent = values[f.key] ? 'Anderes Foto wählen' : 'Foto auswählen';
        remove.hidden = !values[f.key];
      }

      function prepare(file) {
        return new Promise(function (resolve) {
          if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            resolve({ error: 'Bitte ein Foto als JPG, PNG oder WebP wählen.' }); return;
          }
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            var w = img.naturalWidth, hgt = img.naturalHeight, s = Math.min(1, 2400 / Math.max(w, hgt));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(hgt * s));
            var ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(function (b) { resolve(b ? { blob: b } : { error: 'Das Foto konnte nicht verarbeitet werden.' }); }, 'image/jpeg', 0.86);
          };
          img.onerror = function () { URL.revokeObjectURL(url); resolve({ error: 'Das Foto konnte nicht gelesen werden.' }); };
          img.src = url;
        });
      }

      function upload(file) {
        info.className = 'foto-status'; info.textContent = 'Foto wird vorbereitet und hochgeladen …';
        pick.disabled = true;
        prepare(file).then(function (p) {
          if (p.error) { throw new Error(p.error); }
          var fd = new FormData();
          fd.append('file', p.blob, 'foto.jpg');
          return api('upload', fd, true);
        }).then(function (res) {
          if (!res.ok) { throw new Error(res.error || 'Upload fehlgeschlagen.'); }
          values[f.key] = res.path;
          info.textContent = 'Foto hochgeladen. Mit „Speichern & veröffentlichen“ wird es auf der Website sichtbar.';
          drawPreview(); refresh();
        }).catch(function (err) {
          info.className = 'foto-status fehler'; info.textContent = err.message;
        }).then(function () { pick.disabled = false; });
      }

      fieldUpdaters.push(function () { mark.hidden = !!values[f.key]; });
      drawPreview();
      return h('div', { class: 'field' },
        h('div', { class: 'field-kopf' }, h('label', { text: f.label }), mark),
        h('div', { class: 'foto' },
          preview,
          h('div', {},
            h('div', { class: 'foto-knoepfe' }, pick, remove, fileInput),
            info,
            h('label', { for: id + '-alt', text: 'Bildbeschreibung (für Sehbehinderte und Google)' }),
            altInput,
            f.help && h('div', { class: 'help', text: f.help }))));
    }

    // ---- Sonderbereich: Passwort und Sicherungen
    function securityPanel() {
      var box = h('div');
      var msg = h('div');
      var cur = h('input', { type: 'password', id: 'pw-cur', autocomplete: 'current-password' });
      var n1 = h('input', { type: 'password', id: 'pw-n1', autocomplete: 'new-password' });
      var n2 = h('input', { type: 'password', id: 'pw-n2', autocomplete: 'new-password' });
      var pwBtn = h('button', { class: 'btn btn-haupt', type: 'submit', text: 'Passwort ändern' });
      box.appendChild(h('h3', { text: 'Passwort ändern' }));
      box.appendChild(msg);
      box.appendChild(h('form', { onsubmit: function (e) {
        e.preventDefault(); msg.innerHTML = ''; pwBtn.disabled = true;
        api('password', { current: cur.value, new: n1.value, new2: n2.value }).then(function (res) {
          pwBtn.disabled = false;
          msg.appendChild(h('div', { class: 'meldung ' + (res.ok ? 'ok' : 'fehler'), text: res.ok ? 'Das Passwort wurde geändert.' : (res.error || 'Fehler.') }));
          if (res.ok) { cur.value = n1.value = n2.value = ''; }
        });
      } },
        h('div', { class: 'field' }, h('label', { for: 'pw-cur', text: 'Aktuelles Passwort' }), cur),
        h('div', { class: 'field' }, h('label', { for: 'pw-n1', text: 'Neues Passwort (mindestens 10 Zeichen)' }), n1),
        h('div', { class: 'field' }, h('label', { for: 'pw-n2', text: 'Neues Passwort wiederholen' }), n2),
        pwBtn));

      box.appendChild(h('hr', { class: 'abschnitt-trenner' }));
      box.appendChild(h('h3', { text: 'Frühere Versionen' }));
      box.appendChild(h('p', { class: 'help', text: 'Bei jedem Speichern wird die vorherige Version gesichert (die letzten 20). Mit „Laden“ werden die Texte und Fotos in den Editor geholt – sie gelten erst nach „Speichern & veröffentlichen“.' }));
      var list = h('ul', { class: 'liste' }, h('li', { text: 'Wird geladen …' }));
      box.appendChild(list);
      api('backups', {}).then(function (res) {
        list.innerHTML = '';
        if (!res.ok || !res.backups.length) { list.appendChild(h('li', { text: 'Noch keine früheren Versionen vorhanden.' })); return; }
        res.backups.forEach(function (b) {
          list.appendChild(h('li', {}, h('span', { text: b.label }),
            h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Laden', onclick: function () {
              if (dirty() && !confirm('Nicht gespeicherte Änderungen gehen dabei verloren. Fortfahren?')) return;
              api('backup_get', { file: b.file }).then(function (r) {
                if (!r.ok) { showErrors([r.error]); return; }
                values = r.values; current = sections[0].id; renderPanel(); refresh();
                toast('Version geladen. Bitte prüfen und speichern.');
              });
            } })));
        });
      });
      return box;
    }

    function renderPanel() {
      fieldUpdaters = [];
      main.innerHTML = '';
      var s = sections.filter(function (x) { return x.id === current; })[0];
      var panel = h('section', { class: 'panel' }, h('h2', { text: s.title }), s.intro && h('p', { class: 'intro', text: s.intro }));
      if (s.special) {
        panel.appendChild(securityPanel());
      } else {
        s.fields.forEach(function (f, i) {
          var id = 'f-' + s.id + '-' + i;
          panel.appendChild(f.type === 'image' ? imageField(f, id) : textField(f, id));
        });
      }
      main.appendChild(panel);
    }

    function save() {
      if (saving || !dirty()) return;
      saving = true; saveBtn.disabled = true; saveBtn.textContent = 'Wird gespeichert …'; flash.innerHTML = '';
      api('save', { values: values }).then(function (res) {
        saving = false; saveBtn.textContent = 'Speichern & veröffentlichen';
        if (res.ok) { saved = clone(values); toast('Gespeichert und veröffentlicht (' + res.savedAt + ' Uhr)'); }
        else if (res.relogin) { location.reload(); }
        else { showErrors(res.errors || [res.error || 'Speichern fehlgeschlagen.']); }
        refresh();
      });
    }

    function logout() {
      if (dirty() && !confirm('Es gibt nicht gespeicherte Änderungen. Trotzdem abmelden?')) return;
      window.onbeforeunload = null;
      api('logout', {}).then(function () { location.reload(); });
    }

    window.onbeforeunload = function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };

    app.appendChild(h('header', { class: 'topbar' },
      h('span', { class: 'titel', text: 'Website bearbeiten' }),
      status,
      h('a', { class: 'btn btn-zweit btn-klein', href: boot.site, target: '_blank', rel: 'noopener', text: 'Website ansehen' }),
      saveBtn,
      h('button', { class: 'btn btn-zweit btn-klein', type: 'button', text: 'Abmelden', onclick: logout })));
    app.appendChild(h('div', { class: 'layout' }, side, h('div', {}, flash, main)));
    renderPanel();
    refresh();
  }

  if (boot.mode === 'edit') renderEditor();
  else if (boot.mode === 'setup') renderAuth(true);
  else if (boot.mode === 'login') renderAuth(false);
})();
</script>
</body>
</html>
