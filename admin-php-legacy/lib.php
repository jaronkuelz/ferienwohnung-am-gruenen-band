<?php
// Kernlogik des Adminpanels: Pfade, Inhalte, Seitenerzeugung, Login, Foto-Upload.

// SHA-256 des einmaligen Einrichtungscodes (Code selbst steht nicht im Quelltext).
const SETUP_CODE_HASH = '00f357e580d6e791def0d6a89dfc7041d31dc2ed0e51ebc193c517ab0459ae81';

const SESSION_IDLE_SECONDS = 7200;
const MAX_LOGIN_FAILS = 5;
const LOCKOUT_SECONDS = 900;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2400;
const BACKUPS_KEEP = 20;

define('ADMIN_DIR', __DIR__);
define('SITE_DIR', dirname(__DIR__));
define('DATA_DIR', ADMIN_DIR . '/data');
define('BACKUP_DIR', DATA_DIR . '/backups');
define('UPLOAD_DIR', SITE_DIR . '/uploads');
define('TEMPLATE_FILE', ADMIN_DIR . '/template.html');
define('OUTPUT_FILE', SITE_DIR . '/index.html');
define('CONTENT_FILE', DATA_DIR . '/content.json');
define('CONFIG_FILE', DATA_DIR . '/config.php');
define('ATTEMPTS_FILE', DATA_DIR . '/attempts.json');

