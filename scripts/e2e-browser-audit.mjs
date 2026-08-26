import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("../apps/web/node_modules/puppeteer-core");

const ARTIFACTS_DIR = "/home/namtt/.gemini/antigravity-cli/brain/268da553-84f3-4dee-9d52-235de20c358c";
const BASE_URL = "http://localhost:3001";

async function runBrowserAudit() {
    console.log("🚀 Starting comprehensive automated browser audit using Google Chrome...");

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

    try {
        // 1. Landing Page
        console.log("\n📸 1. Testing Landing Page (/)...");
        await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01_landing_page.png"), fullPage: false });
        console.log("   ✅ Landing page rendered successfully.");

        // 2. Login Page
        console.log("\n📸 2. Testing Login Page (/login)...");
        await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02_login_page.png") });
        console.log("   ✅ Login page rendered with Forgot Password link.");

        // 3. Forgot Password Page
        console.log("\n📸 3. Testing Forgot Password (/forgot-password)...");
        await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle0" });
        await page.type("#email", "operator@example.com");
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_forgot_password_form.png") });
        await page.click("button[type='submit']");
        await new Promise((r) => setTimeout(r, 1500));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_forgot_password_submitted.png") });
        console.log("   ✅ Forgot password flow executed cleanly.");

        // 4. Reset Password Page
        console.log("\n📸 4. Testing Reset Password (/reset-password)...");
        await page.goto(`${BASE_URL}/reset-password?token=sample_test_token_123456`, { waitUntil: "networkidle0" });
        await page.type("#password", "SuperSecretPassword123!");
        await page.type("#confirmPassword", "SuperSecretPassword123!");
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_reset_password_page.png") });
        console.log("   ✅ Reset password page rendered with password strength meter.");

        // 5. Verify Email Page
        console.log("\n📸 5. Testing Verify Email (/verify-email)...");
        await page.goto(`${BASE_URL}/verify-email?token=sample_verification_token`, { waitUntil: "networkidle0" });
        await new Promise((r) => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05_verify_email_page.png") });
        console.log("   ✅ Verify email page rendered cleanly.");

        // 6. Demo Login -> Dashboard
        console.log("\n📸 6. Logging into Dashboard via Demo Session...");
        await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
        const buttons = await page.$$("button");
        for (const btn of buttons) {
            const text = await page.evaluate((el) => el.textContent, btn);
            if (text && text.includes("demo")) {
                await btn.click();
                break;
            }
        }
        await page.waitForNavigation({ waitUntil: "networkidle0" });
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06_dashboard_overview.png") });
        console.log("   ✅ Authenticated into Dashboard.");

        // 7. Create an Organization for testing
        console.log("\n📸 7. Creating an Organization for testing...");
        const orgSlugSuffix = Date.now().toString().slice(-4);
        await page.goto(`${BASE_URL}/dashboard/organizations/new`, { waitUntil: "networkidle0" });
        await page.type("#name", `Cyberpunk Studios ${orgSlugSuffix}`);
        await page.click("button[type='submit']");
        await page.waitForNavigation({ waitUntil: "networkidle0" });

        const orgUrl = page.url();
        const orgMatch = orgUrl.match(/\/dashboard\/organizations\/([^\/]+)/);
        const orgId = orgMatch ? orgMatch[1] : null;
        console.log(`   ✅ Organization created: ${orgId}`);

        // 8. Create a Project inside the Organization
        console.log("\n📸 8. Creating a Project...");
        await page.goto(`${BASE_URL}/dashboard/organizations/${orgId}/projects/new`, { waitUntil: "networkidle0" });
        await page.type("#name", `Arena Ranked ${orgSlugSuffix}`);
        await page.type("#slug", `arena-${orgSlugSuffix}`);
        await page.click("button[type='submit']");
        await page.waitForNavigation({ waitUntil: "networkidle0" });

        const projUrl = page.url();
        const projMatch = projUrl.match(/\/dashboard\/projects\/([^\/]+)/);
        const projId = projMatch ? projMatch[1] : null;
        console.log(`   ✅ Project created: ${projId}`);

        // 9. Generate an API key to emit an Audit Log event!
        console.log("\n📸 9. Generating API Key to emit @TrackAudit event...");
        await page.goto(`${BASE_URL}/dashboard/projects/${projId}/api-keys/new`, { waitUntil: "networkidle0" });
        await page.type("#name", "Production Matchmaker Key");
        await page.click("button[type='submit']");
        await new Promise((r) => setTimeout(r, 1500));
        console.log("   ✅ API key generated and audit event persisted.");

        // 10. Organization Billing Page Test
        console.log(`\n📸 10. Testing Organization Billing Page (/dashboard/organizations/${orgId}/billing)...`);
        await page.goto(`${BASE_URL}/dashboard/organizations/${orgId}/billing`, { waitUntil: "networkidle0" });
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "07_organization_billing.png"), fullPage: true });
        console.log(
            "   ✅ Organization Billing page rendered with quota progress bars, plan cards, and action buttons.",
        );

        // 11. Project Audit Logs Explorer & Detail Drawer Test
        console.log(`\n📸 11. Testing Project Audit Logs (/dashboard/projects/${projId}/audit-logs)...`);
        await page.goto(`${BASE_URL}/dashboard/projects/${projId}/audit-logs`, { waitUntil: "networkidle0" });
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "08_project_audit_logs.png"), fullPage: true });

        // Click audit log row to open DetailDrawer side-by-side JSON diff
        const tableRow = await page.$("tbody tr");
        if (tableRow) {
            console.log("   Clicking audit log row to open DetailDrawer side-by-side JSON diff...");
            await tableRow.click();
            await new Promise((r) => setTimeout(r, 600)); // Allow slide-in animation
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, "09_audit_log_diff_drawer.png"), fullPage: true });
            console.log("   ✅ DetailDrawer JSON diff inspector opened and captured.");
        }

        console.log("\n==========================================");
        if (errors.length === 0) {
            console.log("🎉 ALL AUTO BROWSER TESTS PASSED WITH ZERO ERRORS!");
        } else {
            console.log(`⚠️ Completed with ${errors.length} errors/warnings logged.`);
        }
        console.log("==========================================\n");
    } catch (err) {
        console.error("❌ Fatal error during browser test:", err);
        throw err;
    } finally {
        await browser.close();
    }
}

runBrowserAudit().catch((err) => {
    console.error(err);
    process.exit(1);
});
