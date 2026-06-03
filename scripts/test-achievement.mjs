import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SITE = process.env.REPRO_URL || 'http://localhost:5175/';
const stamp = Date.now();
const EMAIL = `quiniela.ach.${stamp}@gmail.com`;
const PASS = 'repro123456';
const USER = `ach${stamp % 100000}`;

const errors = [];
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const h = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll('button, a')];
    return els.find((e) => (e.textContent || '').trim() === t || (e.textContent || '').includes(t));
  }, text);
  const el = h.asElement();
  if (!el) throw new Error('No se encontró: ' + text);
  await el.click();
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 880 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  log('1) Registrando', USER);
  await clickText(page, 'Regístrate');
  await sleep(400);
  await page.type('input[placeholder="Nombre de usuario"]', USER);
  await page.type('input[placeholder="Email"]', EMAIL);
  await page.type('input[placeholder="Contraseña"]', PASS);
  await clickText(page, 'Crear cuenta');
  await sleep(4000);

  log('2) Haciendo un pronóstico (subir un gol y guardar)');
  // Subir un gol en el primer stepper
  const plus = await page.$('button[aria-label="Sumar gol"]');
  if (!plus) throw new Error('No hay botón de stepper (¿partidos no cargaron?)');
  await plus.click();
  await sleep(400);
  await clickText(page, 'Guardar pronóstico');
  log('   guardado, esperando celebración…');
  await sleep(3500);

  const toast = await page.evaluate(() => {
    const t = document.body.textContent || '';
    const has = t.includes('Logro desbloqueado');
    // intentar extraer el nombre del logro mostrado
    return { has, snippet: t.slice(0, 0) || (has ? 'sí' : 'no') };
  });
  log('3) ¿Apareció el cartel "Logro desbloqueado"?:', toast.has ? 'SÍ ✅' : 'NO ❌');

  // ¿El botón ahora dice "Editar pronóstico"?
  const editBtn = await page.evaluate(() => (document.body.textContent || '').includes('Editar pronóstico'));
  log('4) ¿Botón cambió a "Editar pronóstico"?:', editBtn ? 'SÍ ✅' : 'NO ❌');
} catch (e) {
  log('ERROR:', e.message);
} finally {
  log('=== errores consola (' + errors.length + ') ===');
  errors.slice(0, 10).forEach((e) => log('  ' + e));
  await browser.close();
}