require_once __DIR__ . '/fields.php';

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function esc($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function ensure_dirs() {
    foreach ([DATA_DIR, BACKUP_DIR, UPLOAD_DIR] as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }
    $deny = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n";
    if (is_dir(DATA_DIR) && !is_file(DATA_DIR . '/.htaccess')) {
        @file_put_contents(DATA_DIR . '/.htaccess', $deny);
    }
}

function write_file_atomic($path, $data) {
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $data, LOCK_EX) === false) {
        return false;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

function normalize_inner($html) {
    $html = preg_replace('#<br\s*/?>#i', "\x01", $html);
    $html = preg_replace('/[ \t\r\n]+/', ' ', $html);
    $html = strip_tags($html);
    $text = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace("\x01", "\n", $text);
    $lines = array_map('trim', explode("\n", $text));
    return trim(implode("\n", $lines));
}

// ---------------------------------------------------------------------------
// Felder, Standardwerte, Inhalte
// ---------------------------------------------------------------------------

// Flache Liste aller Felder inklusive der Bildbeschreibungen (Alt-Texte).
function all_fields() {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = [];
    foreach (field_sections() as $section) {
        foreach ($section['fields'] as $f) {
            $cache[$f['key']] = $f;
            if ($f['type'] === 'image') {
                $cache[$f['alt_key']] = [
                    'key' => $f['alt_key'], 'label' => 'Bildbeschreibung', 'type' => 'alt',
                    'max' => 200, 'default' => $f['alt_default'],
                ];
            }
        }
    }
    return $cache;
}

function load_template() {
    $tpl = @file_get_contents(TEMPLATE_FILE);
    if ($tpl === false) {
        throw new RuntimeException('Die Vorlage (admin/template.html) fehlt.');
    }
    return $tpl;
}

function template_default($tpl, $key) {
    $re = '#<([a-z][a-z0-9]*)\b[^>]*?\sdata-edit="' . preg_quote($key, '#') . '"[^>]*>(.*?)</\1>#is';
    if (preg_match($re, $tpl, $m)) {
        return normalize_inner($m[2]);
    }
    return null;
}

// Standardwerte aller Felder; $missing sammelt Schlüssel, die in der Vorlage fehlen.
function default_values($tpl, &$missing = null) {
    $missing = [];
    $out = [];
    foreach (all_fields() as $key => $f) {
        switch ($f['type']) {
            case 'image':
            case 'legal':
                $out[$key] = '';
                break;
            case 'alt':
                $out[$key] = $f['default'];
                break;
            default:
                $d = template_default($tpl, $key);
                if ($d === null) {
                    $missing[] = $key;
                    $d = '';
                }
                $out[$key] = $d;
        }
    }
    return $out;
}

function load_overrides() {
    $raw = @file_get_contents(CONTENT_FILE);
    if ($raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function merge_values($defaults, $overrides) {
    $out = $defaults;
    foreach ($overrides as $k => $v) {
        if (array_key_exists($k, $defaults) && is_string($v)) {
            $out[$k] = $v;
        }
    }
    return $out;
}

function is_placeholder($value) {
    return (bool)preg_match('/\[[^\]\n]{2,}\]/u', (string)$value);
}

// Zählt Felder mit [Platzhalter] und nicht hochgeladene Fotos.
function open_counts($values) {
    $placeholders = 0;
    $photos = 0;
    foreach (all_fields() as $key => $f) {
        if ($f['type'] === 'image') {
            if (($values[$key] ?? '') === '') {
                $photos++;
            }
        } elseif (in_array($f['type'], ['text', 'textarea'], true) && is_placeholder($values[$key] ?? '')) {
            $placeholders++;
        }
    }
    return ['placeholders' => $placeholders, 'photos' => $photos];
}

// Prüft und bereinigt eingehende Werte. Rückgabe: [bereinigte Werte, Fehlerliste].
function sanitize_values($input, $defaults) {
    $clean = [];
    $errors = [];
    foreach (all_fields() as $key => $f) {
        if (!array_key_exists($key, $input) || !is_string($input[$key])) {
            $clean[$key] = $defaults[$key];
            continue;
        }
        $v = str_replace(["\r\n", "\r"], "\n", $input[$key]);
        $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $v);
        $v = trim($v);
        if ($f['type'] === 'text' || $f['type'] === 'alt') {
            $v = trim(preg_replace('/\s*\n\s*/', ' ', $v));
        }
        $label = isset($f['label']) ? $f['label'] : $key;
        $max = (int)$f['max'];
        if (function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') > $max : strlen($v) > $max) {
            $errors[] = "„{$label}“ ist zu lang (höchstens {$max} Zeichen).";
            continue;
        }
        if ($key === 'airbnb.link' && !preg_match('#^https://[^\s"<>]+$#', $v)) {
            $errors[] = 'Der Airbnb-Link muss mit https:// beginnen und darf keine Leerzeichen enthalten.';
            continue;
        }
        if ($key === 'kontakt.email' && $v !== '' && !is_placeholder($v) && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Die E-Mail-Adresse sieht nicht gültig aus.';
            continue;
        }
        if ($f['type'] === 'image' && $v !== '') {
            if (!preg_match('#^uploads/foto-[a-f0-9]{12}\.(jpg|png|webp)$#', $v) || !is_file(SITE_DIR . '/' . $v)) {
                $errors[] = 'Ein Foto wurde nicht gefunden. Bitte erneut hochladen.';
                continue;
            }
        }
        $clean[$key] = $v;
    }
    return [$clean, $errors];
}

function save_content($values, $defaults) {
    ensure_dirs();
    $overrides = [];
    foreach ($values as $k => $v) {
        if ($v !== ($defaults[$k] ?? null)) {
            $overrides[$k] = $v;
        }
    }
    if (is_file(CONTENT_FILE)) {
        @copy(CONTENT_FILE, BACKUP_DIR . '/content-' . date('Ymd-His') . '.json');
        prune_backups();
    }
    $json = json_encode($overrides, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    return write_file_atomic(CONTENT_FILE, $json);
}

function list_backups() {
    $files = glob(BACKUP_DIR . '/content-*.json') ?: [];
    rsort($files);
    $out = [];
    foreach ($files as $f) {
        if (preg_match('/content-(\d{8})-(\d{6})\.json$/', $f, $m)) {
            $ts = DateTime::createFromFormat('Ymd-His', $m[1] . '-' . $m[2]);
            $out[] = ['file' => basename($f), 'label' => $ts ? $ts->format('d.m.Y, H:i:s') . ' Uhr' : basename($f)];
        }
    }
    return $out;
}

function prune_backups() {
    $files = glob(BACKUP_DIR . '/content-*.json') ?: [];
    rsort($files);
    foreach (array_slice($files, BACKUPS_KEEP) as $old) {
        @unlink($old);
    }
}

// Löscht hochgeladene Fotos, die nirgends mehr verwendet werden (und älter als 1 Stunde sind).
function cleanup_uploads($values) {
    $used = [];
    foreach (all_fields() as $key => $f) {
        if ($f['type'] === 'image' && ($values[$key] ?? '') !== '') {
            $used[basename($values[$key])] = true;
        }
    }
    // Fotos, die in gesicherten Versionen vorkommen, bleiben erhalten.
    foreach (glob(BACKUP_DIR . '/content-*.json') ?: [] as $backup) {
        if (preg_match_all('#uploads/(foto-[a-f0-9]{12}\.(?:jpg|png|webp))#', (string)@file_get_contents($backup), $m)) {
            foreach ($m[1] as $name) {
                $used[$name] = true;
            }
        }
    }
    foreach (glob(UPLOAD_DIR . '/foto-*') ?: [] as $file) {
        if (!isset($used[basename($file)]) && (time() - (int)@filemtime($file)) > 3600) {
            @unlink($file);
        }
    }
}

// ---------------------------------------------------------------------------
// Seite erzeugen (Vorlage + Inhalte => index.html)
// ---------------------------------------------------------------------------

function legal_html($text) {
    $out = '';
    foreach (preg_split('/\n{2,}/', trim($text)) as $block) {
        $block = trim($block);
        if ($block === '') {
            continue;
        }
        if (strpos($block, '## ') === 0) {
            $parts = explode("\n", $block, 2);
            $out .= '<p><strong>' . esc(substr($parts[0], 3)) . '</strong></p>';
            $block = isset($parts[1]) ? trim($parts[1]) : '';
            if ($block === '') {
                continue;
            }
        }
        $out .= '<p>' . nl2br(esc($block), false) . '</p>';
    }
    return $out;
}

function render_page($tpl, $v) {
    $fields = all_fields();
    $html = $tpl;

    // 1) Eigene Rechtstexte ersetzen den Standardtext komplett
    $html = preg_replace_callback(
        '#(<div\b[^>]*\sdata-rechtstext="([a-z]+)"[^>]*>)(.*?)(</div>)#is',
        function ($m) use ($v) {
            $custom = trim($v[$m[2] . '.custom'] ?? '');
            return $custom === '' ? $m[0] : $m[1] . legal_html($custom) . $m[4];
        },
        $html
    );

    // 2) Abschnitte ausblenden, deren Feld leer ist
    $html = preg_replace_callback(
        '#<([a-z][a-z0-9]*)\b[^>]*?\sdata-hide-empty="([^"]+)"[^>]*>.*?</\1>[ \t]*\n?#is',
        function ($m) use ($v) {
            return trim($v[$m[2]] ?? '') === '' ? '' : $m[0];
        },
        $html
    );

    // 3) Fotos einsetzen
    $html = preg_replace_callback(
        '#<([a-z][a-z0-9]*)\b[^>]*?\sdata-img="([a-z0-9_]+)"[^>]*>#i',
        function ($m) use ($v) {
            $tag = $m[0];
            $key = $m[2];
            $path = $v['img.' . $key] ?? '';
            if ($path === '') {
                return $tag;
            }
            $alt = $v['img.' . $key . '.alt'] ?? '';
            if (preg_match('/\sclass="[^"]*"/', $tag)) {
                $tag = preg_replace_callback('/\sclass="([^"]*)"/', function ($c) {
                    return ' class="' . $c[1] . ' hat-foto"';
                }, $tag, 1);
            } else {
                $tag = preg_replace('/^<([a-z0-9]+)/i', '<$1 class="hat-foto"', $tag, 1);
            }
            $tag = str_replace(' aria-hidden="true"', '', $tag);
            $loading = $key === 'hero' ? ' fetchpriority="high"' : ' loading="lazy"';
            return $tag . '<img class="foto-bild" src="' . esc($path) . '" alt="' . esc($alt) . '"' . $loading . ' decoding="async">';
        },
        $html
    );

    // 4) E-Mail-Link und Meta-Beschreibung
    $html = preg_replace_callback(
        '#<a\b[^>]*?\sdata-mailto="([^"]+)"[^>]*>#i',
        function ($m) use ($v) {
            $mail = esc($v[$m[1]] ?? '');
            return preg_replace_callback('/\shref="[^"]*"/', function () use ($mail) {
                return ' href="mailto:' . $mail . '"';
            }, $m[0], 1);
        },
        $html
    );
    $html = preg_replace_callback(
        '#<meta\b[^>]*?\sdata-meta="([^"]+)"[^>]*>#i',
        function ($m) use ($v) {
            $val = esc($v[$m[1]] ?? '');
            return preg_replace_callback('/\scontent="[^"]*"/', function () use ($val) {
                return ' content="' . $val . '"';
            }, $m[0], 1);
        },
        $html
    );

    // 5) Texte einsetzen
    $html = preg_replace_callback(
        '#(<([a-z][a-z0-9]*)\b[^>]*?\sdata-edit="([^"]+)"[^>]*>)(.*?)(</\2>)#is',
        function ($m) use ($v, $fields) {
            $key = $m[3];
            if (!isset($fields[$key]) || !array_key_exists($key, $v)) {
                return $m[0];
            }
            $text = esc($v[$key]);
            if ($fields[$key]['type'] === 'textarea') {
                $text = nl2br($text, false);
            }
            return $m[1] . $text . $m[5];
        },
        $html
    );

    // 6) Buchungs-Links im Skript (Airbnb, Booking.com, Landkreis Göttingen)
    foreach (['airbnb.link' => 'AIRBNB_LINK', 'booking.link' => 'BOOKING_LINK', 'landkreis.link' => 'LANDKREIS_LINK'] as $key => $const) {
        $link = json_encode($v[$key] ?? '', JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $html = preg_replace_callback('#const ' . $const . ' = "[^"]*";#', function () use ($link, $const) {
            return 'const ' . $const . ' = ' . $link . ';';
        }, $html);
    }

    // 7) Steuer-Attribute entfernen
    $html = preg_replace('/\sdata-(?:edit|img|mailto|hide-empty|meta|rechtstext)="[^"]*"/', '', $html);

    return $html;
}

// Airbnb-Standardlink steht in der Vorlage im Skript.
function template_airbnb_link($tpl) {
    return preg_match('#const AIRBNB_LINK = "([^"]*)";#', $tpl, $m) ? $m[1] : '';
}
function template_booking_link($tpl) {
    return preg_match('#const BOOKING_LINK = "([^"]*)";#', $tpl, $m) ? $m[1] : '';
}
function template_landkreis_link($tpl) {
    return preg_match('#const LANDKREIS_LINK = "([^"]*)";#', $tpl, $m) ? $m[1] : '';
}

function publish($tpl, $values) {
    $html = render_page($tpl, $values);
    if (strpos($html, '<html') === false || strpos($html, '</html>') === false) {
        throw new RuntimeException('Die erzeugte Seite ist unvollständig. Es wurde nichts veröffentlicht.');
    }
    if (!write_file_atomic(OUTPUT_FILE, $html)) {
        throw new RuntimeException('index.html konnte nicht geschrieben werden. Bitte die Schreibrechte des Website-Ordners beim Hoster prüfen.');
    }
}

// Alle Daten für den Editor (Standardwerte inkl. Airbnb-Link aus der Vorlage).
function editor_state() {
    $tpl = load_template();
    $defaults = default_values($tpl);
    $defaults['airbnb.link'] = template_airbnb_link($tpl);
    $defaults['booking.link'] = template_booking_link($tpl);
    $defaults['landkreis.link'] = template_landkreis_link($tpl);
    $values = merge_values($defaults, load_overrides());
    return [$tpl, $defaults, $values];
}

// ---------------------------------------------------------------------------
// Sitzung, Login, Sicherheit
// ---------------------------------------------------------------------------

function start_session() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/admin/index.php')), '/') . '/';
    session_name('fw_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $path,
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function csrf_token() {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_valid() {
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return is_string($sent) && $sent !== '' && hash_equals(csrf_token(), $sent);
}

function is_logged_in() {
    if (empty($_SESSION['auth']) || $_SESSION['auth'] !== true) {
        return false;
    }
    if (time() - (int)($_SESSION['last'] ?? 0) > SESSION_IDLE_SECONDS) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['last'] = time();
    return true;
}

function log_in() {
    session_regenerate_id(true);
    $_SESSION['auth'] = true;
    $_SESSION['last'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function load_config() {
    if (!is_file(CONFIG_FILE)) {
        return null;
    }
    $cfg = include CONFIG_FILE;
    return is_array($cfg) ? $cfg : null;
}

function save_config($passwordHash) {
    ensure_dirs();
    $php = "<?php\nreturn " . var_export(['password_hash' => $passwordHash], true) . ";\n";
    return write_file_atomic(CONFIG_FILE, $php);
}

function client_key() {
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function attempts_load() {
    $raw = @file_get_contents(ATTEMPTS_FILE);
    $data = $raw ? json_decode($raw, true) : [];
    return is_array($data) ? $data : [];
}

function attempts_save($data) {
    $now = time();
    foreach ($data as $k => $e) {
        if (($e['locked_until'] ?? 0) < $now && ($e['first'] ?? 0) < $now - LOCKOUT_SECONDS) {
            unset($data[$k]);
        }
    }
    write_file_atomic(ATTEMPTS_FILE, json_encode($data));
}

// Sekunden bis zum Ende der Sperre (0 = nicht gesperrt).
function lockout_remaining() {
    $e = attempts_load()[client_key()] ?? null;
    if ($e && ($e['locked_until'] ?? 0) > time()) {
        return (int)$e['locked_until'] - time();
    }
    return 0;
}

function register_failure() {
    $data = attempts_load();
    $k = client_key();
    $now = time();
    $e = $data[$k] ?? ['count' => 0, 'first' => $now, 'locked_until' => 0];
    if ($now - ($e['first'] ?? $now) > LOCKOUT_SECONDS) {
        $e = ['count' => 0, 'first' => $now, 'locked_until' => 0];
    }
    $e['count']++;
    if ($e['count'] >= MAX_LOGIN_FAILS) {
        $e['locked_until'] = $now + LOCKOUT_SECONDS;
        $e['count'] = 0;
        $e['first'] = $now;
    }
    $data[$k] = $e;
    attempts_save($data);
    sleep(1);
}

function clear_failures() {
    $data = attempts_load();
    unset($data[client_key()]);
    attempts_save($data);
}

function normalize_setup_code($code) {
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$code));
}

function setup_code_valid($code) {
    return hash_equals(SETUP_CODE_HASH, hash('sha256', normalize_setup_code($code)));
}

function password_problem($pw) {
    if (strlen($pw) < 10) {
        return 'Das Passwort muss mindestens 10 Zeichen lang sein.';
    }
    return null;
}

// ---------------------------------------------------------------------------
// Foto-Upload
// ---------------------------------------------------------------------------

// Rückgabe: [true, 'uploads/foto-xxxx.jpg'] oder [false, 'Fehlermeldung'].
function handle_image_upload($file) {
    if (!isset($file['error']) || is_array($file['error'])) {
        return [false, 'Ungültiger Upload.'];
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        return [false, 'Das Foto ist zu groß für den Server. Bitte ein kleineres Foto wählen.'];
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return [false, 'Der Upload ist fehlgeschlagen (Code ' . (int)$file['error'] . ').'];
    }
    if ($file['size'] > MAX_UPLOAD_BYTES) {
        return [false, 'Das Foto ist größer als 12 MB.'];
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        return [false, 'Ungültiger Upload.'];
    }
    $info = @getimagesize($file['tmp_name']);
    if (!$info) {
        return [false, 'Das ist keine Bilddatei. Erlaubt sind JPG, PNG und WebP.'];
    }
    $type = $info[2];
    if (!in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        return [false, 'Erlaubt sind nur JPG, PNG und WebP.'];
    }
    if ($info[0] * $info[1] > 50000000) {
        return [false, 'Das Foto hat zu viele Pixel.'];
    }
    ensure_dirs();
    if (!is_dir(UPLOAD_DIR) || !is_writable(UPLOAD_DIR)) {
        return [false, 'Der Ordner „uploads“ ist nicht beschreibbar. Bitte Schreibrechte beim Hoster prüfen.'];
    }
    $name = 'foto-' . bin2hex(random_bytes(6));

    $canEncode = function_exists('imagejpeg') && function_exists('imagecreatetruecolor');
    $canDecode = [
        IMAGETYPE_JPEG => function_exists('imagecreatefromjpeg'),
        IMAGETYPE_PNG => function_exists('imagecreatefrompng'),
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp'),
    ][$type];

    if ($canEncode && $canDecode) {
        $src = $type === IMAGETYPE_JPEG ? @imagecreatefromjpeg($file['tmp_name'])
            : ($type === IMAGETYPE_PNG ? @imagecreatefrompng($file['tmp_name']) : @imagecreatefromwebp($file['tmp_name']));
        if (!$src) {
            return [false, 'Das Foto konnte nicht gelesen werden.'];
        }
        if ($type === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($file['tmp_name']);
            $angle = [3 => 180, 6 => -90, 8 => 90][$exif['Orientation'] ?? 1] ?? 0;
            if ($angle !== 0 && function_exists('imagerotate')) {
                $rot = imagerotate($src, $angle, 0);
                if ($rot) {
                    imagedestroy($src);
                    $src = $rot;
                }
            }
        }
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, MAX_IMAGE_SIDE / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $dest = UPLOAD_DIR . '/' . $name . '.jpg';
        $ok = imagejpeg($dst, $dest, 85);
        imagedestroy($src);
        imagedestroy($dst);
        if (!$ok) {
            return [false, 'Das Foto konnte nicht gespeichert werden.'];
        }
        @chmod($dest, 0644);
        return [true, 'uploads/' . $name . '.jpg'];
    }

    // Ohne GD-Erweiterung: Original speichern (Typ wurde oben geprüft).
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$type];
    $dest = UPLOAD_DIR . '/' . $name . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        return [false, 'Das Foto konnte nicht gespeichert werden.'];
    }
    @chmod($dest, 0644);
    return [true, 'uploads/' . $name . '.' . $ext];
}
