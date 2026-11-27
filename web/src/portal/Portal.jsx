import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as D from '../content/portal-demo.js'
import { modules as MOD } from '../content/site.js'
import { eur, Icon, Logo, useSeo } from '../components/ui.jsx'

const ICON = { uebersicht: 'grid', tische: 'qr', bestellungen: 'bag', reservierungen: 'calendar', anrufe: 'mic', kasse: 'receipt', speisekarte: 'menu', personal: 'users', module: 'lock' }
const STATE_PILL = { neu: 'warn', kocht: 'blue', fertig: 'good', ruf: 'bad' }
const NEXT = { neu: 'kocht', kocht: 'fertig', fertig: 'serviert' }

const total = (t) => (t.items || []).reduce((a, [, q, p]) => a + q * p, 0)

export default function Portal() {
  useSeo()
  const [view, setView] = useState('uebersicht')
  const [active, setActive] = useState(D.activeModules)
  const [tables, setTables] = useState(D.tables)
  const [orders, setOrders] = useState(D.orders)
  const [menu, setMenu] = useState(D.menu)
  const [sel, setSel] = useState(3)
  const [sent, setSent] = useState({})
  const [toast, setToast] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(''), 3800) }
  const go = (v) => { setView(v); setNavOpen(false) }
  const isOn = (id) => { const m = D.portalModules.find((x) => x.id === id)?.module; return !m || active[m] }

  const kpi = useMemo(() => {
    const busy = tables.filter((t) => t.state === 'besetzt' || t.state === 'zahlt')
    return {
      umsatz: D.revenueByHour.reduce((a, [, v]) => a + v, 0) + 0,
      belegt: busy.length,
      zahlen: tables.filter((t) => t.state === 'zahlt').length,
    }
  }, [tables])

  const table = tables.find((t) => t.n === sel)

  function sendToKasse(t) {
    setSent({ ...sent, [t.n]: true })
    say(`Rechnung Tisch ${t.n} (${eur(total(t))}) an ${D.kasse.name} gesendet. Bezahlung und Beleg laufen dort.`)
  }
  function advance(o) {
    const n = NEXT[o.state]
    if (o.state === 'ruf') { setOrders(orders.filter((x) => x.id !== o.id)); say(`Tisch ${o.table}: Ruf erledigt.`); return }
    if (n === 'serviert') { setOrders(orders.filter((x) => x.id !== o.id)); say(`Tisch ${o.table}: serviert.`); return }
    setOrders(orders.map((x) => (x.id === o.id ? { ...x, state: n } : x)))
  }

  const pill = (cls, txt) => <span className={'pill p-' + cls}>{txt}</span>

  // ---------- Bausteine der Ansichten ----------
  const TablePlan = ({ big }) => (
    <div className={'tables' + (big ? ' big' : '')} role="list">
      {tables.map((t) => (
        <button type="button" role="listitem" key={t.n} className={'t s-' + t.state + (sel === t.n ? ' sel' : '')} onClick={() => setSel(t.n)} aria-pressed={sel === t.n}>
          <b>T{t.n}</b>
          <span>{t.state === 'frei' ? `frei · ${t.seats} Pl.` : t.state === 'reserviert' ? t.res : `${t.guests} Pers. · ${t.minutes} min`}</span>
          {t.state === 'zahlt' && <em>will zahlen</em>}
        </button>
      ))}
    </div>
  )

  const Bill = () => (
    <section className="card bill">
      <h3>Rechnung · Tisch {table.n} <span className="mut">{active.kasse ? 'an deine Kasse' : 'zum Ausdrucken'}</span></h3>
      {table.items?.length ? (
        <>
          <div className="lines">
            {table.items.map(([n, q, p]) => <div className="line" key={n}><span>{q}× {n}</span><span className="num">{eur(q * p)}</span></div>)}
            <div className="line sum"><span>Summe inkl. MwSt.</span><span className="num">{eur(total(table))}</span></div>
          </div>
          <div className="billbtns">
            {active.kasse
              ? <button type="button" className="btn pri" disabled={sent[table.n]} onClick={() => sendToKasse(table)}>{sent[table.n] ? 'An Kasse gesendet' : 'An Kasse senden'}</button>
              : <button type="button" className="btn pri" onClick={() => say('Im echten Portal öffnet sich hier der Druck.')}>Rechnung drucken</button>}
            <button type="button" className="btn sec" onClick={() => say('Teilen: Gäste zahlen getrennt in deiner Kasse.')}>Teilen</button>
          </div>
          <p className="kassehint"><i className={active.kasse && D.kasse.connected ? 'on' : ''} />{active.kasse ? 'Verbunden mit deiner Kasse · Bezahlung und Beleg laufen dort wie gewohnt' : 'Ohne Kassen-Anbindung: Rechnung drucken und in deine Kasse übernehmen'}</p>
        </>
      ) : <p className="mut">Tisch {table.n} hat keine offenen Bestellungen.</p>}
    </section>
  )

  const OrdersList = ({ full }) => (
    <section className="card">
      <h3>Bestellungen <span className="mut">Küche</span></h3>
      {orders.length === 0 && <p className="mut">Keine offenen Bestellungen.</p>}
      {orders.map((o) => (
        <div className="row" key={o.id}>
          <span><b>T{o.table}</b> {o.text}{full && <small className="mut"> · vor {o.min} min</small>}</span>
          <span className="rowact">{pill(STATE_PILL[o.state], { neu: 'Neu', kocht: 'Kocht', fertig: 'Fertig', ruf: 'Ruf' }[o.state])}
            <button type="button" className="btn tiny sec" onClick={() => advance(o)}>{o.state === 'ruf' ? 'Erledigt' : o.state === 'fertig' ? 'Serviert' : 'Weiter'}</button></span>
        </div>
      ))}
    </section>
  )

  const ResList = () => (
    <section className="card">
      <h3>Reservierungen heute <span className="mut">{D.reservations.length}</span></h3>
      {D.reservations.map((r) => (
        <div className="row" key={r.time + r.name}><span><b className="num">{r.time}</b> {r.name} · {r.pax} Pers.{r.table ? ` · T${r.table}` : ''}</span>{pill(r.via === 'Sprachassistent' ? 'blue' : r.via === 'Telefon' ? 'neutral' : 'good', r.via)}</div>
      ))}
    </section>
  )

  const Calls = () => (
    <section className="card">
      <h3>Anrufe Sprachassistent <span className="mut">letzte 24 h</span></h3>
      {D.calls.map((c) => (
        <div className="row" key={c.time}><span><b className="num">{c.time}</b> {c.text}</span>{pill(c.result === 'Rückruf nötig' ? 'warn' : 'good', c.result)}</div>
      ))}
    </section>
  )

  const Revenue = () => {
    const max = Math.max(...D.revenueByHour.map(([, v]) => v))
    return (
      <section className="card">
        <h3>Umsatz nach Stunde <span className="mut">heute</span></h3>
        <div className="bars" role="img" aria-label={'Umsatz nach Stunde, höchster Wert ' + eur(max) + ' um 19 Uhr'}>
          {D.revenueByHour.map(([h, v]) => <div key={h} className="bar"><span style={{ height: (v / max) * 100 + '%' }} title={`${h} Uhr: ${eur(v)}`} /><small>{h}</small></div>)}
        </div>
        <div className="row"><span className="mut">Bestseller</span><span><b>Paella</b> · 18×</span></div>
      </section>
    )
  }

  const Locked = ({ id }) => {
    const pm = D.portalModules.find((x) => x.id === id)
    const m = MOD.find((x) => x.id === pm.module)
    return (
      <section className="card pitch">
        <span className="ic"><Icon name={m.icon} /></span>
        <div><h3>{m.title} ist nicht in deinem Paket</h3><p className="mut">{m.text}</p></div>
        <button type="button" className="btn pri" onClick={() => { setActive({ ...active, [m.id]: true }); say(`${m.title} aktiviert (Demo). Im echten Portal geht eine Anfrage an abWeb.`) }}>Aktivieren</button>
      </section>
    )
  }

  // ---------- Ansichten ----------
  const views = {
    uebersicht: () => (
      <>
        <div className="kpis">
          <div className="kpi"><span>Umsatz heute</span><b className="num">{eur(kpi.umsatz)}</b><small className="good">+12 % zur Vorwoche</small></div>
          <div className="kpi"><span>Tische belegt</span><b className="num">{kpi.belegt} / {tables.length}</b><small>{kpi.zahlen} wollen zahlen</small></div>
          <div className="kpi"><span>Reservierungen heute</span><b className="num">{D.reservations.length}</b><small>1 per Sprachassistent</small></div>
          <div className="kpi"><span>Offene Bestellungen</span><b className="num">{orders.length}</b><small>{orders.filter((o) => o.state === 'ruf').length} Kellner-Ruf</small></div>
        </div>
        <div className="g3">
          <section className="card"><h3>Tischplan <span className="mut">{D.restaurant.staffOnDuty.join(' · ')} im Dienst</span></h3><TablePlan /></section>
          {active.bestellung ? <OrdersList /> : <Locked id="bestellungen" />}
          {active.reservierung ? <ResList /> : <Locked id="reservierungen" />}
        </div>
        <div className="g2"><Bill /><Revenue /></div>
      </>
    ),
    tische: () => <div className="g2 wide"><section className="card"><h3>Tischplan <span className="mut">Tisch antippen</span></h3><TablePlan big /></section><Bill /></div>,
    bestellungen: () => <OrdersList full />,
    reservierungen: () => <div className="g2"><ResList /><Calls /></div>,
    anrufe: () => <Calls />,
    kasse: () => (
      <section className="card">
        <h3>Kassen-Anbindung</h3>
        <p className="mut">Du behältst deine Kasse mit TSE. Das Portal schickt nur die Rechnung jedes Tisches dorthin. Bezahlung und Beleg laufen in deiner Kasse.</p>
        <div className="row"><span><b>{D.kasse.name}</b></span>{pill('good', 'Verbunden (Beispiel)')}</div>
        <fieldset className="radios">
          <legend>Wie ist deine Kasse verbunden?</legend>
          {D.kasse.options.map((o, i) => <label key={o}><input type="radio" name="kasse" defaultChecked={i === 0} /> {o}</label>)}
        </fieldset>
        <p className="mut small">Welche Kasse du hast, klären wir beim Einrichten. Hat sie keine Schnittstelle, druckt das Portal die Rechnung aus.</p>
      </section>
    ),
    speisekarte: () => (
      <section className="card">
        <h3>Speisekarte <span className="mut">Ausverkauft mit einem Klick</span></h3>
        <div className="tblw"><table className="tbl">
          <thead><tr><th scope="col">Gericht</th><th scope="col">Kategorie</th><th scope="col" className="r">Preis</th><th scope="col" className="r">Heute</th><th scope="col">Verfügbar</th></tr></thead>
          <tbody>{menu.map((m, i) => (
            <tr key={m.name}><td><b>{m.name}</b></td><td>{m.cat}</td><td className="r num">{eur(m.price)}</td><td className="r num">{m.sold}×</td>
              <td><label className="switch"><input type="checkbox" checked={m.available} onChange={() => setMenu(menu.map((x, j) => (j === i ? { ...x, available: !x.available } : x)))} /><span>{m.available ? 'Ja' : 'Ausverkauft'}</span></label></td></tr>
          ))}</tbody>
        </table></div>
      </section>
    ),
    personal: () => (
      <section className="card">
        <h3>Personal heute</h3>
        {D.staff.map((s) => <div className="row" key={s.name}><span><b>{s.name}</b> · {s.role} · seit {s.since}</span><span className="mut">{s.tables.length ? 'Tische ' + s.tables.join(', ') : 'Küche'}</span></div>)}
      </section>
    ),
    module: () => (
      <section className="card">
        <h3>Meine Bausteine</h3>
        <p className="mut">Jeder Baustein funktioniert allein. Schalte hier frei, was du brauchst (Demo).</p>
        <div className="modlist">
          {MOD.map((m) => (
            <div className="row" key={m.id}>
              <span className="modname"><Icon name={m.icon} size={20} /><span><b>{m.title}</b><small className="mut">{m.text}</small></span></span>
              <label className="switch"><input type="checkbox" checked={!!active[m.id]} disabled={m.id === 'portal'} onChange={() => setActive({ ...active, [m.id]: !active[m.id] })} /><span>{active[m.id] ? 'Aktiv' : 'Aus'}</span></label>
            </div>
          ))}
        </div>
      </section>
    ),
  }

  const title = { uebersicht: `Guten Abend, ${D.restaurant.owner}`, module: 'Bausteine' }[view] || D.portalModules.find((x) => x.id === view)?.label
  const mine = D.portalModules.filter((m) => isOn(m.id))
  const more = D.portalModules.filter((m) => !isOn(m.id))

  return (
    <div className="portal">
      <div className="demobar">Demo mit Beispieldaten. Nichts wird gespeichert oder gesendet. <Link to="/">Zurück zur Website</Link></div>
      <div className="shell">
        <aside className={'rail' + (navOpen ? ' open' : '')}>
          <div className="rail-h"><Logo tag="Portal" /><button type="button" className="burger" aria-label={navOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Icon name={navOpen ? 'close' : 'menu'} /></button></div>
          <nav aria-label="Portal">
            <div className="grp">{D.restaurant.name}</div>
            {mine.map((m) => (
              <button type="button" key={m.id} aria-current={view === m.id ? 'page' : undefined} onClick={() => go(m.id)}>
                <Icon name={ICON[m.id]} size={18} /><span>{m.label}</span>
                {m.id === 'bestellungen' && orders.length > 0 && <em>{orders.length}</em>}
                {m.id === 'anrufe' && <em>1</em>}
              </button>
            ))}
            {more.length > 0 && <div className="grp">Mehr für dein Restaurant</div>}
            {more.map((m) => <button type="button" key={m.id} onClick={() => go(m.id)}><Icon name={ICON[m.id]} size={18} /><span>{m.label}</span><span className="lock">Aktivieren</span></button>)}
            <div className="grp">Konto</div>
            <button type="button" aria-current={view === 'module' ? 'page' : undefined} onClick={() => go('module')}><Icon name="grid" size={18} /><span>Bausteine</span></button>
          </nav>
        </aside>
        <main className="pmain" id="main">
          <div className="phead"><h1>{title}</h1><span className="live">● Live · Fr 27.11. · 19:12</span></div>
          {isOn(view) ? views[view]() : <Locked id={view} />}
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
