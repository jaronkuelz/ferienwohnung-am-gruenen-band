// Lädt den Seiteninhalt (Texte, Fotos) vom Adminpanel-Speicher und füllt die
// Seite damit. Ohne diese Datei bleibt die Seite leer – sie ist bewusst so
// gebaut, dass beliebig viele Ausstattungs-Kästchen, Galeriefotos usw.
// möglich sind (siehe Adminpanel: dort können Einträge hinzugefügt/entfernt
// werden, hier wird einfach so viel gerendert, wie da ist).
(function () {
  'use strict';

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function legalHtml(text) {
    var blocks = String(text || '').trim().split(/\n{2,}/).filter(function (b) { return b.trim() !== ''; });
    return blocks
      .map(function (block) {
        block = block.trim();
        var out = '';
        if (block.indexOf('## ') === 0) {
          var idx = block.indexOf('\n');
          var heading = idx === -1 ? block.slice(3) : block.slice(3, idx);
          out += '<p><strong>' + escapeHtml(heading) + '</strong></p>';
          block = idx === -1 ? '' : block.slice(idx + 1).trim();
          if (!block) return out;
        }
        out += '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>';
        return out;
      })
      .join('');
  }

  function setTexts(content) {
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var value = getPath(content, el.getAttribute('data-k'));
      el.textContent = value == null ? '' : value;
    });
  }

  // Ein Foto-Objekt zeigt entweder auf ein hochgeladenes Foto (key, über
  // Netlify Blobs) oder – solange noch nichts hochgeladen wurde – auf ein
  // festes Start-Foto (url, eine normale Datei im Projekt). Hochgeladene
  // Fotos haben immer Vorrang.
  function photoSrc(foto) {
    if (!foto) return null;
    if (foto.key) return '/fotos/' + foto.key;
    if (foto.url) return foto.url;
    return null;
  }

  function setFoto(container, foto) {
    // Vorhandenes Foto (falls beim letzten Laden schon eins gesetzt war) entfernen.
    var existing = container.querySelector('img.foto-bild');
    if (existing) existing.remove();
    var src = photoSrc(foto);
    if (src) {
      container.classList.add('hat-foto');
      var img = document.createElement('img');
      img.className = 'foto-bild';
      img.src = src;
      img.alt = (foto && foto.alt) || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      container.insertBefore(img, container.firstChild);
    } else {
      container.classList.remove('hat-foto');
    }
    return container.querySelector('img.foto-bild');
  }

  function renderFakten(container, fakten) {
    container.innerHTML = '';
    (fakten || []).forEach(function (text) {
      var span = document.createElement('span');
      span.textContent = text;
      container.appendChild(span);
    });
  }

  function renderGalerie(container, items) {
    container.innerHTML = '';
    var vergroesserbar = [];
    (items || []).forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'galerie-bild' + (item.hochkant ? ' hochkant' : '');
      var img = null;
      var src = photoSrc(item.foto);
      if (src) {
        div.classList.add('hat-foto');
        img = document.createElement('img');
        img.className = 'foto-bild';
        img.src = src;
        img.alt = item.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        div.appendChild(img);
      }
      if (item.caption) {
        var span = document.createElement('span');
        span.className = 'galerie-etikett';
        span.textContent = item.caption;
        div.appendChild(span);
      }
      container.appendChild(div);
      if (img) vergroesserbar.push(img);
    });
    return vergroesserbar;
  }

  function renderAusstattung(container, items) {
    container.innerHTML = '';
    (items || []).forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'ausstattung-item';
      var kreis = document.createElement('div');
      kreis.className = 'icon-kreis';
      kreis.innerHTML = fwIconSvg(item.icon);
      var textWrap = document.createElement('div');
      var strong = document.createElement('strong');
      strong.textContent = item.titel || '';
      var p = document.createElement('p');
      p.textContent = item.text || '';
      textWrap.appendChild(strong);
      textWrap.appendChild(p);
      div.appendChild(kreis);
      div.appendChild(textWrap);
      container.appendChild(div);
    });
  }

  function renderPunkte(container, punkte) {
    container.innerHTML = '';
    (punkte || []).forEach(function (text) {
      var li = document.createElement('li');
      li.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4 10-10"/></svg>';
      var span = document.createElement('span');
      span.textContent = text;
      li.appendChild(span);
      container.appendChild(li);
    });
  }

  var WOCHENTAGE_MO_START = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  function renderKalender(container, jahr, monat, belegteTage) {
    if (!container) return;
    container.innerHTML = '';
    var belegtSet = {};
    (belegteTage || []).forEach(function (d) { belegtSet[d] = true; });
    var ersterWochentag = (new Date(jahr, monat - 1, 1).getDay() + 6) % 7; // 0 = Montag
    var tageImMonat = new Date(jahr, monat, 0).getDate();
    for (var i = 0; i < ersterWochentag; i++) {
      container.appendChild(h('leer'));
    }
    for (var tag = 1; tag <= tageImMonat; tag++) {
      var span = document.createElement('span');
      if (belegtSet[tag]) span.className = 'belegt';
      span.textContent = tag;
      container.appendChild(span);
    }
    function h(cls) {
      var s = document.createElement('span');
      s.className = cls;
      return s;
    }
  }

  // Beim Ausschalten verschwindet nur der Kalender selbst – Überschrift,
  // Hinweistext und der Airbnb-Button bleiben stehen, damit Gäste die
  // Verfügbarkeit weiterhin dort prüfen können.
  function applyVerfuegbarkeitToggle(aktiv) {
    var kalenderKarte = document.getElementById('kalender-karte');
    var grid = document.getElementById('verfuegbarkeit-grid');
    if (kalenderKarte) kalenderKarte.style.display = aktiv ? '' : 'none';
    if (grid) grid.classList.toggle('ohne-kalender', !aktiv);
  }

  function renderZeilen(container, zeilen) {
    container.innerHTML = '';
    (zeilen || []).forEach(function (zeile) {
      var li = document.createElement('li');
      var a = document.createElement('span');
      a.textContent = zeile.label || '';
      var b = document.createElement('span');
      b.textContent = zeile.wert || '';
      li.appendChild(a);
      li.appendChild(b);
      container.appendChild(li);
    });
  }

  function setLinks(content) {
    var links = {
      '.js-airbnb-link': getPath(content, 'allgemein.airbnbLink'),
      '.js-booking-link': getPath(content, 'buchen.bookingLink'),
      '.js-landkreis-link': getPath(content, 'buchen.landkreisLink'),
    };
    Object.keys(links).forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        var url = links[selector];
        if (url) {
          el.href = url;
          el.style.display = '';
        } else {
          // Kein Link hinterlegt: Option ausblenden statt eines toten Links.
          el.style.display = 'none';
        }
      });
    });

    var email = getPath(content, 'kontakt.email') || '';
    ['fuss-mailto', 'direkt-mailto'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.href = email ? 'mailto:' + email : '#';
        el.textContent = email;
      }
    });
  }

  function applyHideEmpty(content) {
    document.querySelectorAll('[data-hide-empty]').forEach(function (el) {
      var value = getPath(content, el.getAttribute('data-hide-empty'));
      el.style.display = value && String(value).trim() !== '' ? '' : 'none';
    });
  }

  function applyLegalCustom(content) {
    var impressumCustom = getPath(content, 'impressum.custom');
    var impressumEl = document.getElementById('impressum-inhalt');
    if (impressumCustom && impressumEl) {
      impressumEl.innerHTML = legalHtml(impressumCustom);
    }
    var datenschutzCustom = getPath(content, 'datenschutz.custom');
    var datenschutzEl = document.getElementById('datenschutz-inhalt');
    if (datenschutzCustom && datenschutzEl) {
      datenschutzEl.innerHTML = legalHtml(datenschutzCustom);
    }
  }

  function setMeta(content) {
    var title = getPath(content, 'allgemein.seoTitle');
    if (title) document.title = title;
    var desc = getPath(content, 'allgemein.seoDescription');
    var metaEl = document.getElementById('seo-description');
    if (metaEl && desc) metaEl.setAttribute('content', desc);
  }

  function wireDialogs() {
    var buchenDialog = document.getElementById('buchen-dialog');
    var direktDialog = document.getElementById('direkt-dialog');

    document.querySelectorAll('.js-buchen-oeffnen').forEach(function (button) {
      button.addEventListener('click', function () {
        if (buchenDialog) buchenDialog.showModal();
      });
    });
    document.querySelectorAll('.js-direkt-oeffnen').forEach(function (button) {
      button.addEventListener('click', function () {
        if (buchenDialog) buchenDialog.close();
        if (direktDialog) direktDialog.showModal();
      });
    });
    document.querySelectorAll('dialog').forEach(function (dialog) {
      dialog.querySelectorAll('[data-buchen-schliessen]').forEach(function (button) {
        button.addEventListener('click', function () { dialog.close(); });
      });
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  function wireLightbox(images) {
    var bildDialog = document.getElementById('bild-dialog');
    var bildDialogImg = document.getElementById('bild-dialog-img');
    if (!bildDialog || !bildDialogImg) return;
    images.forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Foto vergrößern: ' + img.alt);
      function openImage() {
        bildDialogImg.src = img.src;
        bildDialogImg.alt = img.alt;
        bildDialog.showModal();
      }
      img.addEventListener('click', openImage);
      img.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openImage();
        }
      });
    });
  }

  function wireRechtslinks() {
    function rechtsbereichOeffnen(ankerId) {
      var bereich = document.getElementById(ankerId);
      if (bereich && bereich.tagName === 'DETAILS') bereich.open = true;
    }
    document.querySelectorAll('.js-rechtslink').forEach(function (link) {
      link.addEventListener('click', function () {
        rechtsbereichOeffnen(link.dataset.rechtsZiel);
      });
    });
    if (window.location.hash) rechtsbereichOeffnen(window.location.hash.substring(1));
  }

  function render(content) {
    setMeta(content);
    setTexts(content);
    setFoto(document.querySelector('[data-foto="hero"]'), content.hero.foto);
    setFoto(document.querySelector('[data-foto="lage"]'), content.lage.foto);
    renderFakten(document.querySelector('[data-list="hero.fakten"]'), content.hero.fakten);
    var galerieBilder = renderGalerie(document.querySelector('[data-list="wohnung.galerie"]'), content.wohnung.galerie);
    renderAusstattung(document.querySelector('[data-list="ausstattung.items"]'), content.ausstattung.items);
    renderPunkte(document.querySelector('[data-list="lage.punkte"]'), content.lage.punkte);
    renderZeilen(document.querySelector('[data-list="preise.zeilen"]'), content.preise.zeilen);
    applyVerfuegbarkeitToggle(content.verfuegbarkeit.aktiv !== false);
    renderKalender(document.getElementById('kalender-tage'), content.verfuegbarkeit.jahr, content.verfuegbarkeit.monat, content.verfuegbarkeit.belegteTage);
    setLinks(content);
    applyHideEmpty(content);
    applyLegalCustom(content);
    wireDialogs();
    wireLightbox(galerieBilder);
    wireRechtslinks();
  }

  fetch('/.netlify/functions/content')
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || 'Inhalt konnte nicht geladen werden.');
      render(res.content);
    })
    .catch(function (err) {
      console.error('Seiteninhalt konnte nicht geladen werden:', err);
      var main = document.getElementById('hauptinhalt');
      if (main) {
        var warnung = document.createElement('p');
        warnung.style.cssText = 'padding:2rem; text-align:center; color:#b3261e;';
        warnung.textContent = 'Die Inhalte konnten gerade nicht geladen werden. Bitte die Seite neu laden.';
        main.prepend(warnung);
      }
    });
})();
