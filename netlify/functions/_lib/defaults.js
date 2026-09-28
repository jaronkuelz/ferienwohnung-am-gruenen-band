// Startinhalt der Website. Wird nur benutzt, solange noch nichts über das
// Adminpanel gespeichert wurde. Enthält bereits die aktuellen echten Angaben.
function defaultContent() {
  return {
    allgemein: {
      brandName: 'Am Grünen Band',
      seoTitle: 'Ferienwohnung am Grünen Band – Ruhe, Natur, Wandern & Radfahren',
      seoDescription:
        'Private Ferienwohnung am Grünen Band – ruhige Naturlage, ideal zum Wandern und Radfahren. Buchbar über Airbnb, Booking.com und mehr.',
      airbnbLink: 'https://www.airbnb.de/rooms/45636309',
    },
    kontakt: {
      name: 'Dr. Brigitte Rempp',
      strasse: 'Im Tiefen Weg 1',
      plzOrt: '37130 Gleichen',
      email: 'fewoamgruenenband@t-online.de',
    },
    menue: {
      wohnung: 'Die Wohnung',
      ausstattung: 'Ausstattung',
      lage: 'Lage',
      preise: 'Preise',
      verfuegbarkeit: 'Verfügbarkeit',
      kontakt: 'Kontakt',
      buchen: 'Buchen',
    },
    hero: {
      foto: null, // kein Titelfoto vorhanden – siehe Hinweis an die Kundin

      titel: 'Ferienwohnung am Grünen Band – Zeit für Ruhe und Natur',
      text:
        'Eine zum Niedrigenergiehaus umgebaute alte Scheune im Dreiländereck Niedersachsen/Hessen/Thüringen – in einem kleinen Dorf mit rund 200 Einwohnern in der Gemeinde Gleichen.',
      btnBuchen: 'Buchen',
      btnWohnung: 'Wohnung ansehen',
      fakten: ['👥 bis zu 6 Schlafplätze', '🛏 1 Schlafzimmer', '📐 ca. 80 m²', '🐾 Haustiere erlaubt (10 €/Nacht)'],
    },
    wohnung: {
      kicker: 'Die Wohnung',
      titel: 'Hell, gemütlich und mit Blick ins Grüne',
      text: 'Ein Rundgang durch die Räume – von Wohnbereich bis Dachbalkon. Fotos folgen, sobald verfügbar.',
      galerie: [
        { foto: { key: null, url: '/fotos-start/wohnbereich.jpg' }, alt: 'Wohnbereich der Ferienwohnung', caption: 'Wohnbereich', hochkant: false },
        { foto: { key: null, url: '/fotos-start/kueche.jpg' }, alt: 'Küche der Ferienwohnung', caption: 'Küche', hochkant: false },
        { foto: { key: null, url: '/fotos-start/schlafzimmer.jpg' }, alt: 'Schlafzimmer der Ferienwohnung', caption: 'Schlafzimmer', hochkant: false },
        { foto: { key: null, url: '/fotos-start/bad.jpg' }, alt: 'Bad der Ferienwohnung', caption: 'Bad', hochkant: false },
        { foto: { key: null, url: '/fotos-start/dachbalkon.jpg' }, alt: 'Dachbalkon der Ferienwohnung', caption: 'Dachbalkon', hochkant: true },
      ],
    },
    ausstattung: {
      kicker: 'Ausstattung',
      titel: 'Alles, was Sie für einen entspannten Aufenthalt brauchen',
      items: [
        { icon: 'wifi', titel: 'WLAN', text: 'Kostenfreies Internet' },
        { icon: 'kueche', titel: 'Küche', text: 'E-Herd, Mikrowelle, Kühlschrank, Spülmaschine, Kaffeemaschine' },
        { icon: 'bad', titel: 'Bad', text: 'Badewanne und separate Dusche' },
        { icon: 'heizung', titel: 'Fußbodenheizung', text: 'Angenehme Wärme im ganzen Raum' },
        { icon: 'tv', titel: 'TV', text: 'Fernseher vorhanden' },
        { icon: 'ebike', titel: 'E-Bike-Ladestation', text: 'Zum Aufladen direkt am Haus' },
        { icon: 'klima', titel: 'Klimaanlage', text: 'Für angenehme Kühle an warmen Tagen' },
      ],
    },
    lage: {
      foto: { key: null, url: '/fotos-start/landschaft.jpg', alt: 'Landschaft am Grünen Band' },
      kicker: 'Lage & Umgebung',
      titel: 'Am Grünen Band',
      punkte: [
        'Im Tiefen Weg 1, 37130 Gleichen',
        'Lage im Dreiländereck Niedersachsen, Hessen und Thüringen',
        'Kleines Dorf mit rund 200 Einwohnern, Gemeinde Gleichen',
        'Die Wohnung selbst: eine zum Niedrigenergiehaus umgebaute alte Scheune mit Dachbalkon',
      ],
    },
    preise: {
      kicker: 'Preise & Konditionen',
      titel: 'Kosten',
      stand: 'Preise bitte regelmäßig mit Airbnb abgleichen.',
      betrag: '50 €',
      einheit: '/ Nacht (2 Personen)',
      hinweis:
        '60 € pro Nacht an Wochenenden und Feiertagen. Der Spitzboden ist zusätzlich für 15 € pro Nacht und Person buchbar.',
      zeilen: [
        { label: 'Mindestaufenthalt', wert: '2 Nächte' },
        { label: 'Endreinigung', wert: '30 € einmalig' },
        { label: 'Bettwäsche & Handtücher', wert: '10 € pro Aufenthalt' },
        { label: 'Haustiere', wert: '10 € pro Nacht' },
      ],
      btn: 'Genauen Preis auf Airbnb ansehen',
    },
    verfuegbarkeit: {
      aktiv: true,
      kicker: 'Verfügbarkeit',
      titel: 'Kalender',
      intro: 'Bereits gebuchte Termine sind grau markiert.',
      kalenderTitel: 'August 2026',
      jahr: 2026,
      monat: 8,
      belegteTage: [6, 7, 8, 17, 18, 19, 20, 21],
      frei: 'frei',
      belegt: 'belegt',
      hinweis:
        'Dieser Kalender wird von Hand gepflegt. Für die verbindliche Verfügbarkeit gilt zusätzlich der Kalender auf Airbnb.',
      btn: 'Verfügbarkeit auf Airbnb prüfen',
    },
    buchen: {
      titel: 'Wie möchten Sie buchen?',
      airbnbTitel: 'Airbnb',
      airbnbText: 'Bewertungen und Sofortbuchung',
      bookingLink: '',
      bookingTitel: 'Booking.com',
      bookingText: 'Buchen wie gewohnt über Booking.com',
      landkreisLink: '',
      landkreisTitel: 'Landkreis Göttingen',
      landkreisText: 'Buchungsportal der Region',
      direktTitel: 'Direktbuchung',
    },
    abschluss: {
      titel: 'Bereit für Ruhe, Natur und Zeit zu zweit?',
      text: 'Sichern Sie sich Ihren Aufenthalt in der Ferienwohnung am Grünen Band – wählen Sie einfach Ihren bevorzugten Buchungsweg.',
      btn: 'Buchen',
    },
    footer: {
      beschreibung: 'Private Ferienwohnung in ruhiger Naturlage – ideal zum Wandern und Radfahren.',
      copyright: '© 2026 Ferienwohnung am Grünen Band',
      hinweis: 'Buchbar über Airbnb, Booking.com und mehr',
    },
    impressum: {
      ust: '',
      streitEu:
        'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/. Unsere E-Mail-Adresse finden Sie oben unter „Kontakt".',
      streitVsbg: 'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
      custom: '',
    },
    datenschutz: {
      hoster: 'Netlify, Inc., San Francisco (USA)',
      logdauer: 'wenigen Tagen',
      custom: '',
    },
  };
}

// Feste Auswahl an Symbolen für die Ausstattungs-Kästchen (SVG-Pfade werden
// im Browser gezeichnet, siehe icons.js). Wer ein neues Kästchen hinzufügt,
// wählt eines dieser Symbole aus.
const AUSSTATTUNG_ICONS = ['wifi', 'kueche', 'bad', 'heizung', 'tv', 'ebike', 'klima', 'parken', 'haustier', 'stern'];

module.exports = { defaultContent, AUSSTATTUNG_ICONS };
