/**
 * Comprehensive Benchmark Suite for Matching-Man (Before Redis/BullMQ Baseline).
 * Measures:
 * 1. HTTP Endpoint Raw Baseline (GET /health)
 * 2. Single Pool Casual (10, 50, 100 connections, 30s)
 * 3. Single Pool Skill (10, 50, 100 connections, 30s, rating spread ±200)
 * 4. Multi-Pool Concurrent (Casual 25 conn + Skill 25 conn concurrently, 30s)
 */

import autocannon from "autocannon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/src/generated/prisma/client.js";

const BASE_URL = process.env.URL || "http://localhost:3000";
const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://admin:password@localhost:5432/matching_hub?schema=public";
const DURATION = Number(process.env.DURATION || 30);

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

async function getDemoConfig() {
    const res = await fetch(`${BASE_URL}/v1/demo/config`);
    if (!res.ok) throw new Error(`GET /v1/demo/config returned ${res.status}`);
    return res.json();
}

async function cleanDb(projectId) {
    // Delete transactional rows for clean measurements
    await prisma.ratingHistory.deleteMany({ where: { ratingProfile: { projectId } } });
    await prisma.matchResult.deleteMany({ where: { match: { projectId } } });
    await prisma.matchSlot.deleteMany({ where: { match: { projectId } } });
    await prisma.match.deleteMany({ where: { projectId } });
    await prisma.queueEntry.deleteMany({ where: { projectId } });
    await prisma.teamMember.deleteMany({ where: { team: { projectId } } });
    await prisma.team.deleteMany({ where: { projectId } });
    await prisma.ratingProfile.deleteMany({ where: { projectId } });
    await prisma.webhookDelivery.deleteMany({ where: { webhookEndpoint: { projectId } } });
    await prisma.webhookEndpoint.deleteMany({ where: { projectId } });
}

function createBodyBuilder(projectId, gameModeId, ratingSpread = null) {
    let playerCounter = 0;
    const runId = Math.random().toString(36).slice(2, 8);

    return function buildBody() {
        playerCounter += 1;
        const member = { playerId: `perf-${runId}-${String(playerCounter).padStart(9, "0")}` };

        if (ratingSpread !== null) {
            const offset = Math.floor(Math.random() * (ratingSpread * 2 + 1)) - ratingSpread;
            member.rating = Math.min(9999, Math.max(1000, 1500 + offset));
        }

        return JSON.stringify({
            projectId,
            gameModeId,
            environment: "production",
            region: "global",
            team: { members: [member] },
        });
    };
}

async function runAutocannonSingle({
    name,
    connections,
    duration,
    gameModeId,
    apiKey,
    projectId,
    ratingSpread = null,
}) {
    console.log(`\n==================================================`);
    console.log(`Starting Test: [${name}] (${connections} connections, ${duration}s)`);
    console.log(`==================================================`);

    await cleanDb(projectId);
    const beforeMatches = await prisma.match.count({ where: { projectId } });
    const startedAt = Date.now();

    const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
    };

    const buildBody = createBodyBuilder(projectId, gameModeId, ratingSpread);

    const result = await autocannon({
        url: BASE_URL,
        connections,
        duration,
        requests: [
            {
                method: "POST",
                path: "/v1/queues/enqueue",
                headers,
                body: buildBody(),
                setupRequest: (req) => {
                    req.body = buildBody();
                    return req;
                },
            },
        ],
    });

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    console.log(`Autocannon completed in ${elapsedSeconds.toFixed(1)}s. Waiting 6s for match sweep drain...`);
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const afterMatches = await prisma.match.count({ where: { projectId } });
    const poolsRes = await fetch(`${BASE_URL}/v1/queues/pools`, { headers });
    const pools = await poolsRes.json();
    const stillQueued = Array.isArray(pools) ? pools.reduce((sum, p) => sum + (p.queuedCount ?? 0), 0) : 0;

    const matchesCreated = afterMatches - beforeMatches;
    const enqueued = result["2xx"];

    const report = {
        name,
        connections,
        duration,
        requestsPerSec: Number(result.requests.average.toFixed(1)),
        latencyMeanMs: Number(result.latency.mean.toFixed(1)),
        latencyP50Ms: result.latency.p50,
        latencyP97_5Ms: result.latency.p97_5,
        latencyP99Ms: result.latency.p99,
        latencyMaxMs: result.latency.max,
        enqueued,
        matchesCreated,
        matchesPerSec: Number((matchesCreated / elapsedSeconds).toFixed(1)),
        matchEfficiencyPercent: enqueued > 0 ? Number((((matchesCreated * 2) / enqueued) * 100).toFixed(1)) : 0,
        stillQueued,
        errors: result.errors,
        timeouts: result.timeouts,
        non2xx: result.non2xx,
    };

    console.log(`Result:`, JSON.stringify(report, null, 2));
    return report;
}

async function runHttpBaseline() {
    console.log(`\n==================================================`);
    console.log(`Starting Test: [HTTP Baseline: GET /health] (50 connections, 10s)`);
    console.log(`==================================================`);

    const result = await autocannon({
        url: `${BASE_URL}/health`,
        connections: 50,
        duration: 10,
    });

    const report = {
        name: "GET /health (HTTP Baseline)",
        connections: 50,
        duration: 10,
        requestsPerSec: Number(result.requests.average.toFixed(1)),
        latencyMeanMs: Number(result.latency.mean.toFixed(1)),
        latencyP50Ms: result.latency.p50,
        latencyP99Ms: result.latency.p99,
        latencyMaxMs: result.latency.max,
        errors: result.errors,
        timeouts: result.timeouts,
        non2xx: result.non2xx,
    };

    console.log(`Result:`, JSON.stringify(report, null, 2));
    return report;
}

