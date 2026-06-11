import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIR = 'C:\\Users\\josei\\OneDrive\\Documentos\\Quiniela\\quiniela-deportiva\\';
const SITE = process.env.REPRO_URL || 'https://quiniela-mundial-ashen.vercel.app/';
const stamp = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function click(page, text) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === t || (e.textContent || '').includes(t)), text);
  const el = h.asElement();
  if (el) await el.click();
  return !!el;
}
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const shot = async (name) => { await p.screenshot({ path: DIR + name }); console.log('shot', name); };
try {
  await p.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);
  await shot('a-login.png');
  await click(p, 'Regístrate'); await sleep(400);
  await p.type('input[placeholder="Nombre de usuario"]', 'audit' + (stamp % 10000));
  await p.type('input[placeholder="Email"]', `audit.${stamp}@gmail.com`);
  await p.type('input[placeholder="Contraseña"]', 'test123456');
  await click(p, 'Crear cuenta'); await sleep(4500);
  await shot('b-partidos.png');
  await click(p, 'Grupos'); await sleep(1500); await shot('c-grupos.png');
  await click(p, 'Llaves'); await sleep(1500); await shot('d-llaves.png');
  await click(p, 'Ranking'); await sleep(1500); await shot('e-ranking.png');
  await click(p, 'Mis pron.'); await sleep(1500); await shot('f-mispron.png');
  await click(p, 'Resumen'); await sleep(1500); await shot('g-resumen.png');
  await click(p, 'Partidos'); await sleep(1000);
  // abrir Reglas
  const help = await p.$('button[aria-label="Cómo funciona"]');
  if (help) { await help.click(); await sleep(800); await shot('h-reglas.png'); }
} catch (e) {
  console.log('ERR', e.message);
} finally {
  await b.close();
}
