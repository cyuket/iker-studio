// Renders receipt.html (a fictional transfer receipt marked SAMPLE) to a PNG for the local Iker
// demo. Usage: node fixtures/iker-demo/render-receipt.mjs <output.png>
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "receipt.png");
const html = join(dirname(fileURLToPath(import.meta.url)), "receipt.html");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 1100 } });
  await page.goto(pathToFileURL(html).href);
  await page.screenshot({ path: out, fullPage: false });
} finally {
  await browser.close();
}
console.log(`Receipt written to ${out}`);
