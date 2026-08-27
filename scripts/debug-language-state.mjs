import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

async function debugLang() {
    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });

    console.log("Checking language buttons...");
    const langs = ["TypeScript", "Python", "Go", "cURL"];
    for (const lang of langs) {
        await page.evaluate((l) => {
            const btns = Array.from(document.querySelectorAll("#developer-hub button"));
            const target = btns.find((b) => b.textContent.trim() === l);
            if (target) target.click();
        }, lang);
        await new Promise((r) => setTimeout(r, 100));
        const filename = await page.$eval("#developer-hub", (el) => el.innerText);
        console.log(`Clicked ${lang}, preview:`, filename.slice(0, 100).replace(/\n/g, " "));
    }

    // Now test response mode
    console.log("\nSwitching to Response tab...");
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("#developer-hub button"));
        const resp = btns.find((b) => b.textContent.includes("Response"));
        if (resp) resp.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    const visibleLangsInResponse = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("#developer-hub button"));
        return btns.map((b) => b.textContent.trim());
    });
    console.log("Visible buttons in Response mode:", visibleLangsInResponse);

    await browser.close();
}
debugLang();
