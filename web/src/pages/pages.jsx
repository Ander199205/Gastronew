import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { company, contact, form as formCfg, hero, modules, problems, reservation } from '../content/site.js'
import { Faq, FinalCta, ModuleGrid, Pricing, ReservationDemo } from '../components/sections.jsx'
import { Btn, Checks, Heading, Icon } from '../components/ui.jsx'

const img = (p) => import.meta.env.BASE_URL + p

export function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-tx">
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1>{hero.title} <span className="hl">{hero.highlight}</span></h1>
          <p className="lead">{hero.lead}</p>
          <div className="ctas">
            <Btn to={hero.primary.to} arrow>{hero.primary.label}</Btn>
            <Btn to={hero.secondary.to} variant="sec">{hero.secondary.label}</Btn>
          </div>
          <Checks items={hero.trust} />
        </div>
        <div className="hero-vis">
          <img src={img(hero.image.src)} alt={hero.image.alt} width="1200" height="823" fetchpriority="high" />
          {hero.cards.map((c, i) => (
            <div key={c.title} className={'float f' + i} aria-hidden="true"><b>{c.title}</b><span>{c.text}</span><em>{c.value}</em></div>
          ))}
        </div>
      </section>

      <section className="blk">
        <div className="panel">
          <Heading eyebrow={problems.eyebrow} title={problems.title} highlight={problems.highlight} />
          <div className="probs">
            {problems.items.map((p) => (
              <div className="prob" key={p.title}><span className="ic"><Icon name={p.icon} /></span><h3>{p.title}</h3><p>{p.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <ModuleGrid />

      <section className="blk">
        <div className="panel split">
          <div>
            <Heading eyebrow={reservation.eyebrow} title={reservation.title} highlight={reservation.highlight} lead={reservation.lead} />
            <Btn to="/reservierung" variant="sec" arrow>So funktioniert die Reservierung</Btn>
          </div>
          <ReservationDemo note={reservation.demoNote} />
        </div>
      </section>

      <section className="blk">
        <div className="panel split rev">
          <div className="shot">
            <img src={img('img/risotto.webp')} alt="Risotto mit Pilzen auf einem Teller, Beispielgericht aus der Speisekarte" width="1200" height="801" loading="lazy" />
          </div>
          <div>
            <Heading eyebrow="Chef-Portal" title="Alles auf einem Bildschirm." highlight="Deine Kasse bleibt." lead="Tischplan live, Bestellungen, Reservierungen, Anrufe des Sprachassistenten, Umsatz und Team. Die Rechnung jedes Tisches geht mit einem Klick an deine Kasse. Bezahlung und Beleg laufen dort wie gewohnt." />
            <Btn to="/portal" arrow>Chef-Portal ausprobieren</Btn>
          </div>
        </div>
      </section>

      <Pricing />
      <Faq />
      <FinalCta />
    </>
  )
}

export function Funktionen() {
  return (
    <>
      <section className="pagehero">
        <Heading as="h1" eyebrow="Funktionen" title="Alles, was dein Restaurant" highlight="digital braucht." lead="Sechs Bausteine in einem System. Jeder funktioniert allein, zusammen sparen sie dir die meiste Zeit." />
      </section>
      <ModuleGrid detailed />
      <FinalCta />
    </>
  )
}

export function Reservierung() {
  return (
    <>
      <section className="pagehero split">
        <Heading as="h1" eyebrow={reservation.eyebrow} title={reservation.title} highlight={reservation.highlight} lead={reservation.lead} />
        <ReservationDemo note={reservation.demoNote} />
      </section>
      <section className="blk">
        <div className="panel">
          <Heading eyebrow="So läuft es ab" title="Vom Anruf bis zum Tisch" highlight="in vier Schritten." />
          <ol className="steps">
            {reservation.steps.map((s, i) => <li key={s.title}><i>{i + 1}</i><b>{s.title}</b><span>{s.text}</span></li>)}
          </ol>
        </div>
      </section>
      <Faq items={reservation.faq} title="Fragen zur Reservierung" id="fragen-reservierung" />
      <FinalCta />
    </>
  )
}

export function Preise() {
  return (
    <>
      <section className="pagehero">
        <Heading as="h1" eyebrow="Preise" title="Was abWeb Gastro" highlight="im Monat kostet." lead="Keine Einrichtungsgebühr, keine Provision auf Bestellungen. Im ersten Jahr 30 % günstiger." />
      </section>
      <Pricing />
      <section className="blk">
        <div className="panel">
          <Heading eyebrow="Bausteine" title="Was in welchem Paket steckt" />
          <div className="tblw">
            <table className="tbl">
              <thead><tr><th scope="col">Baustein</th><th scope="col">Basic</th><th scope="col">Pro</th></tr></thead>
              <tbody>
                {modules.map((m) => {
                  const inBasic = ['karte', 'bestellung', 'team'].includes(m.id)
                  return <tr key={m.id}><td><b>{m.title}</b></td><td>{inBasic ? 'Inklusive' : '—'}</td><td>Inklusive</td></tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <Faq />
    </>
  )
}

export function Kontakt() {
  const [params] = useSearchParams()
  const [state, setState] = useState({ status: 'idle', name: '' })
  const [errors, setErrors] = useState({})

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const data = Object.fromEntries(f.entries())
    if (data.website) return // Spam-Falle
    const err = {}
    if (!data.name?.trim()) err.name = 'Bitte gib deinen Namen an.'
    if (!data.restaurant?.trim()) err.restaurant = 'Bitte gib den Namen deines Restaurants an.'
    if (!/^\S+@\S+\.\S+$/.test(data.email || '')) err.email = 'Bitte gib eine gültige E-Mail-Adresse an.'
    if (!data.consent) err.consent = 'Bitte stimme der Datenschutzerklärung zu.'
    setErrors(err)
    if (Object.keys(err).length) return
    if (!formCfg.endpoint) { setState({ status: 'noendpoint', name: data.name }); return }
    setState({ status: 'sending', name: data.name })
    try {
      const res = await fetch(formCfg.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, quelle: 'gastro.abwebsolutions.cloud', zeit: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(res.status)
      setState({ status: 'ok', name: data.name })
    } catch {
      setState({ status: 'error', name: data.name })
    }
  }

  const alt = (
    <p className="alt">
      Telefon: <a href={'tel:' + company.phoneHref}>{company.phone}</a> · E-Mail: <a href={'mailto:' + company.email}>{company.email}</a> · <a href={company.whatsapp} rel="noopener">WhatsApp</a>
    </p>
  )

  return (
    <section className="pagehero split">
      <div>
        <Heading as="h1" eyebrow={contact.eyebrow} title={contact.title} highlight={contact.highlight} lead={contact.lead} />
        <div className="contactcards">
          <a href={'tel:' + company.phoneHref}><Icon name="phone" /><span><b>{company.phone}</b><small>Anrufen oder WhatsApp</small></span></a>
          <a href={'mailto:' + company.email}><Icon name="mail" /><span><b>{company.email}</b><small>Antwort innerhalb von 24 Stunden</small></span></a>
        </div>
      </div>
      <div className="formcard">
        {state.status === 'ok' ? (
          <div className="resdone" role="status"><span className="ic ok"><Icon name="check" /></span><b>{contact.success.replace('{name}', state.name)}</b></div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field"><label htmlFor="name">Dein Name *</label><input id="name" name="name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'e-name' : undefined} />{errors.name && <small id="e-name" className="err">{errors.name}</small>}</div>
            <div className="field"><label htmlFor="restaurant">Restaurant *</label><input id="restaurant" name="restaurant" autoComplete="organization" aria-invalid={!!errors.restaurant} />{errors.restaurant && <small className="err">{errors.restaurant}</small>}</div>
            <div className="row2">
              <div className="field"><label htmlFor="email">E-Mail *</label><input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />{errors.email && <small className="err">{errors.email}</small>}</div>
              <div className="field"><label htmlFor="phone">Telefon</label><input id="phone" name="phone" type="tel" autoComplete="tel" /></div>
            </div>
            <div className="field"><label htmlFor="paket">Interesse an</label>
              <select id="paket" name="paket" defaultValue={params.get('paket') || 'pilot'}>
                <option value="pilot">Pilotmonat (150 €)</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="reservierung">Nur Reservierung 24/7</option>
              </select>
            </div>
            <div className="field"><label htmlFor="message">Nachricht</label><textarea id="message" name="message" rows="4" placeholder="Zum Beispiel: 60 Plätze, wir haben eine Kasse von …" /></div>
            <input className="hp" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
            <label className="consent"><input type="checkbox" name="consent" aria-invalid={!!errors.consent} /> <span>Ich stimme zu, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden. Mehr in der <a href={company.datenschutz}>Datenschutzerklärung</a>. *</span></label>
            {errors.consent && <small className="err">{errors.consent}</small>}
            <button className="btn pri wide" type="submit" disabled={state.status === 'sending'}>{state.status === 'sending' ? 'Wird gesendet …' : 'Anfrage senden'}</button>
            {state.status === 'error' && <div className="formerr" role="alert">{contact.error}{alt}</div>}
            {state.status === 'noendpoint' && <div className="formerr" role="alert">{contact.noEndpoint}{alt}</div>}
            <p className="mut small">* Pflichtfelder</p>
          </form>
        )}
      </div>
    </section>
  )
}

export function NotFound() {
  return (
    <section className="pagehero">
      <Heading as="h1" title="Diese Seite gibt es nicht." lead="Vielleicht findest du hier, was du suchst." />
      <div className="ctas"><Btn to="/">Zur Startseite</Btn><Link className="btn sec" to="/kontakt">Kontakt</Link></div>
    </section>
  )
}
