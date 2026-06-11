import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\josei\\OneDrive\\Documentos\\Quiniela\\quiniela-deportiva\\live-preview.png';
const SITE = 'http://localhost:5175/';
const stamp = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickText(page, text) {
  const h = await page.evaluateHandle((t) => [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').includes(t)), text);
  await h.asElement().click();
}
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 440, height: 700, deviceScaleFactor: 2 });
await p.goto(SITE, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1000);
await clickText(p, 'Regístrate');
await sleep(400);
await p.type('input[placeholder="Nombre de usuario"]', 'liveshot' + (stamp % 10000));
await p.type('input[placeholder="Email"]', `live.${stamp}@gmail.com`);
await p.type('input[placeholder="Contraseña"]', 'test123456');
await clickText(p, 'Crear cuenta');
await sleep(4500);
await p.screenshot({ path: OUT });
await b.close();
console.log('ok');
