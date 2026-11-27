// ============================================================
// abWeb Gastro · ALLE Inhalte der Website an einem Ort.
// Texte, Preise, Kontaktdaten, Module, FAQ: hier ändern,
// die Seiten passen sich automatisch an. Keine Änderung im Code nötig.
// ============================================================

export const company = {
  brand: 'abWeb solutions',
  product: 'abWeb Gastro',
  owner: 'Ander Bautista Martinez',
  street: 'Neuwiesenstraße 59',
  zip: '74078',
  city: 'Heilbronn',
  region: 'Baden-Württemberg',
  email: 'info@abwebsolutions.cloud',
  phone: '+49 178 4784965',
  phoneHref: '+491784784965',
  whatsapp: 'https://wa.me/491784784965',
  mainSite: 'https://abwebsolutions.cloud/',
  impressum: 'https://abwebsolutions.cloud/impressum.html',
  datenschutz: 'https://abwebsolutions.cloud/datenschutz.html',
  portalLogin: 'https://portal.abwebsolutions.cloud/',
  taxNote: 'Kleinunternehmer gemäß § 19 UStG: keine Umsatzsteuer.',
}

// Formular: Ziel-Adresse für Pilot-Anfragen.
// Erwartet einen POST mit JSON (z. B. n8n-Webhook oder Supabase-Funktion).
// Leer lassen = Formular zeigt Telefon und E-Mail als Alternative.
export const form = {
  endpoint: import.meta.env.VITE_FORM_ENDPOINT || '',
}

export const site = {
  url: 'https://gastro.abwebsolutions.cloud',
  nav: [
    { to: '/', label: 'Start' },
    { to: '/funktionen', label: 'Funktionen' },
    { to: '/reservierung', label: 'Reservierung 24/7' },
    { to: '/preise', label: 'Preise' },
    { to: '/portal', label: 'Chef-Portal Demo' },
  ],
  cta: { to: '/kontakt', label: 'Pilotmonat anfragen' },
}

// SEO pro Seite: Titel und Beschreibung (Stadt + Leistung)
export const seo = {
  '/': {
    title: 'Digitale Speisekarte, Tischbestellung & Reservierung 24/7 in Heilbronn | abWeb Gastro',
    description: 'QR-Speisekarte in der Sprache deiner Gäste, Bestellung vom Tisch, Kellner- und Küchen-App und Tischreservierung rund um die Uhr. Für Restaurants in Heilbronn.',
  },
  '/funktionen': {
    title: 'Funktionen: QR-Speisekarte, Kellner-App, Chef-Portal | abWeb Gastro Heilbronn',
    description: 'Alle Module von abWeb Gastro: QR-Speisekarte, Bestellung vom Tisch, Kellner- und Küchen-App, Reservierung 24/7 und Chef-Portal mit Kassen-Anbindung.',
  },
  '/reservierung': {
    title: 'Tischreservierung 24/7 mit Sprachassistent für Restaurants in Heilbronn | abWeb Gastro',
    description: 'Gäste reservieren online zu jeder Uhrzeit. Geht niemand ans Telefon, nimmt der Sprachassistent die Reservierung an. Für Restaurants in Heilbronn und Umgebung.',
  },
  '/preise': {
    title: 'Preise für digitale Speisekarte und Reservierung | abWeb Gastro Heilbronn',
    description: 'Basic ab 50 € und Pro ab 120 € im Monat, im ersten Jahr 30 % günstiger. Pilotmonat für 150 €, Geld zurück, wenn es dir nicht gefällt.',
  },
  '/kontakt': {
    title: 'Pilotmonat anfragen | abWeb Gastro Heilbronn',
    description: 'Teste abWeb Gastro einen Monat in deinem Restaurant in Heilbronn. Schreib uns oder ruf an, wir melden uns innerhalb von 24 Stunden.',
  },
  '/portal': {
    title: 'Chef-Portal Demo: Tische, Bestellungen, Reservierungen | abWeb Gastro',
    description: 'Probiere das Chef-Portal mit Beispieldaten aus: Tischplan live, Bestellungen, Reservierungen, Anrufe des Sprachassistenten und Rechnung an deine Kasse.',
  },
}

export const hero = {
  eyebrow: 'Für Restaurants in Heilbronn und Umgebung',
  title: 'Dein Restaurant.',
  highlight: 'Digital, rund um die Uhr.',
  lead: 'Gäste bestellen am Tisch in ihrer Sprache und reservieren auch nachts. Du siehst alles auf einem Bildschirm, und deine Kasse bleibt, wie sie ist.',
  primary: { to: '/kontakt', label: 'Pilotmonat anfragen' },
  secondary: { to: '/portal', label: 'Chef-Portal ausprobieren' },
  trust: ['DSGVO-konform', 'Server in Frankfurt', 'Monatlich kündbar', 'Deine Kasse bleibt'],
  image: { src: 'img/paella.webp', alt: 'Paella mit Meeresfrüchten in einer hellblauen Schale, wie sie auf der digitalen Speisekarte erscheint' },
  cards: [
    { title: 'Tisch 7 · neue Bestellung', text: '2× Paella, 1× Rioja', value: '48,50 €' },
    { title: 'Reservierung um 23:41 Uhr', text: 'Fam. Becker · 4 Pers. · Sa 19:30', value: 'per Sprachassistent' },
  ],
}

