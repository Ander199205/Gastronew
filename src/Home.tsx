import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="home">
      <div className="home-card">
        <div className="ab-logo"><span>ab</span></div>
        <h1>abWeb Gastro</h1>
        <p>Digitale Speisekarte und Bestellung am Tisch für Restaurants. Eine Plattform von abWeb solutions.</p>
        <div className="home-links">
          <Link className="btn" to="/app">Service-App öffnen</Link>
          <Link className="btn ghost" to="/r/casalucia">Beispielkarte ansehen</Link>
        </div>
        <small>Gäste öffnen die Karte über den QR-Code auf ihrem Tisch.</small>
      </div>
    </main>
  );
}
