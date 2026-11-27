import { useState } from 'react'
import { faq as faqItems, finalCta, modules, modulesIntro, pricing, site } from '../content/site.js'
import { Btn, Checks, eur, Heading, Icon } from './ui.jsx'

export function ModuleGrid({ detailed }) {
  return (
    <section className="blk" id="module">
      <div className="panel">
        <Heading {...modulesIntro} />
        <div className={'modgrid' + (detailed ? ' detailed' : '')}>
          {modules.map((m) => (
            <article className="mod" key={m.id} id={'modul-' + m.id}>
              <div className="mod-top"><span className="ic"><Icon name={m.icon} /></span><span className="tag">{m.tag}</span></div>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
              {detailed && <Checks items={m.points} />}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Pricing() {
  const d = pricing.firstYearDiscount
  return (
    <section className="blk" id="preise">
      <div className="panel">
        <Heading eyebrow={pricing.eyebrow} title={pricing.title} highlight={pricing.highlight} lead={pricing.lead} />
        <div className="pkgrid">
          {pricing.plans.map((p) => (
            <article key={p.id} className={'pk' + (p.recommended ? ' rec' : '')}>
              {p.recommended && <span className="badge">Empfohlen</span>}
              <h3>{p.name}</h3>
              <p className="for">{p.for}</p>
              <div className="price"><b>{eur(p.price * (1 - d)).replace(',00', '')}</b><s>{eur(p.price).replace(',00', '')}</s></div>
              <p className="mon">pro Monat im 1. Jahr, danach {eur(p.price).replace(',00', '')}</p>
              <Checks items={p.features} />
              <Btn to={'/kontakt?paket=' + p.id} variant={p.recommended ? 'pri' : 'sec'} arrow>{p.cta}</Btn>
            </article>
          ))}
          <article className="pk pilot">
            <span className="badge alt">Zum Testen</span>
            <h3>{pricing.pilot.title}</h3>
            <p className="for">Ein Monat mit allem aus Pro.</p>
            <div className="price"><b>{eur(pricing.pilot.price).replace(',00', '')}</b><span>einmalig</span></div>
            <p className="mon">Geld zurück, wenn es dir nicht gefällt</p>
            <p className="pilot-txt">{pricing.pilot.text}</p>
            <Btn to="/kontakt?paket=pilot" variant="sec" arrow>{pricing.pilot.cta}</Btn>
          </article>
        </div>
        <p className="pknote mut">{pricing.note}</p>
      </div>
    </section>
  )
}

export function Faq({ items = faqItems, title = 'Häufige Fragen', id = 'fragen' }) {
  return (
    <section className="blk" id={id}>
      <div className="panel">
        <Heading eyebrow="Fragen" title={title} />
        <div className="faq">
          {items.map((f) => (
            <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="blk">
      <div className="final">
        <h2>{finalCta.title}</h2>
        <p>{finalCta.text}</p>
        <Btn to={site.cta.to} variant="white" arrow>{site.cta.label}</Btn>
      </div>
    </section>
  )
}

// Reservierungs-Widget (Beispiel, speichert nichts)
export function ReservationDemo({ note }) {
  const days = ['Fr 27.11.', 'Sa 28.11.', 'So 29.11.', 'Di 1.12.']
  const slots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']
  const full = { 'Sa 28.11.': ['19:30', '20:00'] }
  const [day, setDay] = useState(days[1])
  const [pax, setPax] = useState(2)
  const [slot, setSlot] = useState('')
  const [done, setDone] = useState(false)
  return (
    <div className="resdemo">
      <div className="resdemo-h"><b>Casa Lucía</b><span className="mut">Tisch reservieren</span></div>
      {done ? (
        <div className="resdone" role="status">
          <span className="ic ok"><Icon name="check" /></span>
          <b>Reserviert: {day}, {slot} Uhr, {pax} Personen</b>
          <p className="mut">So sieht die Bestätigung für deine Gäste aus. Im echten System bekommen sie eine E-Mail, und du siehst die Reservierung im Chef-Portal.</p>
          <button type="button" className="btn sec" onClick={() => { setDone(false); setSlot('') }}>Noch einmal ausprobieren</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (slot) setDone(true) }}>
          <fieldset>
            <legend>Tag</legend>
            <div className="chips">{days.map((d) => <button type="button" key={d} aria-pressed={d === day} onClick={() => { setDay(d); setSlot('') }}>{d}</button>)}</div>
          </fieldset>
          <fieldset>
            <legend>Personen</legend>
            <div className="chips">{[1, 2, 3, 4, 5, 6].map((n) => <button type="button" key={n} aria-pressed={n === pax} onClick={() => setPax(n)}>{n}</button>)}</div>
          </fieldset>
          <fieldset>
            <legend>Uhrzeit</legend>
            <div className="chips">{slots.map((s) => {
              const isFull = (full[day] || []).includes(s)
              return <button type="button" key={s} disabled={isFull} aria-pressed={s === slot} onClick={() => setSlot(s)} title={isFull ? 'Ausgebucht' : undefined}>{s}</button>
            })}</div>
          </fieldset>
          <button className="btn pri wide" type="submit" disabled={!slot}>{slot ? `Für ${slot} Uhr reservieren` : 'Uhrzeit wählen'}</button>
          <p className="mut small">{note}</p>
        </form>
      )}
    </div>
  )
}