export const problems = {
  eyebrow: 'Kommt dir das bekannt vor?',
  title: 'Volle Abende,',
  highlight: 'zu wenig Hände.',
  items: [
    { icon: 'phone', title: 'Das Telefon klingelt im Service', text: 'Mitten im Abendgeschäft will jemand reservieren. Keiner kann rangehen, der Gast bucht woanders.' },
    { icon: 'globe', title: 'Gäste verstehen die Karte nicht', text: 'Touristen und Geschäftsleute fragen nach jedem Gericht. Das kostet Zeit am Tisch.' },
    { icon: 'clock', title: 'Gäste warten auf den Kellner', text: 'Bestellen, nachbestellen, zahlen: jedes Mal muss erst jemand kommen.' },
  ],
}

// Module: jedes funktioniert allein. Alle laufen im selben System und Portal.
export const modules = [
  { id: 'karte', icon: 'qr', tag: 'Gäste', title: 'QR-Speisekarte', text: 'Gäste scannen den Code am Tisch, wählen ihre Sprache und sehen jedes Gericht mit Foto und Allergenen.', points: ['6 Sprachen: DE, EN, ES, IT, FR, TR', 'Allergene nach deutscher Kennzeichnung', 'Gerichte ausverkauft schalten mit einem Klick'] },
  { id: 'bestellung', icon: 'bag', tag: 'Gäste', title: 'Bestellung vom Tisch', text: 'Gäste bestellen und bestellen nach, ohne auf den Kellner zu warten. Auch mit Papierkarte geht es wie gewohnt.', points: ['Bestellung landet sofort in der Küche', 'Kellner rufen per Knopf', 'Chat mit dem Kellner, automatisch übersetzt'] },
  { id: 'team', icon: 'chef', tag: 'Team', title: 'Kellner- & Küchen-App', text: 'Auf Tablet oder Handy, auf Deutsch. Jeder sieht seine Tische und die Küche ihre Bons.', points: ['Eigene Anmeldung für jede Person', 'Status: neu, kocht, fertig', 'Funktioniert im Browser, ohne Installation'] },
  { id: 'reservierung', icon: 'calendar', tag: 'Neu', title: 'Tischreservierung 24/7', text: 'Gäste buchen online zu jeder Uhrzeit. Geht niemand ans Telefon, nimmt der Sprachassistent die Reservierung an.', points: ['Online-Buchung auf deiner Website', 'Sprachassistent auf Deutsch und Englisch', 'Bestätigung per E-Mail an den Gast'] },
  { id: 'portal', icon: 'grid', tag: 'Chef', title: 'Chef-Portal', text: 'Tische, Bestellungen, Reservierungen, Anrufe, Umsatz und Personal auf einem Bildschirm.', points: ['Live-Tischplan', 'Umsatz nach Stunde und Bestseller', 'Speisekarte und Team selbst pflegen'] },
  { id: 'kasse', icon: 'receipt', tag: 'Kasse', title: 'Anbindung an deine Kasse', text: 'Du behältst deine Kasse mit TSE. Das Portal schickt die Rechnung jedes Tisches dorthin. Bezahlt wird wie immer.', points: ['Keine neue Kasse, keine neue TSE', 'Beleg kommt aus deiner Kasse', 'Ohne Schnittstelle: Rechnung ausdrucken und abtippen'] },
]

export const modulesIntro = {
  eyebrow: 'Ein System, sechs Bausteine',
  title: 'Fang mit einem Teil an.',
  highlight: 'Nimm den Rest später dazu.',
  lead: 'Jeder Baustein funktioniert allein. Alle laufen im selben System und erscheinen im selben Chef-Portal. Du schaltest weitere frei, wenn du sie brauchst.',
}

