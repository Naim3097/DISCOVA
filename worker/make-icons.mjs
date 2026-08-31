// One-off: renders the DISCOVA app icons (dark plate + the D mark) from the
// full logo PNG using the Playwright already in this package. Outputs to web/public.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const logo = readFileSync(new URL("../web/public/discova-logo.png", import.meta.url)).toString("base64");
// Logo is 2172x724; the D mark sits in roughly the left 6%..25% band.
// Scale so the D fills ~62% of the square, centred.
const page_html = (size) => `<!doctype html><meta charset="utf-8">
<style>
  * { margin:0; padding:0 }
  body { width:${size}px; height:${size}px; background:#161A0E; overflow:hidden;
         display:grid; place-items:center }
  .win { width:${Math.round(size * 0.66)}px; height:${Math.round(size * 0.66)}px;
         overflow:hidden; position:relative }
  img  { position:absolute; height:${Math.round(size * 0.66 * (724 / 340))}px;
         top:50%; left:50%;
         transform:translate(-${Math.round(size * 0.66 * (724 / 340) * 3 * 0.168)}px, -50%) }
</style>
<body><div class="win"><img src="data:image/png;base64,${logo}"></div></body>`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
for (const size of [512, 192, 180]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(page_html(size));
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(`../web/public/icon-${size}.png`, import.meta.url), buf);
  console.log(`icon-${size}.png ${buf.length} bytes`);
}
await browser.close();
