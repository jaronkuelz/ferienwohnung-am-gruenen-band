// Adminpanel – Anwendungslogik. Bewusst ohne Build-Schritt/Framework, damit
// nichts installiert werden muss: eine Datei, im Browser direkt lauffähig.
(function () {
  'use strict';

  // ------------------------------------------------------------------ Helfer
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'checked') el.checked = v;
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
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
  }
  // Hochgeladenes Foto (key, aus Netlify Blobs) hat Vorrang vor einem festen
  // Start-Foto (url), das beim Website-Aufbau mitgeliefert wurde.
  function photoSrc(foto) {
    if (!foto) return null;
    if (foto.key) return '/fotos/' + foto.key;
    if (foto.url) return foto.url;
    return null;
  }
  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }

  var csrfToken = null;
  // path: z. B. "auth?action=login" oder "save". body===undefined -> GET.
  function api(path, body) {
    var opts = { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: {} };
    if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch('/.netlify/functions/' + path, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Unerwartete Antwort vom Server.' }; });
    }).catch(function () {
      return { ok: false, error: 'Keine Verbindung zum Server.' };
    });
  }

  // ------------------------------------------------------------------ Inhalts-Schema
  // Beschreibt nur Gruppen/Beschriftungen/Typen – nicht die Werte selbst.
  function sections() {
    return [
      { id: 'allgemein', title: 'Allgemein', intro: 'Grundeinstellungen der Website.', fields: [
        f('allgemein.brandName', 'Name / Logo-Text', 'text', 60, 'Steht oben im Menü und in der Fußzeile.'),
        f('allgemein.seoTitle', 'Seitentitel (für Google & Browser-Tab)', 'text', 120, 'Empfehlung: unter 60 Zeichen.'),
        f('allgemein.seoDescription', 'Kurzbeschreibung für Google', 'textarea', 300, 'Erscheint in den Suchergebnissen. Empfehlung: unter 160 Zeichen.'),
        f('allgemein.airbnbLink', 'Link zur Airbnb-Anzeige', 'text', 300, 'Gilt automatisch für alle „Buchen“-Buttons. Muss mit https:// beginnen.'),
      ]},
      { id: 'kontakt', title: 'Kontakt & Adresse', intro: 'Diese Angaben erscheinen automatisch in der Fußzeile, im Impressum und in der Datenschutzerklärung.', fields: [
        f('kontakt.name', 'Vor- und Nachname', 'text', 100),
        f('kontakt.strasse', 'Straße und Hausnummer', 'text', 100),
        f('kontakt.plzOrt', 'PLZ und Ort', 'text', 100),
        f('kontakt.email', 'E-Mail-Adresse', 'text', 150),
      ]},
      { id: 'menue', title: 'Menü', intro: 'Die Texte der Navigationsleiste oben.', fields: [
        f('menue.wohnung', 'Menüpunkt 1', 'text', 40),
        f('menue.ausstattung', 'Menüpunkt 2', 'text', 40),
        f('menue.lage', 'Menüpunkt 3', 'text', 40),
        f('menue.preise', 'Menüpunkt 4', 'text', 40),
        f('menue.verfuegbarkeit', 'Menüpunkt 5', 'text', 40),
        f('menue.kontakt', 'Menüpunkt 6', 'text', 40),
        f('menue.buchen', 'Buchen-Button im Menü', 'text', 40),
      ]},
      { id: 'start', title: 'Startbereich', intro: 'Das große Titelfoto und der Einleitungstext ganz oben.', fields: [
        f('hero.foto', 'Titelfoto', 'image', null, 'Querformat, am besten Außenansicht mit Landschaft.', 'Außenansicht der Ferienwohnung'),
        f('hero.titel', 'Überschrift', 'text', 150),
        f('hero.text', 'Einleitungstext', 'textarea', 600),
        f('hero.btnBuchen', 'Button 1 (öffnet Buchungsauswahl)', 'text', 40),
        f('hero.btnWohnung', 'Button 2 (springt zur Wohnung)', 'text', 40),
        f('hero.fakten', 'Kurzinfos (z. B. Schlafplätze)', 'list-text', 60),
      ]},
      { id: 'wohnung', title: 'Die Wohnung / Fotogalerie', intro: 'Überschrift und Fotogalerie. Fotos können hinzugefügt, entfernt und mit „hochkant“ als stehendes Format markiert werden.', fields: [
        f('wohnung.kicker', 'Kleine Überschrift', 'text', 60),
        f('wohnung.titel', 'Überschrift', 'text', 150),
        f('wohnung.text', 'Text', 'textarea', 500),
        f('wohnung.galerie', 'Fotos', 'list-galerie'),
      ]},
      { id: 'ausstattung', title: 'Ausstattung', intro: 'Die Kästchen mit der Ausstattung. Kästchen können hinzugefügt oder entfernt werden.', fields: [
        f('ausstattung.kicker', 'Kleine Überschrift', 'text', 60),
        f('ausstattung.titel', 'Überschrift', 'text', 150),
        f('ausstattung.items', 'Ausstattungs-Kästchen', 'list-ausstattung'),
      ]},
      { id: 'lage', title: 'Lage & Umgebung', intro: 'Landschaftsfoto und Stichpunkte zur Lage.', fields: [
        f('lage.foto', 'Landschaftsfoto', 'image', null, 'Zum Beispiel Grünes Band oder ein Wanderweg.', 'Landschaft am Grünen Band'),
        f('lage.kicker', 'Kleine Überschrift', 'text', 60),
        f('lage.titel', 'Überschrift', 'text', 150),
        f('lage.punkte', 'Stichpunkte', 'list-text', 200),
      ]},
      { id: 'preise', title: 'Preise', intro: 'Preiskarte mit den wichtigsten Konditionen.', fields: [
        f('preise.kicker', 'Kleine Überschrift', 'text', 60),
        f('preise.titel', 'Überschrift', 'text', 100),
        f('preise.stand', 'Hinweis unter der Überschrift', 'textarea', 300),
        f('preise.betrag', 'Preis (groß)', 'text', 30),
        f('preise.einheit', 'Einheit neben dem Preis', 'text', 60),
        f('preise.hinweis', 'Zusatzhinweis zum Preis', 'textarea', 500),
        f('preise.zeilen', 'Preiszeilen (z. B. Endreinigung)', 'list-zeile'),
        f('preise.btn', 'Button unter den Preisen', 'text', 60),
      ]},
      { id: 'verfuegbarkeit', title: 'Verfügbarkeit', intro: 'Der Kalender wird von Hand gepflegt. Er lässt sich komplett aus- und wieder einblenden.', fields: [
        f('verfuegbarkeit.aktiv', 'Kalender auf der Website anzeigen', 'checkbox', null, 'Wenn ausgeschaltet, verschwindet nur der Kalender selbst. Überschrift, Hinweistext und der Button „Auf Airbnb prüfen“ bleiben sichtbar.'),
        f('verfuegbarkeit.kicker', 'Kleine Überschrift', 'text', 60),
        f('verfuegbarkeit.titel', 'Überschrift', 'text', 100),
        f('verfuegbarkeit.intro', 'Einleitung', 'textarea', 300),
        f('verfuegbarkeit.kalenderTitel', 'Titel über dem Kalender', 'text', 60, 'Frei wählbar, z. B. „August 2026“ – wird nicht automatisch aus Monat/Jahr unten erzeugt.'),
        f('verfuegbarkeit', 'Belegte Tage eintragen', 'kalender', null, 'Monat/Jahr wählen, dann auf die belegten Tage klicken. Beim Wechsel des Monats bitte die belegten Tage neu markieren.'),
        f('verfuegbarkeit.frei', 'Legende „frei“', 'text', 20),
        f('verfuegbarkeit.belegt', 'Legende „belegt“', 'text', 20),
        f('verfuegbarkeit.hinweis', 'Hinweistext', 'textarea', 600),
        f('verfuegbarkeit.btn', 'Button', 'text', 60),
      ]},
      { id: 'buchen', title: 'Buchungsoptionen', intro: 'Das Auswahlfenster, das erscheint, wenn Gäste auf „Buchen“ klicken. Airbnb (siehe „Allgemein“) und Direktbuchung (siehe „Kontakt & Adresse“) sind schon eingerichtet. Fehlt ein Link, wird die Option auf der Website automatisch ausgeblendet.', fields: [
        f('buchen.titel', 'Überschrift im Auswahlfenster', 'text', 100),
        f('buchen.airbnbTitel', 'Titel – Airbnb', 'text', 40),
        f('buchen.airbnbText', 'Kurztext – Airbnb', 'text', 100),
        f('buchen.bookingLink', 'Link zu Booking.com', 'text', 300, 'Muss mit https:// beginnen. Leer lassen = Option wird ausgeblendet.'),
        f('buchen.bookingTitel', 'Titel – Booking.com', 'text', 40),
        f('buchen.bookingText', 'Kurztext – Booking.com', 'text', 100),
        f('buchen.landkreisLink', 'Link zur Buchungsseite des Landkreises Göttingen', 'text', 300, 'Muss mit https:// beginnen. Leer lassen = Option wird ausgeblendet.'),
        f('buchen.landkreisTitel', 'Titel – Landkreis Göttingen', 'text', 40),
        f('buchen.landkreisText', 'Kurztext – Landkreis Göttingen', 'text', 100),
        f('buchen.direktTitel', 'Titel – Direktbuchung', 'text', 40),
      ]},
      { id: 'abschluss', title: 'Abschluss', intro: 'Der Buchungsaufruf am Ende der Seite.', fields: [
        f('abschluss.titel', 'Überschrift', 'text', 150),
        f('abschluss.text', 'Text', 'textarea', 400),
        f('abschluss.btn', 'Button', 'text', 60),
      ]},
      { id: 'footer', title: 'Fußzeile', intro: 'Texte ganz unten. Name, Adresse und Kontakt stehen unter „Kontakt & Adresse“.', fields: [
        f('footer.beschreibung', 'Kurzbeschreibung', 'textarea', 300),
        f('footer.copyright', 'Copyright-Zeile', 'text', 120),
        f('footer.hinweis', 'Hinweis rechts unten', 'text', 120),
      ]},
      { id: 'impressum', title: 'Impressum', intro: 'Name, Anschrift und Kontakt werden automatisch aus „Kontakt & Adresse“ übernommen. Leere Felder blenden den jeweiligen Abschnitt aus.', fields: [
        f('impressum.ust', 'Umsatzsteuer-ID', 'text', 200, 'Nur ausfüllen, wenn vorhanden. Leer lassen = Abschnitt entfällt.'),
        f('impressum.streitEu', 'Abschnitt „EU-Streitschlichtung“', 'textarea', 600, 'Leer lassen = Abschnitt entfällt.'),
        f('impressum.streitVsbg', 'Abschnitt „Verbraucherstreitbeilegung“', 'textarea', 600, 'Leer lassen = Abschnitt entfällt.'),
        f('impressum.custom', 'Eigener Impressum-Text (optional)', 'legal', 30000, 'Wenn hier etwas steht, ersetzt es den kompletten Standardtext oben. Absätze durch eine Leerzeile trennen, Überschriften mit „## “ am Zeilenanfang.'),
      ]},
      { id: 'datenschutz', title: 'Datenschutz', intro: 'Verantwortliche Stelle wird automatisch aus „Kontakt & Adresse“ übernommen.', fields: [
        f('datenschutz.hoster', 'Name des Hosting-Anbieters', 'text', 200, 'Bei welchem Anbieter liegt die Website?'),
        f('datenschutz.logdauer', 'Speicherdauer der Server-Logfiles', 'text', 100, 'Steht in den Unterlagen des Hosters.'),
        f('datenschutz.custom', 'Eigener Datenschutz-Text (optional)', 'legal', 30000, 'Wenn hier etwas steht, ersetzt es den kompletten Standardtext. Absätze durch eine Leerzeile trennen, Überschriften mit „## “ am Zeilenanfang.'),
      ]},
    ];
  }
  function f(key, label, type, max, help, altDefault) {
    return { key: key, label: label, type: type, max: max, help: help, altDefault: altDefault };
  }

  // ------------------------------------------------------------------ Start
  var app = document.getElementById('app');

  function statusCall() {
    return fetch('/.netlify/functions/auth?action=status', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }

  statusCall().then(function (res) {
    if (!res.ok) { renderFatal(res.error || 'Unbekannter Fehler.'); return; }
    if (res.needsSetup) { renderAuth(true); }
    else if (!res.loggedIn) { renderAuth(false); }
    else { startEditor(); }
  }).catch(function () {
    renderFatal('Keine Verbindung zum Server.');
  });

  function renderFatal(message) {
    app.appendChild(h('div', { class: 'center' }, h('div', { class: 'card' },
      h('h1', { text: 'Fehler' }),
      h('p', { class: 'lead', text: message })
    )));
  }

  // ------------------------------------------------------------------ Anmeldung / Einrichtung
  function renderAuth(setup) {
    app.innerHTML = '';
    var box = h('div', { class: 'card' });
    var msg = h('div');
    var code = h('input', { type: 'text', id: 'code', autocomplete: 'off', placeholder: 'Einrichtungscode' });
    var pw = h('input', { type: 'password', id: 'pw', autocomplete: setup ? 'new-password' : 'current-password' });
    var pw2 = h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password' });
    var btn = h('button', { class: 'btn btn-haupt btn-voll', type: 'submit', text: setup ? 'Passwort festlegen' : 'Anmelden' });

    var form = h('form', { onsubmit: function (e) {
      e.preventDefault();
      btn.disabled = true; msg.innerHTML = '';
      var body = setup ? { code: code.value, password: pw.value, password2: pw2.value } : { password: pw.value };
      fetch('/.netlify/functions/auth?action=' + (setup ? 'setup' : 'login'), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res.ok) { location.reload(); return; }
        btn.disabled = false;
        msg.appendChild(h('div', { class: 'meldung fehler', text: res.error || 'Das hat nicht geklappt.' }));
      });
    } },
      setup && h('div', { class: 'field' }, h('label', { for: 'code', text: 'Einrichtungscode' }), code,
        h('div', { class: 'help', text: 'Diesen Code gibt es einmalig von der Person, die die Website eingerichtet hat.' })),
      h('div', { class: 'field' }, h('label', { for: 'pw', text: setup ? 'Neues Passwort (mindestens 10 Zeichen)' : 'Passwort' }), pw),
      setup && h('div', { class: 'field' }, h('label', { for: 'pw2', text: 'Passwort wiederholen' }), pw2),
      btn
    );
    box.appendChild(h('h1', { text: setup ? 'Adminpanel einrichten' : 'Website bearbeiten' }));
    box.appendChild(h('p', { class: 'lead', text: setup
      ? 'Einmalige Einrichtung: Bitte den Einrichtungscode eingeben und ein eigenes Passwort festlegen.'
      : 'Bitte mit dem Passwort anmelden.' }));
    box.appendChild(msg);
    box.appendChild(form);
    app.appendChild(h('div', { class: 'center' }, box));
    (setup ? code : pw).focus();
  }

  // ------------------------------------------------------------------ Editor
  function startEditor() {
    fetch('/.netlify/functions/content', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) { renderFatal(res.error); return; }
      // CSRF-Token: steckt in keinem GET, daher holen wir es indirekt über
      // einen erneuten (leisen) Login-Status-Aufruf ist nicht möglich – wir
      // bekommen den Token nur beim Login/Setup. Deshalb: Token aus dem
      // Cookie "fw_csrf" lesen (nicht HttpOnly, extra für genau diesen Zweck).
      csrfToken = readCookie('fw_csrf');
      renderEditor(res.content);
    });
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function renderEditor(initialContent) {
    app.innerHTML = '';
    var allSections = sections();
    allSections.push({ id: '_sicherung', title: 'Passwort & Sicherung', intro: '', fields: [], special: true });

    var values = clone(initialContent);
    var saved = clone(initialContent);
    var current = allSections[0].id;
    var saving = false;

    var status = h('span', { class: 'status' });
    var saveBtn = h('button', { class: 'btn btn-haupt', type: 'button', text: 'Speichern & veröffentlichen', onclick: save });
    var side = h('nav', { class: 'side', 'aria-label': 'Bereiche' });
    var main = h('div');
    var flash = h('div');

    function dirty() { return JSON.stringify(values) !== JSON.stringify(saved); }

    function refresh() {
      side.innerHTML = '';
      allSections.forEach(function (s) {
        side.appendChild(h('button', { type: 'button', class: s.id === current ? 'aktiv' : '', onclick: function () {
          current = s.id; renderPanel(); refresh(); window.scrollTo(0, 0);
        } }, h('span', { text: s.title })));
      });
      var d = dirty();
      status.className = 'status' + (d ? ' offen' : '');
      status.textContent = d ? 'Nicht gespeicherte Änderungen' : 'Alles gespeichert';
      saveBtn.disabled = saving || !d;
    }

    function toast(text) {
      var t = h('div', { class: 'toast', role: 'status', text: text });
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 3200);
    }
    function showErrors(list) {
      flash.innerHTML = '';
      (Array.isArray(list) ? list : [list]).forEach(function (e) { flash.appendChild(h('div', { class: 'meldung fehler', text: e })); });
      window.scrollTo(0, 0);
    }

    // ---- einfache Textfelder
    function textField(field) {
      var id = 'f-' + field.key;
      var isArea = field.type === 'textarea' || field.type === 'legal';
      var input = isArea
        ? h('textarea', { id: id, class: field.type === 'legal' ? 'legal' : '', maxlength: field.max, rows: field.type === 'legal' ? 16 : 3 })
        : h('input', { id: id, type: 'text', maxlength: field.max });
      input.value = getPath(values, field.key) || '';
      function grow() { if (field.type === 'textarea') { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight + 2, 420) + 'px'; } }
      input.addEventListener('input', function () { setPath(values, field.key, input.value); grow(); refresh(); });
      setTimeout(grow, 0);
      return h('div', { class: 'field' },
        h('div', { class: 'field-kopf' }, h('label', { for: id, text: field.label })),
        input,
        field.help && h('div', { class: 'help', text: field.help }));
    }

    // ---- Fotofeld (einzelnes Foto, z. B. Titelbild)
    function imageField(field) {
      var fotoObj = getPath(values, field.key) || null;
      var altId = 'f-' + field.key + '-alt';
      var preview = h('div', { class: 'foto-vorschau' });
      var info = h('div', { class: 'foto-status' });
      var altInput = h('input', { id: altId, type: 'text', maxlength: 200 });
      altInput.value = (fotoObj && fotoObj.alt) || field.altDefault || '';
      altInput.addEventListener('input', function () {
        var cur = getPath(values, field.key) || { key: null };
        cur.alt = altInput.value;
        setPath(values, field.key, cur);
        refresh();
      });

      function drawPreview() {
        var cur = getPath(values, field.key);
        var src = photoSrc(cur);
        preview.innerHTML = '';
        if (src) preview.appendChild(h('img', { src: src, alt: '' }));
        else preview.textContent = 'Noch kein Foto – auf der Website erscheint ein Platzhalter.';
        pick.textContent = src ? 'Anderes Foto wählen' : 'Foto auswählen';
        remove.hidden = !src;
      }

      var fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (file) upload(file);
      } });
      var pick = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', onclick: function () { fileInput.click(); } });
      var remove = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Foto entfernen', onclick: function () {
        if (!confirm('Dieses Foto wirklich entfernen?')) return;
        setPath(values, field.key, { key: null, url: null, alt: altInput.value });
        drawPreview(); refresh();
      } });

      function upload(file) {
        resizeImage(file).then(function (blob) {
          info.className = 'foto-status'; info.textContent = 'Foto wird hochgeladen …';
          pick.disabled = true;
          return fetch('/.netlify/functions/upload', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'image/jpeg', 'X-CSRF-Token': csrfToken },
            body: blob,
          });
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res.ok) throw new Error(res.error || 'Upload fehlgeschlagen.');
          setPath(values, field.key, { key: res.key, alt: altInput.value });
          info.textContent = 'Foto hochgeladen. Mit „Speichern & veröffentlichen“ wird es auf der Website sichtbar.';
          drawPreview(); refresh();
        }).catch(function (err) {
          info.className = 'foto-status fehler'; info.textContent = err.message;
        }).then(function () { pick.disabled = false; });
      }

      drawPreview();
      return h('div', { class: 'field' },
        h('div', { class: 'field-kopf' }, h('label', { text: field.label })),
        h('div', { class: 'foto' },
          preview,
          h('div', {},
            h('div', { class: 'foto-knoepfe' }, pick, remove, fileInput),
            info,
            h('label', { for: altId, text: 'Bildbeschreibung (für Sehbehinderte und Google)' }),
            altInput,
            field.help && h('div', { class: 'help', text: field.help }))));
    }

    // ---- Liste einfacher Texte (z. B. Stichpunkte, Kurzinfos)
    function listTextField(field) {
      var list = getPath(values, field.key) || [];
      var wrap = h('div', { class: 'field' }, h('div', { class: 'field-kopf' }, h('label', { text: field.label })));
      var itemsBox = h('div', { class: 'liste-bearbeiten' });
      function redraw() {
        itemsBox.innerHTML = '';
        list.forEach(function (val, idx) {
          var input = h('input', { type: 'text', maxlength: field.max || 300, value: val });
          input.addEventListener('input', function () { list[idx] = input.value; refresh(); });
          var del = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Entfernen', onclick: function () {
            if (!confirm('Diesen Eintrag wirklich entfernen?')) return;
            list.splice(idx, 1); setPath(values, field.key, list); redraw(); refresh();
          } });
          itemsBox.appendChild(h('div', { class: 'liste-zeile' }, input, del));
        });
      }
      redraw();
      var add = h('button', { type: 'button', class: 'btn btn-zweit', text: '+ Eintrag hinzufügen', onclick: function () {
        list.push(''); setPath(values, field.key, list); redraw(); refresh();
      } });
      wrap.appendChild(itemsBox);
      wrap.appendChild(add);
      if (field.help) wrap.appendChild(h('div', { class: 'help', text: field.help }));
      return wrap;
    }

    // ---- Liste Preiszeilen {label, wert}
    function listZeileField(field) {
      var list = getPath(values, field.key) || [];
      var wrap = h('div', { class: 'field' }, h('div', { class: 'field-kopf' }, h('label', { text: field.label })));
      var itemsBox = h('div', { class: 'liste-bearbeiten' });
      function redraw() {
        itemsBox.innerHTML = '';
        list.forEach(function (item, idx) {
          var labelInput = h('input', { type: 'text', maxlength: 60, placeholder: 'Bezeichnung, z. B. Endreinigung', value: item.label || '' });
          var wertInput = h('input', { type: 'text', maxlength: 60, placeholder: 'Wert, z. B. 30 € einmalig', value: item.wert || '' });
          labelInput.addEventListener('input', function () { item.label = labelInput.value; refresh(); });
          wertInput.addEventListener('input', function () { item.wert = wertInput.value; refresh(); });
          var del = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Entfernen', onclick: function () {
            if (!confirm('Diese Preiszeile wirklich entfernen?')) return;
            list.splice(idx, 1); redraw(); refresh();
          } });
          itemsBox.appendChild(h('div', { class: 'liste-zeile liste-zeile-doppelt' }, labelInput, wertInput, del));
        });
      }
      redraw();
      var add = h('button', { type: 'button', class: 'btn btn-zweit', text: '+ Preiszeile hinzufügen', onclick: function () {
        list.push({ label: '', wert: '' }); setPath(values, field.key, list); redraw(); refresh();
      } });
      wrap.appendChild(itemsBox);
      wrap.appendChild(add);
      return wrap;
    }

    // ---- Liste Ausstattungs-Kästchen {icon, titel, text}
    function listAusstattungField(field) {
      var list = getPath(values, field.key) || [];
      var wrap = h('div', { class: 'field' }, h('div', { class: 'field-kopf' }, h('label', { text: field.label })));
      var itemsBox = h('div', { class: 'liste-bearbeiten' });
      function redraw() {
        itemsBox.innerHTML = '';
        list.forEach(function (item, idx) {
          var iconPreview = h('div', { class: 'icon-vorschau' });
          iconPreview.innerHTML = fwIconSvg(item.icon);
          var select = h('select', {});
          Object.keys(window.FW_ICON_LABELS).forEach(function (key) {
            var opt = h('option', { value: key, text: window.FW_ICON_LABELS[key] });
            if (key === item.icon) opt.selected = true;
            select.appendChild(opt);
          });
          select.addEventListener('change', function () { item.icon = select.value; iconPreview.innerHTML = fwIconSvg(item.icon); refresh(); });
          var titelInput = h('input', { type: 'text', maxlength: 60, placeholder: 'Titel, z. B. WLAN', value: item.titel || '' });
          var textInput = h('input', { type: 'text', maxlength: 200, placeholder: 'Kurztext', value: item.text || '' });
          titelInput.addEventListener('input', function () { item.titel = titelInput.value; refresh(); });
          textInput.addEventListener('input', function () { item.text = textInput.value; refresh(); });
          var del = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Entfernen', onclick: function () {
            if (!confirm('Dieses Ausstattungs-Kästchen wirklich entfernen?')) return;
            list.splice(idx, 1); redraw(); refresh();
          } });
          itemsBox.appendChild(h('div', { class: 'ausstattung-zeile' }, iconPreview, select, titelInput, textInput, del));
        });
      }
      redraw();
      var add = h('button', { type: 'button', class: 'btn btn-zweit', text: '+ Kästchen hinzufügen', onclick: function () {
        list.push({ icon: 'stern', titel: '', text: '' }); setPath(values, field.key, list); redraw(); refresh();
      } });
      wrap.appendChild(itemsBox);
      wrap.appendChild(add);
      return wrap;
    }

    // ---- Liste Galeriefotos {foto:{key,alt}, caption, hochkant}
    function listGalerieField(field) {
      var list = getPath(values, field.key) || [];
      var wrap = h('div', { class: 'field' }, h('div', { class: 'field-kopf' }, h('label', { text: field.label })));
      var itemsBox = h('div', { class: 'galerie-bearbeiten' });
      function redraw() {
        itemsBox.innerHTML = '';
        list.forEach(function (item, idx) {
          var preview = h('div', { class: 'foto-vorschau foto-vorschau-klein' });
          function drawPreview() {
            preview.innerHTML = '';
            var src = photoSrc(item.foto);
            if (src) preview.appendChild(h('img', { src: src, alt: '' }));
            else preview.textContent = 'Kein Foto';
          }
          drawPreview();
          var fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: function () {
            var file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (file) upload(file);
          } });
          var info = h('div', { class: 'foto-status' });
          var pick = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: photoSrc(item.foto) ? 'Anderes Foto' : 'Foto wählen', onclick: function () { fileInput.click(); } });
          function upload(file) {
            resizeImage(file).then(function (blob) {
              pick.disabled = true; info.textContent = 'Wird hochgeladen …'; info.className = 'foto-status';
              return fetch('/.netlify/functions/upload', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg', 'X-CSRF-Token': csrfToken }, body: blob });
            }).then(function (r) { return r.json(); }).then(function (res) {
              if (!res.ok) throw new Error(res.error || 'Upload fehlgeschlagen.');
              item.foto = { key: res.key, alt: item.alt || '' };
              info.textContent = ''; drawPreview(); refresh();
            }).catch(function (err) { info.className = 'foto-status fehler'; info.textContent = err.message; })
              .then(function () { pick.disabled = false; });
          }
          var altInput = h('input', { type: 'text', maxlength: 150, placeholder: 'Bildbeschreibung (Alt-Text)', value: item.alt || '' });
          altInput.addEventListener('input', function () { item.alt = altInput.value; refresh(); });
          var captionInput = h('input', { type: 'text', maxlength: 40, placeholder: 'Beschriftung auf dem Foto, z. B. „Küche“', value: item.caption || '' });
          captionInput.addEventListener('input', function () { item.caption = captionInput.value; refresh(); });
          var hochkantLabel = h('label', { class: 'checkbox-zeile' });
          var hochkantBox = h('input', { type: 'checkbox', checked: !!item.hochkant });
          hochkantBox.addEventListener('change', function () { item.hochkant = hochkantBox.checked; refresh(); });
          hochkantLabel.appendChild(hochkantBox);
          hochkantLabel.appendChild(document.createTextNode(' Hochkant (stehendes Format) anzeigen'));
          var del = h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Foto entfernen', onclick: function () {
            if (!confirm('Dieses Galeriefoto wirklich entfernen?')) return;
            list.splice(idx, 1); redraw(); refresh();
          } });
          itemsBox.appendChild(h('div', { class: 'galerie-karte' },
            preview,
            h('div', { class: 'galerie-karte-felder' }, pick, fileInput, info, altInput, captionInput, hochkantLabel, del)));
        });
      }
      redraw();
      var add = h('button', { type: 'button', class: 'btn btn-zweit', text: '+ Foto hinzufügen', onclick: function () {
        list.push({ foto: null, alt: '', caption: '', hochkant: false }); setPath(values, field.key, list); redraw(); refresh();
      } });
      wrap.appendChild(itemsBox);
      wrap.appendChild(add);
      return wrap;
    }

    // ---- Sonderbereich: Passwort und Sicherungen
    function securityPanel() {
      var box = h('div');
      var msg = h('div');
      var cur = h('input', { type: 'password', autocomplete: 'current-password' });
      var n1 = h('input', { type: 'password', autocomplete: 'new-password' });
      var n2 = h('input', { type: 'password', autocomplete: 'new-password' });
      var pwBtn = h('button', { class: 'btn btn-haupt', type: 'submit', text: 'Passwort ändern' });
      box.appendChild(h('h3', { text: 'Passwort ändern' }));
      box.appendChild(msg);
      box.appendChild(h('form', { onsubmit: function (e) {
        e.preventDefault(); msg.innerHTML = ''; pwBtn.disabled = true;
        api('auth?action=password', { current: cur.value, next: n1.value, next2: n2.value }).then(function (res) {
          pwBtn.disabled = false;
          msg.appendChild(h('div', { class: 'meldung ' + (res.ok ? 'ok' : 'fehler'), text: res.ok ? 'Das Passwort wurde geändert.' : (res.error || 'Fehler.') }));
          if (res.ok) { cur.value = n1.value = n2.value = ''; }
        });
      } },
        h('div', { class: 'field' }, h('label', { text: 'Aktuelles Passwort' }), cur),
        h('div', { class: 'field' }, h('label', { text: 'Neues Passwort (mindestens 10 Zeichen)' }), n1),
        h('div', { class: 'field' }, h('label', { text: 'Neues Passwort wiederholen' }), n2),
        pwBtn));

      box.appendChild(h('hr', { class: 'abschnitt-trenner' }));
      box.appendChild(h('h3', { text: 'Frühere Versionen' }));
      box.appendChild(h('p', { class: 'help', text: 'Bei jedem Speichern wird die vorherige Version gesichert (die letzten 5). Mit „Laden“ werden die Texte und Fotos in den Editor geholt – sie gelten erst nach „Speichern & veröffentlichen“.' }));
      var list = h('ul', { class: 'liste' }, h('li', { text: 'Wird geladen …' }));
      box.appendChild(list);
      fetch('/.netlify/functions/backups', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (res) {
        list.innerHTML = '';
        if (!res.ok || !res.backups.length) { list.appendChild(h('li', { text: 'Noch keine früheren Versionen vorhanden.' })); return; }
        res.backups.forEach(function (b) {
          list.appendChild(h('li', {}, h('span', { text: b.label }),
            h('button', { type: 'button', class: 'btn btn-zweit btn-klein', text: 'Laden', onclick: function () {
              if (dirty() && !confirm('Nicht gespeicherte Änderungen gehen dabei verloren. Fortfahren?')) return;
              api('backups', { key: b.key }).then(function (r) {
                if (!r.ok) { showErrors([r.error]); return; }
                values = r.content; current = allSections[0].id; renderPanel(); refresh();
                toast('Version geladen. Bitte prüfen und speichern.');
              });
            } })));
        });
      });
      return box;
    }

    function fieldNode(field) {
      switch (field.type) {
        case 'image': return imageField(field);
        case 'checkbox': return checkboxField(field);
        case 'kalender': return kalenderField(field);
        case 'list-text': return listTextField(field);
        case 'list-zeile': return listZeileField(field);
        case 'list-ausstattung': return listAusstattungField(field);
        case 'list-galerie': return listGalerieField(field);
        default: return textField(field);
      }
    }

    // ---- Ein-/Ausschalter
    function checkboxField(field) {
      var box = h('input', { type: 'checkbox', checked: getPath(values, field.key) !== false });
      box.addEventListener('change', function () { setPath(values, field.key, box.checked); refresh(); });
      var label = h('label', { class: 'checkbox-zeile' }, box, document.createTextNode(' ' + field.label));
      return h('div', { class: 'field' }, label, field.help && h('div', { class: 'help', text: field.help }));
    }

    // ---- Kalender: Monat/Jahr wählen, belegte Tage anklicken
    function kalenderField(field) {
      var v = getPath(values, field.key); // { jahr, monat, belegteTage }
      var wrap = h('div', { class: 'field' }, h('div', { class: 'field-kopf' }, h('label', { text: field.label })));
      var monatSelect = h('select', {});
      ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].forEach(function (name, idx) {
        var opt = h('option', { value: String(idx + 1), text: name });
        if (idx + 1 === v.monat) opt.selected = true;
        monatSelect.appendChild(opt);
      });
      var jahrInput = h('input', { type: 'text', inputmode: 'numeric', maxlength: 4, value: String(v.jahr), style: 'width:6rem;' });
      var grid = h('div', { class: 'kalender-tage admin-kalender' });
      var kopf = h('div', { class: 'kalender-tage-kopf' });
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(function (t) { kopf.appendChild(h('span', { text: t })); });

      function redrawGrid() {
        grid.innerHTML = '';
        var jahr = parseInt(jahrInput.value, 10) || v.jahr;
        var monat = parseInt(monatSelect.value, 10);
        var ersterWochentag = (new Date(jahr, monat - 1, 1).getDay() + 6) % 7;
        var tageImMonat = new Date(jahr, monat, 0).getDate();
        for (var i = 0; i < ersterWochentag; i++) grid.appendChild(h('span', { class: 'leer' }));
        var belegtSet = {};
        (v.belegteTage || []).forEach(function (d) { belegtSet[d] = true; });
        for (var tag = 1; tag <= tageImMonat; tag++) {
          (function (tag) {
            var btn = h('button', { type: 'button', class: 'tag-knopf' + (belegtSet[tag] ? ' belegt' : ''), text: String(tag) });
            btn.addEventListener('click', function () {
              var list = v.belegteTage || [];
              var pos = list.indexOf(tag);
              if (pos === -1) list.push(tag); else list.splice(pos, 1);
              v.belegteTage = list;
              setPath(values, field.key, v);
              refresh();
              redrawGrid();
            });
            grid.appendChild(btn);
          })(tag);
        }
      }
      monatSelect.addEventListener('change', function () {
        v.monat = parseInt(monatSelect.value, 10); setPath(values, field.key, v); refresh(); redrawGrid();
      });
      jahrInput.addEventListener('input', function () {
        var n = parseInt(jahrInput.value, 10);
        if (n) { v.jahr = n; setPath(values, field.key, v); refresh(); }
        redrawGrid();
      });
      redrawGrid();

      wrap.appendChild(h('div', { class: 'kalender-auswahl' }, h('label', { text: 'Monat' }), monatSelect, h('label', { text: 'Jahr' }), jahrInput));
      wrap.appendChild(kopf);
      wrap.appendChild(grid);
      if (field.help) wrap.appendChild(h('div', { class: 'help', text: field.help }));
      return wrap;
    }

    function renderPanel() {
      main.innerHTML = '';
      var s = allSections.filter(function (x) { return x.id === current; })[0];
      var panel = h('section', { class: 'panel' }, h('h2', { text: s.title }), s.intro && h('p', { class: 'intro', text: s.intro }));
      if (s.special) {
        panel.appendChild(securityPanel());
      } else {
        s.fields.forEach(function (field) { panel.appendChild(fieldNode(field)); });
      }
      main.appendChild(panel);
    }

    function save() {
      if (saving || !dirty()) return;
      saving = true; saveBtn.disabled = true; saveBtn.textContent = 'Wird gespeichert …'; flash.innerHTML = '';
      api('save', { content: values }).then(function (res) {
        saving = false; saveBtn.textContent = 'Speichern & veröffentlichen';
        if (res.ok) { saved = clone(values); toast('Gespeichert und veröffentlicht.'); }
        else showErrors([res.error || 'Speichern fehlgeschlagen.']);
        refresh();
      });
    }

    function logout() {
      if (dirty() && !confirm('Es gibt nicht gespeicherte Änderungen. Trotzdem abmelden?')) return;
      window.onbeforeunload = null;
      api('auth?action=logout', {}).then(function () { location.reload(); });
    }

    window.onbeforeunload = function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };

    app.appendChild(h('header', { class: 'topbar' },
      h('span', { class: 'titel', text: 'Website bearbeiten' }),
      status,
      h('a', { class: 'btn btn-zweit btn-klein', href: '/', target: '_blank', rel: 'noopener', text: 'Website ansehen' }),
      saveBtn,
      h('button', { class: 'btn btn-zweit btn-klein', type: 'button', text: 'Abmelden', onclick: logout })));
    app.appendChild(h('div', { class: 'layout' }, side, h('div', {}, flash, main)));
    renderPanel();
    refresh();
  }

  // ------------------------------------------------------------------ Foto verkleinern (im Browser)
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        reject(new Error('Bitte ein Foto als JPG, PNG oder WebP wählen.')); return;
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
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Das Foto konnte nicht verarbeitet werden.')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Das Foto konnte nicht gelesen werden.')); };
      img.src = url;
    });
  }
})();
