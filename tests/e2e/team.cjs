// Prueba: equipo (alta, contraseña, bloqueo), panel admin de abWeb, primer acceso y chat traducido
const { chromium } = require('playwright');
const { install, db, calls } = require('./mock.cjs');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const B = 'http://localhost:4173';
const shot = (p, n) => p.screenshot({ path: `${__dirname}/shots/${n}.png` });
const check = (c, m) => { if (!c) { console.error('FALLO:', m); process.exitCode = 1; } else console.log('ok:', m); };
async function login(ctx, email, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(email + ': ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(`${B}/app`);
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'x');
  await p.click('button.s-btn.primary');
  return p;
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  db.staff.push({ id: 's10', restaurant_id: 'r1', user_id: 'u10', display_name: 'Neu', role: 'kitchen', active: true });

  // 1) Lucía (dueña): Team
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await install(ctx);
  let s = await login(ctx, 'lucia@test', errors);
  await s.click('a[href="/app/verwaltung"]');
  await s.click('a[href="/app/verwaltung/team"]');
  await s.locator('.m-addstaff').waitFor();
  await s.fill('.m-addstaff input[maxlength="40"]', 'Pablo');
  await s.fill('.m-addstaff input[type=email]', 'pablo@test');
  await s.selectOption('.m-addstaff select', 'kitchen');
  await s.click('.m-addstaff .s-btn.primary');
  await s.locator('.m-cred').waitFor();
  await shot(s, '30-team-credentials');
  check((await s.locator('.m-cred').innerText()).includes('abcd-efgh-jkmn'), 'zugangsdaten mit passwort');
  check(db.staff.some(x => x.display_name === 'Pablo' && x.role === 'kitchen' && x.email === 'pablo@test'), 'pablo angelegt');
  await s.click('.m-modal .s-btn.primary');
  await s.locator('.m-row', { hasText: 'Pablo' }).getByRole('button', { name: 'Sperren' }).click();
  await s.waitForTimeout(400);
  check(db.staff.find(x => x.display_name === 'Pablo').active === false, 'pablo gesperrt');
  await s.locator('.m-row', { hasText: 'Carmen' }).getByRole('button', { name: 'Passwort' }).click();
  await s.locator('.m-cred').waitFor();
  check(calls.some(c => c.action === 'reset_password' && c.staff_id === 's1'), 'passwort carmen zurückgesetzt');
  await s.click('.m-modal .s-btn.primary');
  await shot(s, '31-team');
  check(!(await s.locator('a[href="/app/admin"]').count()), 'dueña sin pestaña admin');
  await ctx.close();

  // 2) abWeb admin
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await install(ctx);
  s = await login(ctx, 'admin@test', errors);
  await s.click('a[href="/app/admin"]');
  await s.locator('.a-card').first().waitFor();
  await s.click('text=Neues Restaurant');
  await s.locator('.m-modal input').first().fill('Bar Sol Heilbronn');
  check(await s.locator('.m-modal input').nth(1).inputValue() === 'bar-sol-heilbronn', 'slug automático');
  await s.locator('.m-modal input[type=number]').fill('5');
  await s.locator('.m-modal .m-grid3').nth(1).locator('input').first().fill('Sol');
  await s.locator('.m-modal input[type=email]').fill('sol@test');
  await shot(s, '32-admin-new');
  await s.click('.m-modal .s-btn.primary');
  await s.locator('.m-cred').waitFor();
  check(db.restaurants.length === 2 && db.tables.filter(t => t.restaurant_id && t.restaurant_id !== 'r1').length === 5, 'restaurante + 5 mesas');
  await s.click('.m-modal .s-btn.primary');
  await s.waitForTimeout(400);
  await shot(s, '33-admin');
  check(await s.locator('.a-card').count() === 2, 'dos restaurantes en la lista');
  await ctx.close();

  // 3) primer acceso: cambiar contraseña
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await install(ctx);
  s = await login(ctx, 'neu@test', errors);
  await s.getByText('Willkommen!').waitFor();
  await shot(s, '34-first-login');
  await s.fill('input[autocomplete=new-password] >> nth=0', 'geheim123');
  await s.fill('input[autocomplete=new-password] >> nth=1', 'geheim123');
  await s.click('button.s-btn.primary');
  await s.locator('.s-tabs').waitFor({ timeout: 5000 });
  check(await s.locator('a[href="/app/kueche"]').count() === 1, 'tras cambiar contraseña entra a la app');
  await ctx.close();

  // 4) chat traducido
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' }); await install(gctx);
  const g = await gctx.newPage();
  g.on('pageerror', e => errors.push('guest: ' + e.message));
  await g.goto(`${B}/r/casalucia/mesa/3?k=key3`);
  await g.locator('.g-checkin .g-check input').check();
  await g.locator('.g-checkin .g-btn').click();
  await g.locator('.g-nav').waitFor();
  await g.locator('.g-nav button').nth(1).click();
  await g.fill('.g-compose input', '¿Tenéis algo sin gluten?');
  await g.locator('.g-compose form button').click();
  await g.waitForTimeout(500);
  const gm = db.messages.find(m => m.body === '¿Tenéis algo sin gluten?');
  gm.translation = { de: 'Habt ihr etwas Glutenfreies?' };
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); await install(ctx);
  s = await login(ctx, 'carmen@test', errors);
  await s.locator('.s-table').first().waitFor({ timeout: 8000 }).catch(async () => { await shot(s, '99-debug'); console.log(await s.locator('body').innerText()); });
  await s.locator('.s-table', { hasText: '3' }).first().click();
  await s.getByText('Habt ihr etwas Glutenfreies?').waitFor();
  check(await s.getByText('Original: ¿Tenéis algo sin gluten?').count() === 1, 'personal ve traducción y original');
  await s.fill('.s-compose input', 'Ja, die Paella ist glutenfrei.');
  await s.click('.s-compose .s-btn.primary');
  await s.waitForTimeout(400);
  db.messages.find(m => m.body === 'Ja, die Paella ist glutenfrei.').translation = { es: 'Sí, la paella no lleva gluten.' };
  await shot(s, '35-chat-staff');
  await g.waitForTimeout(4500);
  await g.getByText('Sí, la paella no lleva gluten.').waitFor({ timeout: 5000 });
  check(true, 'cliente ve la respuesta en español');
  await shot(g, '36-chat-guest');

  check(!errors.length, 'sin errores de página ' + errors.join(' | '));
  await browser.close();
})();
