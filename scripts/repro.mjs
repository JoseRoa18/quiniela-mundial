import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SITE = process.env.REPRO_URL || 'https://quiniela-mundial-ashen.vercel.app/';
const stamp = Date.now();
const EMAIL = `quiniela.repro.${stamp}@gmail.com`;
const PASS = 'repro123456';
const USER = `repro${stamp % 100000}`;

const errors = [];
const log = (...a) => console.log(...a);

async function clickText(page, text) {
  const h = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll('button, a')];
    return els.find((e) => (e.textContent || '').includes(t));
  }, text);
  const el = h.asElement();
  if (!el) throw new Error('No se encontró elemento con texto: ' + text);
  await el.click();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 880 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

try {
  log('1) Abriendo', SITE);
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);

  log('2) Registrando usuario', USER);
  await clickText(page, 'Regístrate');
  await sleep(500);
  await page.type('input[placeholder="Nombre de usuario"]', USER);
  await page.type('input[placeholder="Email"]', EMAIL);
  await page.type('input[placeholder="Contraseña"]', PASS);
  await clickText(page, 'Crear cuenta');
  await sleep(4000);

  // ¿Logueado? buscar el nav inferior
  const loggedIn = await page.evaluate(() => document.body.textContent.includes('Partidos') && document.body.textContent.includes('Ranking'));
  log('   logueado:', loggedIn);
  if (!loggedIn) { log('   No se logueó (¿confirmación de email activa?). Abortando.'); }

  const countMatches = async () => page.evaluate(() => {
    const t = document.body.textContent || '';
    return {
      hasNoMatches: t.includes('No hay partidos'),
      skeletons: document.querySelectorAll('.animate-pulse').length,
      cards: document.querySelectorAll('article').length,
      bodyLen: t.length,
    };
  });

  log('3) Estado inicial en Partidos:', JSON.stringify(await countMatches()));
  await sleep(1500);
  log('   tras esperar:', JSON.stringify(await countMatches()));

  log('4) Click en Ranking (tabla)');
  await clickText(page, 'Ranking');
  await sleep(2000);
  log('   Ranking:', JSON.stringify(await countMatches()));

  log('5) Segmento "Mis pron."');
  await clickText(page, 'Mis pron.');
  await sleep(2500);
  log('   Mis pron.:', JSON.stringify(await countMatches()));

  log('6) Segmento "Resumen"');
  await clickText(page, 'Resumen');
  await sleep(2500);
  log('   Resumen:', JSON.stringify(await countMatches()));

  log('7) Volviendo a Partidos');
  await clickText(page, 'Partidos');
  await sleep(3000);
  log('   Partidos (vuelta):', JSON.stringify(await countMatches()));

  log('8) Grupos');
  await clickText(page, 'Grupos');
  await sleep(2000);
  log('   Grupos:', JSON.stringify(await countMatches()));

  log('9) Llaves');
  await clickText(page, 'Llaves');
  await sleep(2000);
  log('   Llaves:', JSON.stringify(await countMatches()));

  log('10) Partidos otra vez');
  await clickText(page, 'Partidos');
  await sleep(2500);
  log('   Partidos (final):', JSON.stringify(await countMatches()));
} catch (e) {
  log('ERROR EN SCRIPT:', e.message);
} finally {
  log('\n=== ERRORES CAPTURADOS (' + errors.length + ') ===');
  errors.slice(0, 25).forEach((e) => log('  ' + e));
  await browser.close();
}
