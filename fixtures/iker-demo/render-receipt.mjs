// Renders receipt.html (a fictional transfer receipt marked SAMPLE) to a PNG for the local Iker
// demo. Usage: node fixtures/iker-demo/render-receipt.mjs <output.png> [from] [subtitle] [reference]
// Without the optional arguments it renders Tunde's receipt exactly as receipt.html has it.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "receipt.png");
const [from, subtitle, reference] = process.argv.slice(3);
const html = join(dirname(fileURLToPath(import.meta.url)), "receipt.html");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 1100 } });
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(
    ({ from, subtitle, reference }) => {
      const row = (label) =>
        [...document.querySelectorAll(".row")].find(
          (r) => r.firstElementChild?.textContent === label,
        )?.lastElementChild;
      if (from) row("From").textContent = from;
      if (reference) row("Reference").textContent = reference;
      if (subtitle) document.querySelector(".sub").textContent = subtitle;
    },
    { from, subtitle, reference },
  );
  await page.screenshot({ path: out, fullPage: false });
} finally {
  await browser.close();
}
console.log(`Receipt written to ${out}`);
