import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SITE = process.env.REPRO_URL || 'http://localhost:5175/';
const OUT = 'C:\\Users\\josei\\OneDrive\\Documentos\\Quiniela\\quiniela-deportiva\\shot.png';
const stamp = Date.now();
const EMAIL = `quiniela.shot.${stamp}@gmail.com`;
const PASS = 'repro123456';
const USER = `shot${stamp % 100000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').includes(t)), text);
  const el = h.asElement();
  if (!el) throw new Error('No: ' + text);
  await el.click();
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 440, height: 1100, deviceScaleFactor: 2 });
try {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  await clickText(page, 'Regístrate');
  await sleep(400);
  await page.type('input[placeholder="Nombre de usuario"]', USER);
  await page.type('input[placeholder="Email"]', EMAIL);
  await page.type('input[placeholder="Contraseña"]', PASS);
  await clickText(page, 'Crear cuenta');
  await sleep(4000);
  // pronosticar el primer partido
  const plus = await page.$('button[aria-label="Sumar gol"]');
  await plus.click();
  await sleep(300);
  await clickText(page, 'Guardar pronóstico');
  await sleep(5000); // dejar pasar el confeti/toast
  await page.screenshot({ path: OUT });
  console.log('captura guardada en', OUT);
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await browser.close();
}
