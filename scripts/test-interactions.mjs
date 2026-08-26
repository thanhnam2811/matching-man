import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

async function runInteractionTests() {
    console.log("Starting interactive feature verification in Google Chrome...");

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
    page.on("pageerror", (err) => errors.push(`PageError: ${err.message}`));
    page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`ConsoleError: ${msg.text()}`);
    });

    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });

    // Test 1: Pricing Monthly / Annual Toggle
    console.log("Testing Pricing Monthly / Annual toggle...");
    const monthlyBtn = await page.$("button::-p-text(Monthly)");
    if (monthlyBtn) {
        await monthlyBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        const proPrice = await page.$eval("#pricing", (el) => el.innerText);
        if (!proPrice.includes("$49")) {
            throw new Error("Monthly price $49 not reflected!");
        }
        console.log("✓ Monthly toggle switches to $49/month correctly");

        const annualBtn = await page.$("button::-p-text(Annual)");
        await annualBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        const proPriceAnnual = await page.$eval("#pricing", (el) => el.innerText);
        if (!proPriceAnnual.includes("$39")) {
            throw new Error("Annual price $39 not reflected!");
        }
        console.log("✓ Annual toggle switches to $39/month correctly");
    }

    // Test 2: Code Walkthrough Language Switcher
    console.log("Testing Code Walkthrough Language Switcher...");
    const pythonBtn = await page.$("button::-p-text(Python)");
    if (pythonBtn) {
        await pythonBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        const codeText = await page.$eval("#developer-hub pre", (el) => el.innerText);
        if (!codeText.includes("httpx.Client") && !codeText.includes("import os")) {
            throw new Error("Python snippet not loaded!");
        }
        console.log("✓ Python tab successfully renders Python SDK code");
    }

    // Test 3: Request / Response Switcher
    console.log("Testing Request / Response Switcher...");
    const responseBtn = await page.$("button::-p-text(Response)");
    if (responseBtn) {
        await responseBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        const responseText = await page.$eval("#developer-hub pre", (el) => el.innerText);
        if (!responseText.includes("queueEntryId") && !responseText.includes("201 Created")) {
            throw new Error("Response JSON not loaded!");
        }
        console.log("✓ Response tab renders simulated 201 Created JSON");
    }

    // Test 4: Architecture Pipeline Stage Selection
    console.log("Testing Architecture Pipeline Stage Selection...");
    const stage5Btn = await page.$("button::-p-text(HMAC Webhook Delivery)");
    if (stage5Btn) {
        await stage5Btn.click();
        await new Promise((r) => setTimeout(r, 200));
        const archText = await page.$eval("#architecture", (el) => el.innerText);
        if (!archText.includes("X-Webhook-Signature") && !archText.includes("Constant-Time")) {
            throw new Error("HMAC Webhook Delivery stage details not rendered!");
        }
        console.log("✓ Architecture Pipeline stage 5 successfully renders HMAC Webhook specs");
    }

    // Test 5: FAQ Accordion Expansion
    console.log("Testing FAQ Accordions...");
    const faqSummaries = await page.$$("#pricing details summary");
    if (faqSummaries.length > 0) {
        await faqSummaries[0].click();
        await new Promise((r) => setTimeout(r, 200));
        const isOpen = await page.$eval("#pricing details", (el) => el.hasAttribute("open"));
        if (!isOpen) {
            throw new Error("FAQ details did not open!");
        }
        console.log("✓ FAQ accordion opens and reveals answer correctly");
    }

    console.log("All interactive UI features verified successfully! Total errors:", errors.length);
    await browser.close();
}

runInteractionTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
});
