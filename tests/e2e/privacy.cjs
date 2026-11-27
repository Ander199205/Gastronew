// Prueba: aceptar condiciones, pagar en caja, dejar e-mail (habitual), borrado al pagar, reconocimiento y olvido
const { chromium } = require('playwright');
const { install, db } = require('./mock.cjs');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const B = 'http://localhost:4173';
const shot = (p, n) => p.screenshot({ path: `${__dirname}/shots/${n}.png` });
const check = (c, m) => { if (!c) { console.error('FALLO:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' }); await install(gctx);
  const g = await gctx.newPage();
  g.on('pageerror', e => errors.push('guest: ' + e.message));
  await g.goto(`${B}/r/casalucia/mesa/5?k=key5`);
  await g.locator('.g-checkin').waitFor();
  check(await g.locator('.g-checkin .g-btn').isDisabled(), 'check-in bloqueado sin aceptar');
  await g.locator('.g-checkin .g-link').click();
  await g.getByText('Condiciones y privacidad').first().waitFor();
  await shot(g, '40-terms');
  await g.locator('.g-sheet .g-btn').click();
  await g.fill('input[autocomplete=given-name]', 'Marta');
  await g.locator('.g-checkin .g-check input').check();
  await shot(g, '41-accept');
  await g.locator('.g-checkin .g-btn').click();
  await g.locator('.g-nav').waitFor();
  check(!!db.visits.find(v => v.guest_name === 'Marta'), 'visita abierta tras aceptar');
  await g.locator('.g-add').first().click();
  await g.locator('.g-cartbar').click();
  await g.locator('.g-sheet .g-btn').click();
  await g.waitForTimeout(500);
  await g.locator('.g-nav button').nth(2).click();
  await g.getByRole('button', { name: 'En caja' }).click();
  await g.getByRole('button', { name: 'Pedir la cuenta' }).click();
  await g.getByText('Pasa por caja, por favor.').waitFor();
  check(db.visits.find(v => v.guest_name === 'Marta').pay_at === 'counter', 'cuenta en caja');
  await g.fill('.g-stay input[type=email]', 'marta@gmail.com');
  await g.locator('.g-stay .g-check input').check();
  await shot(g, '42-stay');
  await g.locator('.g-stay .g-btn').click();
  await g.waitForTimeout(600);
  check(db.guest_profiles.some(p => p.email === 'marta@gmail.com'), 'perfil de habitual guardado');
  const pk = await g.evaluate(() => localStorage.getItem('abg:pk:casalucia'));
  check(!!pk, 'llave del habitual en el móvil');

  // personal: ve "zur Kasse", cierra → se borra nombre y chat
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await install(sctx);
  const s = await sctx.newPage();
  s.on('pageerror', e => errors.push('staff: ' + e.message)); s.on('dialog', d => d.accept());
  await s.goto(`${B}/app`); await s.fill('input[type=email]', 'carmen@test'); await s.fill('input[type=password]', 'x'); await s.click('button.s-btn.primary');
  await s.getByText('Kommt zur Kasse').waitFor();
  await s.locator('.s-table', { hasText: 'Kommt zur Kasse' }).click();
  await s.locator('.s-paybox').waitFor();
  check(!(await s.locator('.s-regular').count()), 'sin confirmar el e-mail el personal no ve ficha');
  await shot(s, '43-staff-counter');
  check((await s.locator('.s-paybox').innerText()).includes('Kasse'), 'personal sabe que paga en caja');
  await s.getByText('Bezahlt · Tisch freigeben').click();
  await s.waitForTimeout(500);
  const visit = db.visits.find(v => v.table_id === 't5');
  check(visit.guest_name === null && !db.messages.some(m => m.visit_id === visit.id && m.sender !== 'system'), 'al pagar se borran nombre y chat');

  // confirma el enlace del correo (doble opt-in)
  const c = await gctx.newPage();
  await c.goto(`${B}/r/casalucia/bestaetigen?t=11111111-2222-3333-4444-555555555555`);
  await c.getByText('Casa Lucía te reconocerá').waitFor({ timeout: 5000 });
  await shot(c, '44-confirmed');
  check(!!db.guest_profiles[0].confirmed_at, 'e-mail confirmado');
  await c.close();

  // vuelve otro día: le reconocen
  await g.waitForTimeout(4500);
  await g.getByRole('button', { name: /Nueva visita|nueva visita/i }).click().catch(() => {});
  await g.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('abg:casalucia:')) localStorage.removeItem(k); });
  await g.goto(`${B}/r/casalucia/mesa/6?k=key6`);
  await g.locator('.g-checkin .g-check input').check();
  await g.fill('input[autocomplete=given-name]', '');
  await g.locator('.g-checkin .g-btn').click();
  await g.getByText('¡Qué alegría verte otra vez, Marta!').waitFor({ timeout: 5000 });
  check(true, 'saludo de habitual');
  check(db.guest_profiles[0].visits === 2, 'cuenta la segunda visita');
  await s.reload(); await s.locator('.s-table').first().waitFor();
  await s.locator('.s-table', { hasText: 'Marta' }).click();
  await s.locator('.s-regular').waitFor();
  await shot(s, '45-staff-regular');
  check((await s.locator('.s-regular').innerText()).includes('Paella'), 'personal ve ficha y favoritos del habitual');
  // borrarse
  await g.locator('.g-nav button').nth(0).click();
  await g.locator('.g-legal .g-link').click();
  await g.getByRole('button', { name: 'Borrar mis datos guardados' }).click();
  await g.waitForTimeout(500);
  check(!db.guest_profiles.length, 'el cliente se puede borrar');
  check(!errors.length, 'sin errores de página ' + errors.join(' | '));
  await browser.close();
})();
