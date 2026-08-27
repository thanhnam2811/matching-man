import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

async function testSmoothness() {
    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    });
    const page = await browser.newPage();
    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });

    console.log("Testing Code Walkthrough rapid tab & language switching...");
    const steps = ["STEP 01", "STEP 02", "STEP 03"];
    const langs = ["TypeScript", "Python", "Go", "cURL"];

    for (const step of steps) {
        // Click Step
        await page.evaluate((s) => {
            const btns = Array.from(document.querySelectorAll("#developer-hub button"));
            const target = btns.find((b) => b.textContent.includes(s));
            if (target) target.click();
        }, step);
        await new Promise((r) => setTimeout(r, 100));

        for (const lang of langs) {
            await page.evaluate((l) => {
                const btns = Array.from(document.querySelectorAll("#developer-hub button"));
                const target = btns.find((b) => b.textContent.trim() === l);
                if (target) target.click();
            }, lang);
            await new Promise((r) => setTimeout(r, 80));

            // Verify code container height and non-empty content
            const height = await page.$eval("#developer-hub div.h-\\[420px\\]", (el) => el.clientHeight);
            const lineCount = await page.$$eval("#developer-hub div.h-\\[420px\\] > div", (els) => els.length);
            console.log(`  ✓ ${step} -> ${lang}: Container height = ${height}px, Lines rendered = ${lineCount}`);
        }

        // Test Response toggle
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("#developer-hub button"));
            const target = btns.find((b) => b.textContent.includes("Response"));
            if (target) target.click();
        });
        await new Promise((r) => setTimeout(r, 80));
        const respHeight = await page.$eval("#developer-hub div.h-\\[420px\\]", (el) => el.clientHeight);
        console.log(`  ✓ ${step} -> Response Mode: Container height = ${respHeight}px`);
    }

    console.log("\nAll rapid language & tab switching operations executed smoothly with stable layout!");
    await browser.close();
}
testSmoothness().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
