import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\Users\\josei\\OneDrive\\Documentos\\Quiniela\\quiniela-deportiva\\icon-preview.png';
const svg = readFileSync('public/icon.svg', 'utf8');
const cell = (size, radius) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden">${svg}</div>`;
const html = `<body style="margin:0;background:#202632;display:flex;gap:28px;align-items:center;justify-content:center;height:320px">
${cell(200, 46)}${cell(96, 22)}${cell(48, 11)}
</body>
<style>svg{width:100%;height:100%;display:block}</style>`;
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 440, height: 320, deviceScaleFactor: 2 });
await p.setContent(html, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 300));
await p.screenshot({ path: OUT });
await b.close();
console.log('ok');
