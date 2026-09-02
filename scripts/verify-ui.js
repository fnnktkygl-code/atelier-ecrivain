const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT_DIR = "/Users/richard/.gemini/antigravity/brain/5ba809f3-2f27-4a68-b216-153e6eefa5cf/screenshots";
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const viewports = [
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
  ];

  const routes = [
    { path: "/liseuse.html", name: "liseuse", waitSelector: ".liseuse-topbar" },
    { path: "/index.html", name: "home", waitSelector: ".landing-hero, .sanctuary-header" },
    { path: "/atelier.html", name: "atelier", waitSelector: ".atelier-layout" },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport(vp);

    for (const route of routes) {
      const url = "http://localhost:3456" + route.path;
      console.log("[E2E Visual Test] Navigating to " + url + " (" + vp.name + ")...");
      try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
        await page.waitForSelector(route.waitSelector, { timeout: 6000 });
        await new Promise((r) => setTimeout(r, 800));

        const screenshotPath = path.join(OUT_DIR, route.name + "_" + vp.name + ".png");
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log("✓ Captured: " + screenshotPath);
      } catch (err) {
        console.error("✗ Error on " + url + " (" + vp.name + "):", err.message);
      }
    }
    await page.close();
  }

  await browser.close();
  console.log("\n✨ All visual verification screenshots captured in screenshots/");
}

run().catch((err) => {
  console.error("Fatal visual test error:", err);
  process.exit(1);
});
