import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

const ARTIFACT_DIR = "/home/namtt/.gemini/antigravity-cli/brain/268da553-84f3-4dee-9d52-235de20c358c";

async function main() {
    console.log("Launching headless Chrome for Landing Page visual inspection...");
    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1440,900",
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on("pageerror", (err) => {
        console.error("❌ Page Runtime Error:", err.message);
        errors.push(`PageError: ${err.message}`);
    });
    page.on("console", (msg) => {
        if (msg.type() === "error") {
            console.error("❌ Console Error:", msg.text());
            errors.push(`ConsoleError: ${msg.text()}`);
        }
    });

    console.log("Navigating to http://localhost:3001 ...");
    await page.goto("http://localhost:3001", { waitUntil: "networkidle0", timeout: 15000 });

    // Wait a brief moment for scroll reveal
    await new Promise((r) => setTimeout(r, 800));

    // 1. Hero & Stats Full Screen
    console.log("Capturing Hero screenshot...");
    await page.screenshot({
        path: path.join(ARTIFACT_DIR, "01_landing_hero.png"),
    });

    // 2. Scroll to Architecture Pipeline
    console.log("Capturing Architecture Pipeline...");
    const archSection = await page.$("#architecture");
    if (archSection) {
        await archSection.evaluate((el) => el.scrollIntoView());
        await new Promise((r) => setTimeout(r, 600));
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "02_architecture_pipeline.png"),
        });
    }

    // 3. Scroll to Developer Hub / Code Walkthrough
    console.log("Capturing Developer Hub / Code Walkthrough...");
    const devHub = await page.$("#developer-hub");
    if (devHub) {
        await devHub.evaluate((el) => el.scrollIntoView());
        await new Promise((r) => setTimeout(r, 600));
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "03_developer_hub_walkthrough.png"),
        });
    }

    // 4. Scroll to Bento Grid & Enterprise Trust
    console.log("Capturing Features Bento & Enterprise Trust...");
    const features = await page.$("#features");
    if (features) {
        await features.evaluate((el) => el.scrollIntoView());
        await new Promise((r) => setTimeout(r, 600));
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "04_features_bento.png"),
        });
    }

    // 5. Scroll to Pricing Section & Comparison Matrix
    console.log("Capturing Pricing & Comparison Matrix...");
    const pricing = await page.$("#pricing");
    if (pricing) {
        await pricing.evaluate((el) => el.scrollIntoView());
        await new Promise((r) => setTimeout(r, 600));
        await page.screenshot({
            path: path.join(ARTIFACT_DIR, "05_pricing_matrix.png"),
        });
    }

    // 6. Full Page Screenshot
    console.log("Capturing Full Landing Page...");
    await page.screenshot({
        path: path.join(ARTIFACT_DIR, "00_landing_full_page.png"),
        fullPage: true,
    });

    console.log("Visual audit complete! Errors logged:", errors.length);
    await browser.close();
}

main().catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
});