async function runMultiPoolConcurrent({
    apiKey,
    projectId,
    casualModeId,
    skillModeId,
    connectionsPerPool = 25,
    duration,
}) {
    console.log(`\n==================================================`);
    console.log(
        `Starting Test: [Multi-Pool Concurrent: Casual + Skill] (${connectionsPerPool} conn each, total ${connectionsPerPool * 2} conn, ${duration}s)`,
    );
    console.log(`==================================================`);

    await cleanDb(projectId);
    const beforeMatches = await prisma.match.count({ where: { projectId } });
    const startedAt = Date.now();

    const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
    };

    const buildCasualBody = createBodyBuilder(projectId, casualModeId, null);
    const buildSkillBody = createBodyBuilder(projectId, skillModeId, 200);

    const [casualResult, skillResult] = await Promise.all([
        autocannon({
            url: BASE_URL,
            connections: connectionsPerPool,
            duration,
            requests: [
                {
                    method: "POST",
                    path: "/v1/queues/enqueue",
                    headers,
                    body: buildCasualBody(),
                    setupRequest: (req) => {
                        req.body = buildCasualBody();
                        return req;
                    },
                },
            ],
        }),
        autocannon({
            url: BASE_URL,
            connections: connectionsPerPool,
            duration,
            requests: [
                {
                    method: "POST",
                    path: "/v1/queues/enqueue",
                    headers,
                    body: buildSkillBody(),
                    setupRequest: (req) => {
                        req.body = buildSkillBody();
                        return req;
                    },
                },
            ],
        }),
    ]);

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    console.log(
        `Multi-pool autocannon completed in ${elapsedSeconds.toFixed(1)}s. Waiting 6s for match sweep drain...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const afterMatches = await prisma.match.count({ where: { projectId } });
    const poolsRes = await fetch(`${BASE_URL}/v1/queues/pools`, { headers });
    const pools = await poolsRes.json();
    const stillQueued = Array.isArray(pools) ? pools.reduce((sum, p) => sum + (p.queuedCount ?? 0), 0) : 0;

    const matchesCreated = afterMatches - beforeMatches;
    const totalEnqueued = casualResult["2xx"] + skillResult["2xx"];
    const aggregateReqPerSec = Number((casualResult.requests.average + skillResult.requests.average).toFixed(1));

    const report = {
        name: `Multi-Pool Concurrent (2 Pools: Casual + Skill)`,
        connectionsTotal: connectionsPerPool * 2,
        duration,
        aggregateReqPerSec,
        casualReqPerSec: Number(casualResult.requests.average.toFixed(1)),
        skillReqPerSec: Number(skillResult.requests.average.toFixed(1)),
        casualMeanLatencyMs: Number(casualResult.latency.mean.toFixed(1)),
        skillMeanLatencyMs: Number(skillResult.latency.mean.toFixed(1)),
        casualP99Ms: casualResult.latency.p99,
        skillP99Ms: skillResult.latency.p99,
        enqueued: totalEnqueued,
        matchesCreated,
        matchesPerSec: Number((matchesCreated / elapsedSeconds).toFixed(1)),
        stillQueued,
        totalErrors: casualResult.errors + skillResult.errors,
        totalTimeouts: casualResult.timeouts + skillResult.timeouts,
    };

    console.log(`Result:`, JSON.stringify(report, null, 2));
    return report;
}

async function main() {
    console.log(`Fetching demo configuration from ${BASE_URL}...`);
    const config = await getDemoConfig();
    console.log(`Demo Config loaded:`, config);

    const { projectId, apiKey, gameModes } = config;
    const { casual: casualModeId, skill: skillModeId } = gameModes;

    const allReports = [];

    // 1. HTTP Baseline
    const httpBaseline = await runHttpBaseline();
    allReports.push(httpBaseline);

    // 2. Single Pool Casual (10, 50, 100)
    for (const connections of [10, 50, 100]) {
        const report = await runAutocannonSingle({
            name: `Single Pool Casual (c=${connections})`,
            connections,
            duration: DURATION,
            gameModeId: casualModeId,
            apiKey,
            projectId,
            ratingSpread: null,
        });
        allReports.push(report);
    }

    // 3. Single Pool Skill (10, 50, 100)
    for (const connections of [10, 50, 100]) {
        const report = await runAutocannonSingle({
            name: `Single Pool Skill ±200 (c=${connections})`,
            connections,
            duration: DURATION,
            gameModeId: skillModeId,
            apiKey,
            projectId,
            ratingSpread: 200,
        });
        allReports.push(report);
    }

    // 4. Multi-Pool Concurrent (25 + 25 = 50 conn)
    const multiPoolReport = await runMultiPoolConcurrent({
        apiKey,
        projectId,
        casualModeId,
        skillModeId,
        connectionsPerPool: 25,
        duration: DURATION,
    });
    allReports.push(multiPoolReport);

    console.log(`\n\n==================================================`);
    console.log(`FINAL PERFORMANCE BENCHMARK SUMMARY (BASELINE)`);
    console.log(`==================================================`);
    console.log(JSON.stringify(allReports, null, 2));

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Benchmark failed:", err);
    prisma.$disconnect();
    process.exit(1);
});
