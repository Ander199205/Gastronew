// ============================================================
// Chef-Portal · Beispieldaten (Demo). Später kommen sie aus Supabase.
// Module: active=true erscheint unter "Mein Restaurant",
// active=false unter "Mehr für dein Restaurant" mit "Aktivieren".
// ============================================================

export const restaurant = { name: 'Casa Lucía', owner: 'Lucía', staffOnDuty: ['Carmen', 'Jonas'] }

export const portalModules = [
  { id: 'uebersicht', label: 'Übersicht', module: null },
  { id: 'tische', label: 'Tische', module: 'karte' },
  { id: 'bestellungen', label: 'Bestellungen', module: 'bestellung' },
  { id: 'reservierungen', label: 'Reservierungen', module: 'reservierung' },
  { id: 'anrufe', label: 'Anrufe', module: 'reservierung' },
  { id: 'kasse', label: 'Kassen-Anbindung', module: 'kasse' },
  { id: 'speisekarte', label: 'Speisekarte', module: 'karte' },
  { id: 'personal', label: 'Personal', module: 'team' },
]

// Welche Bausteine dieses Restaurant gebucht hat
export const activeModules = { karte: true, bestellung: true, team: true, reservierung: true, portal: true, kasse: true }

export const kasse = {
  name: 'Deine Cloud-Kasse',
  connected: true,
  options: ['Cloud-Kasse mit Schnittstelle', 'Kasse ohne Schnittstelle (Rechnung drucken)'],
}

export const tables = [
  { n: 1, seats: 2, state: 'frei' },
  { n: 2, seats: 2, state: 'besetzt', guests: 2, minutes: 34, items: [['Bruschetta', 2, 7.5], ['Tiramisu', 2, 7.0], ['Wasser 0,75 l', 1, 5.5]] },
  { n: 3, seats: 4, state: 'zahlt', guests: 4, minutes: 71, items: [['Paella de marisco', 1, 24.5], ['Pulpo a la gallega', 2, 16.5], ['Flasche Rioja', 1, 28.0]] },
  { n: 4, seats: 4, state: 'reserviert', res: '19:30 Becker' },
  { n: 5, seats: 4, state: 'besetzt', guests: 3, minutes: 12, items: [['Pulpo a la gallega', 1, 16.5], ['Risotto ai funghi', 1, 15.0], ['Weißwein 0,2 l', 2, 6.0]] },
  { n: 6, seats: 2, state: 'frei' },
  { n: 7, seats: 2, state: 'besetzt', guests: 2, minutes: 4, items: [['Paella de marisco', 2, 24.5], ['Rioja 0,2 l', 1, 6.0]] },
  { n: 8, seats: 2, state: 'reserviert', res: '20:00 Yilmaz' },
  { n: 9, seats: 6, state: 'besetzt', guests: 6, minutes: 58, items: [['Croquetas', 3, 8.0], ['Chuletón', 2, 32.0], ['Pollo asado', 2, 18.5], ['Bier 0,5 l', 4, 4.8]] },
  { n: 10, seats: 2, state: 'frei' },
  { n: 11, seats: 2, state: 'zahlt', guests: 2, minutes: 66, items: [['Lachs vom Grill', 2, 22.0], ['Crema catalana', 2, 6.5]] },
  { n: 12, seats: 4, state: 'frei' },
]

export const orders = [
  { id: 1, table: 7, text: '2× Paella, 1× Rioja', state: 'neu', min: 1 },
  { id: 2, table: 5, text: 'Pulpo, Risotto', state: 'kocht', min: 9 },
  { id: 3, table: 2, text: '2× Tiramisu', state: 'fertig', min: 2 },
  { id: 4, table: 9, text: 'Kellner gerufen', state: 'ruf', min: 0 },
]

export const reservations = [
  { time: '19:30', name: 'Becker', pax: 4, table: 4, via: 'Sprachassistent' },
  { time: '20:00', name: 'Yilmaz', pax: 2, table: 8, via: 'Online' },
  { time: '20:15', name: 'Rossi', pax: 5, table: null, via: 'Online' },
  { time: '21:00', name: 'Schneider', pax: 2, table: null, via: 'Telefon' },
]

export const calls = [
  { time: '23:41', text: 'Reservierung Fam. Becker, 4 Pers., Sa 19:30', result: 'Reserviert' },
  { time: '18:52', text: 'Frage nach glutenfreien Gerichten', result: 'Beantwortet' },
  { time: '17:20', text: 'Gruppe mit 12 Personen am 12.12.', result: 'Rückruf nötig' },
]

export const revenueByHour = [
  ['12', 180], ['13', 260], ['14', 140], ['15', 40], ['16', 30], ['17', 60], ['18', 190], ['19', 284], ['20', 100], ['21', 0], ['22', 0],
]

export const menu = [
  { name: 'Paella de marisco', cat: 'Hauptgericht', price: 24.5, sold: 18, available: true },
  { name: 'Pulpo a la gallega', cat: 'Hauptgericht', price: 16.5, sold: 11, available: true },
  { name: 'Risotto ai funghi', cat: 'Hauptgericht', price: 15.0, sold: 7, available: true },
  { name: 'Chuletón', cat: 'Hauptgericht', price: 32.0, sold: 4, available: false },
  { name: 'Tiramisu', cat: 'Dessert', price: 7.0, sold: 9, available: true },
]

export const staff = [
  { name: 'Carmen', role: 'Service', since: '17:00', tables: [1, 2, 3, 4, 5, 6] },
  { name: 'Jonas', role: 'Service', since: '18:00', tables: [7, 8, 9, 10, 11, 12] },
  { name: 'Miguel', role: 'Küche', since: '16:30', tables: [] },
]