export const reservation = {
  eyebrow: 'Tischreservierung 24/7 automatisch',
  title: 'Reservierungen annehmen,',
  highlight: 'auch wenn alle beschäftigt sind.',
  lead: 'Deine Gäste reservieren, wann sie wollen: um Mitternacht online oder am Telefon, während du kochst. Du findest jede Reservierung morgens im Chef-Portal.',
  steps: [
    { title: 'Gast bucht online oder ruft an', text: 'Auf deiner Website, über Google oder per Telefon. Rund um die Uhr.' },
    { title: 'Niemand nimmt ab?', text: 'Nach dem dritten Klingeln übernimmt der Sprachassistent. Er fragt Datum, Uhrzeit, Personen und Namen.' },
    { title: 'Freier Tisch wird geprüft', text: 'Das System kennt deine Öffnungszeiten und Tische. Ist es voll, schlägt es eine andere Uhrzeit vor.' },
    { title: 'Bestätigung an den Gast', text: 'Der Gast bekommt eine E-Mail. Du siehst die Reservierung im Portal und auf dem Tischplan.' },
  ],
  faq: [
    { q: 'Wie klingt der Sprachassistent?', a: 'Wie eine freundliche Mitarbeiterin. Er sagt am Anfang, dass er ein digitaler Assistent ist, und nennt den Namen deines Restaurants.' },
    { q: 'Was passiert bei Sonderwünschen?', a: 'Fragen zu Allergien, großen Gruppen oder Feiern notiert der Assistent. Du rufst den Gast dann selbst zurück.' },
    { q: 'Brauche ich eine neue Telefonnummer?', a: 'Nein. Deine Nummer leitet nur weiter, wenn niemand abnimmt. Das stellst du bei deinem Telefonanbieter ein, wir helfen dabei.' },
  ],
  demoNote: 'Beispiel: So sieht die Buchung für deine Gäste aus. Hier wird nichts gespeichert.',
}

export const pricing = {
  eyebrow: 'Preise',
  title: 'Zwei Pakete.',
  highlight: 'Klare Monatspreise.',
  lead: 'Im ersten Jahr zahlst du 30 % weniger. Monatlich kündbar.',
  firstYearDiscount: 0.3,
  plans: [
    { id: 'basic', name: 'Basic', price: 50, for: 'Für Restaurants, die mit der digitalen Speisekarte starten.', features: ['QR-Speisekarte in 6 Sprachen', 'Bestellung vom Tisch', 'Kellner- und Küchen-App', '2 Stunden Service im Monat inklusive', 'Jede weitere Stunde 40 €'], cta: 'Basic anfragen' },
    { id: 'pro', name: 'Pro', price: 120, recommended: true, for: 'Für Restaurants, die alles in einem System wollen.', features: ['Alles aus Basic', 'Tischreservierung 24/7 mit Sprachassistent', 'Chef-Portal mit Umsatz und Personal', 'Anbindung an deine Kasse', 'Chat mit Übersetzung'], cta: 'Pro anfragen' },
  ],
  pilot: {
    title: 'Pilotmonat',
    price: 150,
    text: 'Ein Monat zum halben Preis, mit allem aus Pro. Gefällt es dir nicht, bekommst du die 150 € zurück. Das steht so im Vertrag.',
    cta: 'Pilotmonat anfragen',
  },
  note: 'Alle Preise pro Restaurant und Monat.',
}

export const faq = [
  { q: 'Muss ich meine Kasse wechseln?', a: 'Nein. Du behältst deine Kasse mit TSE. Das Chef-Portal schickt die Rechnung jedes Tisches an deine Kasse. Bezahlung und Beleg laufen dort wie gewohnt.' },
  { q: 'Was brauchen meine Gäste?', a: 'Nur ihr Handy mit Kamera. Keine App, keine Anmeldung. Wer lieber mit der Papierkarte bestellt, bestellt wie immer beim Kellner.' },
  { q: 'Was passiert mit den Daten meiner Gäste?', a: 'Gäste stimmen beim Öffnen der Karte zu. Nach dem Bezahlen werden Name und Chat gelöscht. Nur wer freiwillig seine E-Mail-Adresse hinterlässt, bleibt als Stammgast gespeichert. Die Daten liegen auf Servern in Frankfurt.' },
  { q: 'Wie lange dauert die Einrichtung?', a: 'Wir übernehmen Speisekarte, Fotos und QR-Codes für deine Tische. Meist läuft alles innerhalb einer Woche.' },
  { q: 'Kann ich nur die Reservierung nutzen?', a: 'Ja. Jeder Baustein funktioniert allein. Weitere schaltest du später im selben Portal frei.' },
]

export const contact = {
  eyebrow: 'Pilotmonat',
  title: 'Teste abWeb Gastro',
  highlight: 'einen Monat in deinem Restaurant.',
  lead: 'Schreib uns kurz, wer du bist. Ander meldet sich innerhalb von 24 Stunden und kommt gern vorbei, um alles zu zeigen.',
  success: 'Danke, {name}! Deine Anfrage ist angekommen. Ander meldet sich innerhalb von 24 Stunden bei dir.',
  error: 'Das hat leider nicht geklappt. Ruf uns an oder schreib eine E-Mail, dann melden wir uns sofort.',
  noEndpoint: 'Das Formular ist noch nicht verbunden. Ruf uns bitte an oder schreib eine E-Mail.',
}

export const finalCta = {
  title: 'Lass uns 30 Minuten sprechen.',
  text: 'Kostenlos und unverbindlich, gern bei dir im Restaurant.',
}
