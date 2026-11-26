// Prueba del panel del restaurante (Verwaltung) con Supabase simulado
const { chromium } = require('playwright');
const { install, db } = require('./mock.cjs');
require('fs').mkdirSync(__dirname + '/shots', { recursive: true });
const B = 'http://localhost:4173';
const shot = (p, n) => p.screenshot({ path: `${__dirname}/shots/${n}.png` });
(async () => {
  const browser = await browser_();
  async function browser_() { return chromium.launch(); }
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await install(ctx);
  const s = await ctx.newPage();
  s.on('pageerror', e => errors.push(e.message));
  s.on('dialog', d => d.accept());
  await s.goto(`${B}/app`);
  await s.fill('input[type=email]', 'lucia@test'); await s.fill('input[type=password]', 'x');
  await s.click('button.s-btn.primary');
  await s.click('a[href="/app/verwaltung"]');
  await s.locator('.m-cat').first().waitFor();
  await shot(s, '20-menu-editor');
  // editar precio y alérgeno de Bruschetta
  await s.locator('.m-row-main', { hasText: 'Bruschetta' }).click();
  await s.locator('.m-modal input[inputmode=decimal]').fill('8,40');
  await s.locator('.m-allerg label', { hasText: 'Sesam' }).click();
  await s.locator('.m-langs button', { hasText: 'EN' }).first().click();
  await shot(s, '21-item-modal');
  await s.locator('.m-modal .s-btn.primary').click();
  await s.waitForTimeout(400);
  const bru = db.menu_items.find(i => i.name.de === 'Bruschetta');
  console.log('bruschetta', bru.price_cents, bru.allergens.join(','));
  // nuevo plato
  await s.locator('.m-cat').first().locator('button.add').click();
  await s.locator('.m-modal .m-field input').first().fill('Patatas Bravas');
  await s.locator('.m-modal input[inputmode=decimal]').fill('6,5');
  await s.locator('.m-modal .s-btn.primary').click();
  await s.waitForTimeout(400);
  console.log('new item', JSON.stringify(db.menu_items.find(i => i.name.de === 'Patatas Bravas')));
  // diseño
  await s.click('a[href="/app/verwaltung/design"]');
  await s.locator('.m-presets button', { hasText: 'Modern dunkel' }).click();
  await shot(s, '22-design');
  await s.locator('.m-foot .s-btn.primary').click();
  await s.waitForTimeout(400);
  console.log('theme', db.restaurants[0].theme.primary, db.restaurants[0].theme.mode);
  // mesas
  await s.click('a[href="/app/verwaltung/tische"]');
  await s.locator('.m-bar .s-btn.primary').click();
  await s.waitForTimeout(400);
  await shot(s, '23-tables');
  console.log('tables', db.tables.length);
  // tipps
  await s.click('a[href="/app/verwaltung/tipps"]');
  await s.waitForTimeout(300);
  await shot(s, '24-tipps');
  // carta del cliente con el nuevo tema
  const g = await ctx.newPage();
  await g.setViewportSize({ width: 390, height: 844 });
  await g.goto(`${B}/r/casalucia`);
  await g.locator('.g-item').first().waitFor();
  await shot(g, '25-guest-dark');
  console.log('ERRORS', errors);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
