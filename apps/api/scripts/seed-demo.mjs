// Idempotently seeds a public demo project used by the web app's /demo page.
// Run with the API server up:  node apps/api/scripts/seed-demo.mjs
// Prints the DEMO_* env block to paste into apps/web/.env

const API = process.env.API_BASE_URL ?? "http://localhost:3000/v1";
const DEMO_USER = { email: "demo@matchinghub.dev", password: "demo-password-123", name: "Demo" };

async function req(method, path, { token, body } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const err = new Error(`${method} ${path} -> ${res.status} ${text}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function registerOrLogin() {
    try {
        const out = await req("POST", "/auth/register", { body: DEMO_USER });
        return out.token;
    } catch (error) {
        if (error.status !== 409) throw error;
        const out = await req("POST", "/auth/login", {
            body: { email: DEMO_USER.email, password: DEMO_USER.password },
        });
        return out.token;
    }
}

async function findOrCreateOrg(token) {
    const orgs = await req("GET", "/organizations", { token });
    const existing = orgs.find((o) => o.name === "Demo");
    if (existing) return existing.id;
    const created = await req("POST", "/organizations", { token, body: { name: "Demo" } });
    return created.id;
}

async function findOrCreateProject(token, organizationId) {
    const projects = await req("GET", "/projects", { token });
    const existing = projects.find((p) => p.slug === "demo-arena");
    if (existing) return existing.id;
    const created = await req("POST", "/projects", {
        token,
        body: { name: "Demo Arena", slug: "demo-arena", organizationId },
    });
    return created.id;
}

async function findOrCreateGameMode(token, projectId, spec) {
    const modes = await req("GET", `/projects/${projectId}/game-modes`, { token });
    const existing = modes.find((m) => m.key === spec.key);
    if (existing) return existing.id;
    const created = await req("POST", `/projects/${projectId}/game-modes`, { token, body: spec });
    return created.id;
}

async function main() {
    const token = await registerOrLogin();
    const organizationId = await findOrCreateOrg(token);
    const projectId = await findOrCreateProject(token, organizationId);

    const skillModeId = await findOrCreateGameMode(token, projectId, {
        key: "skill-1v1",
        name: "Skill 1v1",
        matchStructure: "VERSUS",
        requiredSlots: 2,
        groupCount: 2,
        teamSizeMin: 1,
        teamSizeMax: 1,
        ratingMode: "EXTERNAL_RATING",
        initialRatingWindow: 50,
        windowExpandIntervalSeconds: 3,
        windowExpandStep: 100,
    });

    const casualModeId = await findOrCreateGameMode(token, projectId, {
        key: "casual-1v1",
        name: "Casual 1v1",
        matchStructure: "VERSUS",
        requiredSlots: 2,
        groupCount: 2,
        teamSizeMin: 1,
        teamSizeMax: 1,
        ratingMode: "DISABLED",
    });

    // API keys cannot be read back, so always mint a fresh one for the demo.
    const apiKey = await req("POST", `/projects/${projectId}/api-keys`, { token, body: { name: "demo-key" } });

    process.stdout.write(
        [
            "",
            "# --- paste into apps/web/.env ---",
            `DEMO_PROJECT_ID=${projectId}`,
            `DEMO_API_KEY=${apiKey.key}`,
            `DEMO_ENVIRONMENT=production`,
            `DEMO_GAME_MODE_SKILL=${skillModeId}`,
            `DEMO_GAME_MODE_CASUAL=${casualModeId}`,
            "# --------------------------------",
            "",
        ].join("\n"),
    );
}

main().catch((error) => {
    process.stderr.write(`seed-demo failed: ${error.message}\n`);
    process.exit(1);
});
