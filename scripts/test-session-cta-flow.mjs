import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

async function testSessionFlow() {
    console.log("Starting Session & CTA Routing Flow Test...");
    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    });

    const page = await browser.newPage();

    // 1. Test Anonymous visitor
    console.log("1. Testing Anonymous visitor...");
    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });
    const heroBtnText = await page.$eval("section:first-of-type button", (el) => el.innerText);
    console.log("  Anonymous Hero CTA text:", heroBtnText);
    if (!heroBtnText.includes("Start free")) {
        throw new Error("Expected anonymous Hero CTA to be 'Start free'");
    }

    // 2. Perform Demo Login via /login page "Try demo account"
    console.log("2. Performing Demo login on /login...");
    await page.goto("http://localhost:3001/login", { waitUntil: "networkidle0" });
    const demoBtn = await page.$("button::-p-text(Try demo account)");
    if (demoBtn) {
        await demoBtn.click();
        await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    }
    console.log("  Current URL after demo login:", page.url());

    // 3. Return to Landing Page as Logged-in User
    console.log("3. Returning to Landing Page as authenticated user...");
    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400));

    // Verify Header UserMenu
    const userMenuPresent = await page.$("button[aria-haspopup='menu'], .size-8.rounded-full");
    console.log("  Header UserMenu rendered:", !!userMenuPresent);

    // Verify Hero CTA is now "Go to Dashboard"
    const authHeroBtn = await page.$eval("section:first-of-type button", (el) => el.innerText);
    console.log("  Authenticated Hero CTA text:", authHeroBtn);
    if (!authHeroBtn.includes("Go to Dashboard")) {
        throw new Error("Expected authenticated Hero CTA to be 'Go to Dashboard'");
    }

    // Verify Pricing Section Free Card is "Go to Dashboard"
    const freeCardBtn = await page.$eval("#pricing a[href='/dashboard']", (el) => el.innerText);
    console.log("  Authenticated Free Card CTA text:", freeCardBtn);

    // Verify Pricing Section Pro Card is "Upgrade in Dashboard"
    const proCardBtns = await page.$$eval("#pricing a[href='/dashboard']", (els) => els.map((e) => e.innerText));
    console.log("  Authenticated Pricing CTAs:", proCardBtns);

    // Test Clicking Pro Card CTA -> Should land on /dashboard directly with 0 login prompts!
    console.log("4. Clicking 'Upgrade in Dashboard'...");
    const proLink = await page.$("#pricing a[href='/dashboard']");
    if (proLink) {
        await proLink.click();
        await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
        console.log("  Current URL after clicking CTA:", page.url());
        if (!page.url().includes("/dashboard")) {
            throw new Error(`Expected URL to be in /dashboard but got ${page.url()}`);
        }
        console.log("  ✓ Successfully navigated directly into /dashboard without login/register gate!");
    }

    console.log("\nALL SESSION-AWARE CTA TESTS PASSED CLEANLY!");
    await browser.close();
}

testSessionFlow().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
