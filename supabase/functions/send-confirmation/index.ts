// abWeb Gastro · send-confirmation
// Doble opt-in: cuando un cliente deja su e-mail, la base de datos (pg_net) llama aquí y se le envía
// un enlace. Hasta que lo pulse no se le reconoce ni el personal ve su ficha.
// Secretos: RESEND_API_KEY, MAIL_FROM ("Casa Lucía via abWeb <no-reply@abwebsolutions.cloud>"),
//           PUBLIC_APP_URL (p. ej. https://gastro.abwebsolutions.cloud).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const T: Record<string, { s: string; h: string; b: string; btn: string; f: string }> = {
  de: { s: 'Bitte bestätigen Sie Ihre E-Mail für {r}', h: 'Fast geschafft{n}!', b: 'Sie möchten, dass {r} Sie beim nächsten Besuch erkennt. Bitte bestätigen Sie dafür Ihre E-Mail-Adresse.', btn: 'E-Mail bestätigen', f: 'Wenn Sie das nicht waren, ignorieren Sie diese E-Mail einfach. Ohne Bestätigung löschen wir die Adresse nach 48 Stunden.' },
  en: { s: 'Please confirm your email for {r}', h: 'Almost done{n}!', b: 'You asked {r} to remember you on your next visit. Please confirm your email address.', btn: 'Confirm email', f: 'If this wasn’t you, just ignore this email. Without confirmation we delete the address after 48 hours.' },
  es: { s: 'Confirma tu e-mail para {r}', h: '¡Ya casi está{n}!', b: 'Has pedido que {r} te recuerde en tu próxima visita. Confirma tu dirección de e-mail.', btn: 'Confirmar e-mail', f: 'Si no has sido tú, ignora este correo. Sin confirmación borramos la dirección en 48 horas.' },
  it: { s: 'Conferma la tua e-mail per {r}', h: 'Quasi fatto{n}!', b: 'Hai chiesto a {r} di ricordarsi di te alla prossima visita. Conferma il tuo indirizzo e-mail.', btn: 'Conferma e-mail', f: 'Se non sei stato tu, ignora questa e-mail. Senza conferma cancelliamo l’indirizzo dopo 48 ore.' },
  fr: { s: 'Confirmez votre e-mail pour {r}', h: 'Presque terminé{n} !', b: 'Vous avez demandé à {r} de se souvenir de vous lors de votre prochaine visite. Merci de confirmer votre adresse e-mail.', btn: 'Confirmer l’e-mail', f: 'Si ce n’était pas vous, ignorez cet e-mail. Sans confirmation, nous supprimons l’adresse après 48 heures.' },
  tr: { s: '{r} için e-postanızı onaylayın', h: 'Neredeyse bitti{n}!', b: '{r} sizi bir sonraki ziyaretinizde hatırlasın istediniz. Lütfen e-posta adresinizi onaylayın.', btn: 'E-postayı onayla', f: 'Bu siz değilseniz bu e-postayı dikkate almayın. Onay olmazsa adresi 48 saat sonra sileriz.' },
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  const { data: allowed } = await db.rpc('_translate_hook_ok', { p_secret: req.headers.get('x-hook-secret') || '' });
  if (allowed !== true) return new Response('forbidden', { status: 403 });
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  const base = (Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/$/, '');
  if (!key || !from || !base) { console.warn('send-confirmation: faltan RESEND_API_KEY, MAIL_FROM o PUBLIC_APP_URL'); return new Response('not_configured'); }

  const { profile_id } = await req.json();
  const { data: p } = await db.from('guest_profiles').select('email,name,language,confirm_token,confirmed_at,restaurant_id').eq('id', profile_id).maybeSingle();
  if (!p || p.confirmed_at) return new Response('skip');
  const { data: r } = await db.from('restaurants').select('name,slug,theme').eq('id', p.restaurant_id).single();
  const t = T[p.language as string] || T.de;
  const name = p.name ? `, ${esc(p.name)}` : '';
  const rn = esc(r!.name);
  const link = `${base}/r/${r!.slug}/bestaetigen?t=${p.confirm_token}`;
  const color = /^#[0-9a-f]{6}$/i.test(r?.theme?.primary || '') ? r!.theme.primary : '#B4532A';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
<h2 style="margin:0 0 12px">${t.h.replace('{n}', name)}</h2>
<p>${t.b.replace('{r}', rn)}</p>
<p style="margin:24px 0"><a href="${link}" style="background:${color};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${t.btn}</a></p>
<p style="color:#777;font-size:13px">${t.f}</p><p style="color:#777;font-size:12px">${rn} · abWeb Gastro</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [p.email], subject: t.s.replace('{r}', r!.name), html }),
  });
  if (!res.ok) { console.error('resend', res.status, await res.text()); return new Response('send_failed', { status: 200 }); }
  return new Response('ok');
});
