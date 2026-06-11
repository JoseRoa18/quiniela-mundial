import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SITE = process.env.REPRO_URL || 'http://localhost:5175/';
const stamp = Date.now();
const EMAIL = `quiniela.reload.${stamp}@gmail.com`;
const PASS = 'repro123456';
const USER = `reload${stamp % 100000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(page, text) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').includes(t)), text);
  const el = h.asElement();
  if (!el) throw new Error('No: ' + text);
  await el.click();
}
const hasText = (page, t) => page.evaluate((x) => (document.body.textContent || '').includes(x), t);

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 420, height: 880 });
try {
  await p.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1000);
  await clickText(p, 'Regístrate');
  await sleep(400);
  await p.type('input[placeholder="Nombre de usuario"]', USER);
  await p.type('input[placeholder="Email"]', EMAIL);
  await p.type('input[placeholder="Contraseña"]', PASS);
  await clickText(p, 'Crear cuenta');
  await sleep(4000);

  // Pronosticar el primer partido: 1 gol local
  const plus = await p.$('button[aria-label="Sumar gol"]');
  await plus.click();
  await sleep(300);
  await clickText(p, 'Guardar pronóstico');
  await sleep(3000);
  console.log('Tras guardar -> ¿"Editar pronóstico"?:', (await hasText(p, 'Editar pronóstico')) ? 'SÍ' : 'NO');

  // RECARGAR
  console.log('Recargando...');
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(4500);

  const editAfter = await hasText(p, 'Editar pronóstico');
  const pronosticadoAfter = await hasText(p, 'Pronosticado');
  console.log('Tras RECARGAR -> ¿"Editar pronóstico"?:', editAfter ? 'SÍ ✅' : 'NO ❌');
  console.log('Tras RECARGAR -> ¿"Pronosticado"?:', pronosticadoAfter ? 'SÍ ✅' : 'NO ❌');
  console.log(editAfter ? '\n>>> FIX OK: el pronóstico persiste tras recargar' : '\n>>> BUG SIGUE: no persiste');
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await b.close();
}
