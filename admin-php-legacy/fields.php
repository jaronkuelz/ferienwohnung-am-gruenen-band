<?php
// Schema aller bearbeitbaren Inhalte. Die Standardtexte stehen in template.html
// (Attribut data-edit="schluessel"); hier stehen nur Gruppen, Beschriftungen und Typen.
//
// Typen: text (einzeilig), textarea (mehrzeilig), image (Foto), legal (langer Rechtstext)

function t($key, $label, $max = 300, $help = '') {
    return ['key' => $key, 'label' => $label, 'type' => 'text', 'max' => $max, 'help' => $help];
}
function ta($key, $label, $max = 2000, $help = '') {
    return ['key' => $key, 'label' => $label, 'type' => 'textarea', 'max' => $max, 'help' => $help];
}
function img($key, $label, $altDefault, $help = '') {
    return ['key' => 'img.' . $key, 'label' => $label, 'type' => 'image', 'max' => 200, 'help' => $help,
            'alt_key' => 'img.' . $key . '.alt', 'alt_default' => $altDefault];
}

function field_sections() {
    $sections = [];

    $sections[] = ['id' => 'allgemein', 'title' => 'Allgemein', 'intro' => 'Grundeinstellungen der Website.', 'fields' => [
        t('brand.name', 'Name / Logo-Text', 60, 'Steht oben im Menü und in der Fußzeile.'),
        t('seo.title', 'Seitentitel (für Google & Browser-Tab)', 120, 'Empfehlung: unter 60 Zeichen.'),
        ta('seo.description', 'Kurzbeschreibung für Google', 300, 'Erscheint in den Suchergebnissen. Empfehlung: unter 160 Zeichen.'),
        t('airbnb.link', 'Link zur Airbnb-Anzeige', 300, 'Gilt automatisch für alle „Buchen“-Buttons. Muss mit https:// beginnen.'),
    ]];

    $sections[] = ['id' => 'kontakt', 'title' => 'Kontakt & Adresse', 'intro' => 'Diese Angaben erscheinen automatisch in der Fußzeile, im Impressum und in der Datenschutzerklärung. Sie müssen nur hier geändert werden.', 'fields' => [
        t('kontakt.name', 'Vor- und Nachname', 100),
        t('kontakt.strasse', 'Straße und Hausnummer', 100),
        t('kontakt.plz_ort', 'PLZ und Ort', 100),
        t('kontakt.email', 'E-Mail-Adresse', 150),
    ]];

    $sections[] = ['id' => 'menue', 'title' => 'Menü', 'intro' => 'Die Texte der Navigationsleiste oben.', 'fields' => [
        t('nav.wohnung', 'Menüpunkt 1', 40),
        t('nav.ausstattung', 'Menüpunkt 2', 40),
        t('nav.lage', 'Menüpunkt 3', 40),
        t('nav.preise', 'Menüpunkt 4', 40),
        t('nav.verfuegbarkeit', 'Menüpunkt 5', 40),
        t('nav.kontakt', 'Menüpunkt 6', 40),
        t('nav.buchen', 'Buchen-Button im Menü', 40),
    ]];

    $sections[] = ['id' => 'start', 'title' => 'Startbereich', 'intro' => 'Das große Titelbild und der Einleitungstext ganz oben.', 'fields' => [
        img('hero', 'Titelbild', 'Außenansicht der Ferienwohnung am Grünen Band', 'Querformat, am besten Außenansicht mit Landschaft.'),
        t('hero.titel', 'Überschrift', 150),
        ta('hero.text', 'Einleitungstext', 600),
        t('hero.btn_buchen', 'Button 1 (Airbnb)', 40),
        t('hero.btn_wohnung', 'Button 2 (zur Wohnung)', 40),
        t('hero.fakt1', 'Kurzinfo 1', 60),
        t('hero.fakt2', 'Kurzinfo 2', 60),
        t('hero.fakt3', 'Kurzinfo 3', 60),
        t('hero.fakt4', 'Kurzinfo 4', 60),
    ]];

    $sections[] = ['id' => 'wohnung', 'title' => 'Die Wohnung', 'intro' => 'Überschrift und Fotogalerie. Das erste Foto wird groß angezeigt, das letzte über die ganze Breite.', 'fields' => [
        t('wohnung.kicker', 'Kleine Überschrift', 60),
        t('wohnung.titel', 'Überschrift', 150),
        ta('wohnung.text', 'Text', 500),
        img('gal1', 'Foto 1 (groß)', 'Wohnbereich der Ferienwohnung'),
        t('gal1.caption', 'Beschriftung Foto 1', 40, 'Leer lassen = keine Beschriftung.'),
        img('gal2', 'Foto 2 (breit)', 'Küche der Ferienwohnung'),
        t('gal2.caption', 'Beschriftung Foto 2', 40, 'Leer lassen = keine Beschriftung.'),
        img('gal3', 'Foto 3', 'Schlafzimmer der Ferienwohnung'),
        t('gal3.caption', 'Beschriftung Foto 3', 40, 'Leer lassen = keine Beschriftung.'),
        img('gal4', 'Foto 4', 'Bad der Ferienwohnung'),
        t('gal4.caption', 'Beschriftung Foto 4', 40, 'Leer lassen = keine Beschriftung.'),
        img('gal5', 'Foto 5 (ganze Breite)', 'Dachbalkon der Ferienwohnung', 'Am besten ein Querformat-Foto.'),
        t('gal5.caption', 'Beschriftung Foto 5', 40, 'Leer lassen = keine Beschriftung.'),
    ]];

    $aus = [
        t('aus.kicker', 'Kleine Überschrift', 60),
        t('aus.titel', 'Überschrift', 150),
    ];
    for ($i = 1; $i <= 7; $i++) {
        $aus[] = t("aus$i.titel", "Ausstattung $i – Titel", 60);
        $aus[] = ta("aus$i.text", "Ausstattung $i – Text", 200);
    }
    $sections[] = ['id' => 'ausstattung', 'title' => 'Ausstattung', 'intro' => 'Die sieben Kästchen mit der Ausstattung. Die Symbole bleiben fest.', 'fields' => $aus];

    $sections[] = ['id' => 'lage', 'title' => 'Lage & Umgebung', 'intro' => 'Landschaftsfoto und Stichpunkte zur Lage.', 'fields' => [
        img('lage', 'Landschaftsfoto', 'Landschaft am Grünen Band', 'Zum Beispiel Grünes Band oder ein Wanderweg.'),
        t('lage.kicker', 'Kleine Überschrift', 60),
        t('lage.titel', 'Überschrift', 150),
        t('lage.punkt1', 'Stichpunkt 1', 200),
        t('lage.punkt2', 'Stichpunkt 2', 200),
        t('lage.punkt3', 'Stichpunkt 3', 200),
        t('lage.punkt4', 'Stichpunkt 4', 200),
    ]];

    $preise = [
        t('preise.kicker', 'Kleine Überschrift', 60),
        t('preise.titel', 'Überschrift', 100),
        ta('preise.stand', 'Hinweis unter der Überschrift', 300, 'Zum Beispiel „Stand 19.09.2026“.'),
        t('preise.betrag', 'Preis (groß)', 30),
        t('preise.einheit', 'Einheit neben dem Preis', 60),
        ta('preise.hinweis', 'Zusatzhinweis zum Preis', 500),
    ];
    for ($i = 1; $i <= 5; $i++) {
        $preise[] = t("preise.z$i.label", "Zeile $i – Bezeichnung", 60);
        $preise[] = t("preise.z$i.wert", "Zeile $i – Wert", 60);
    }
    $preise[] = t('preise.btn', 'Button unter den Preisen', 60);
    $sections[] = ['id' => 'preise', 'title' => 'Preise', 'intro' => 'Preiskarte mit den wichtigsten Konditionen.', 'fields' => $preise];

    $sections[] = ['id' => 'verfuegbarkeit', 'title' => 'Verfügbarkeit', 'intro' => 'Der Beispiel-Kalender ist nur eine Illustration. Hier lassen sich die Texte drumherum ändern.', 'fields' => [
        t('verf.kicker', 'Kleine Überschrift', 60),
        t('verf.titel', 'Überschrift', 100),
        ta('verf.intro', 'Einleitung', 300),
        t('verf.kalender_titel', 'Titel über dem Kalender', 60),
        t('verf.frei', 'Legende „frei“', 20),
        t('verf.belegt', 'Legende „belegt“', 20),
        ta('verf.hinweis', 'Hinweistext', 600),
        t('verf.btn', 'Button', 60),
    ]];

    $sections[] = ['id' => 'buchungsoptionen', 'title' => 'Buchungsoptionen', 'intro' => 'Das Auswahlfenster, das erscheint, wenn Gäste auf „Buchen“ klicken. Airbnb (siehe „Allgemein“) und Direktbuchung (siehe „Kontakt & Adresse“) sind schon eingerichtet.', 'fields' => [
        t('buchen.titel', 'Überschrift im Auswahlfenster', 100),
        t('buchen.airbnb_titel', 'Titel – Airbnb', 40),
        t('buchen.airbnb_text', 'Kurztext – Airbnb', 100),
        t('booking.link', 'Link zu Booking.com', 300, 'Muss mit https:// beginnen.'),
        t('buchen.booking_titel', 'Titel – Booking.com', 40),
        t('buchen.booking_text', 'Kurztext – Booking.com', 100),
        t('landkreis.link', 'Link zur Buchungsseite des Landkreises Göttingen', 300, 'Muss mit https:// beginnen.'),
        t('buchen.landkreis_titel', 'Titel – Landkreis Göttingen', 40),
        t('buchen.landkreis_text', 'Kurztext – Landkreis Göttingen', 100),
        t('buchen.direkt_titel', 'Titel – Direktbuchung', 40),
    ]];

    $sections[] = ['id' => 'abschluss', 'title' => 'Abschluss', 'intro' => 'Der Buchungsaufruf am Ende der Seite.', 'fields' => [
        t('cta.titel', 'Überschrift', 150),
        ta('cta.text', 'Text', 400),
        t('cta.btn', 'Button', 60),
    ]];

    $sections[] = ['id' => 'fusszeile', 'title' => 'Fußzeile', 'intro' => 'Texte ganz unten. Name, Adresse und Kontakt stehen unter „Kontakt & Adresse“.', 'fields' => [
        ta('footer.beschreibung', 'Kurzbeschreibung', 300),
        t('footer.copyright', 'Copyright-Zeile', 120),
        t('footer.hinweis', 'Hinweis rechts unten', 120),
    ]];

    $sections[] = ['id' => 'impressum', 'title' => 'Impressum', 'intro' => 'Name, Anschrift und Kontakt werden automatisch aus „Kontakt & Adresse“ übernommen. Leere Felder blenden den jeweiligen Abschnitt aus.', 'fields' => [
        t('impressum.ust', 'Umsatzsteuer-ID', 200, 'Nur ausfüllen, wenn vorhanden. Leer lassen = Abschnitt entfällt.'),
        ta('impressum.streit_eu', 'Abschnitt „EU-Streitschlichtung“', 600, 'Leer lassen = Abschnitt entfällt.'),
        ta('impressum.streit_vsbg', 'Abschnitt „Verbraucherstreitbeilegung“', 600, 'Leer lassen = Abschnitt entfällt.'),
        ['key' => 'impressum.custom', 'label' => 'Eigener Impressum-Text (optional)', 'type' => 'legal', 'max' => 30000,
         'help' => 'Wenn hier etwas steht, ersetzt es den kompletten Standardtext oben. Zum Beispiel ein Text aus einem Generator. Absätze durch eine Leerzeile trennen, Überschriften mit „## “ am Zeilenanfang.'],
    ]];

    $sections[] = ['id' => 'datenschutz', 'title' => 'Datenschutz', 'intro' => 'Verantwortliche Stelle wird automatisch aus „Kontakt & Adresse“ übernommen.', 'fields' => [
        t('datenschutz.hoster', 'Name des Hosting-Anbieters', 200, 'Bei welchem Anbieter liegt die Website? (z. B. IONOS SE, Montabaur)'),
        t('datenschutz.logdauer', 'Speicherdauer der Server-Logfiles', 100, 'Steht in den Unterlagen des Hosters. Häufig „7 Tagen“.'),
        ['key' => 'datenschutz.custom', 'label' => 'Eigener Datenschutz-Text (optional)', 'type' => 'legal', 'max' => 30000,
         'help' => 'Wenn hier etwas steht, ersetzt es den kompletten Standardtext. Absätze durch eine Leerzeile trennen, Überschriften mit „## “ am Zeilenanfang.'],
    ]];

    return $sections;
}
