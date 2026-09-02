
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT_DIR = "/Users/richard/.gemini/antigravity/brain/5ba809f3-2f27-4a68-b216-153e6eefa5cf/screenshots";
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  const tests = [
    { name: "landing", url: "http://localhost:3555/", selector: ".landing-hero" },
    { name: "dashboard", url: "http://localhost:3555/?mock=true", selector: ".sanctuary-header" },
    { name: "atelier", url: "http://localhost:3555/atelier?mock=true", selector: ".atelier-layout" },
    { name: "liseuse", url: "http://localhost:3555/liseuse?mock=true", selector: ".liseuse-wrap" },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport(vp);

    for (const t of tests) {
      console.log("[Visual Test] " + t.name + " (" + vp.name + ")...");
      await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector(t.selector, { timeout: 8000 });
      await new Promise(r => setTimeout(r, 600));

      const file = path.join(OUT_DIR, t.name + "_" + vp.name + ".png");
      await page.screenshot({ path: file });
      console.log("  ✓ OK: " + file);
    }
    await page.close();
  }

  await browser.close();
  console.log("\n🎉 All 8 end-to-end visual tests passed!");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
