/**
 * Load harness for the enqueue -> match path (Phase 9, Stage 6).
 *
 * Drives POST /v1/queues/enqueue with autocannon, then reads the resulting
 * match/queue-entry counts straight from the API so the report covers the whole
 * path rather than just the HTTP hop. See docs/performance.md for the numbers
 * this produced and how to reproduce them.
 *
 * Usage:
 *   node apps/api/perf/enqueue-load.mjs --url http://localhost:3010 \
 *     --api-key mhub_... --project <id> --game-mode <id> \
 *     [--connections 50] [--duration 30] [--mode casual]
 */

import autocannon from "autocannon";
// Built client, not the TypeScript source under src/generated — the harness runs
// against a compiled API anyway, so `pnpm --dir apps/api build` is a prerequisite.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/src/generated/prisma/client.js";

const args = parseArgs(process.argv.slice(2));

const BASE_URL = args.url ?? "http://localhost:3010";
const API_KEY = required(args["api-key"], "--api-key");
const PROJECT_ID = required(args.project, "--project");
const GAME_MODE_ID = required(args["game-mode"], "--game-mode");
const CONNECTIONS = Number(args.connections ?? 50);
const DURATION = Number(args.duration ?? 30);
const ENVIRONMENT = args.environment ?? "production";
const REGION = args.region ?? "global";
// Rating spread around 1500. Only meaningful for EXTERNAL_RATING modes, where an
// entry with no rating is filtered out of candidate selection and can never be
// matched (see QueuesService.selectCandidateQueueEntries).
const RATING_SPREAD = args["rating-spread"] === undefined ? null : Number(args["rating-spread"]);

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
            out[key] = true;
        } else {
            out[key] = next;
            i += 1;
        }
    }
    return out;
}

function required(value, flag) {
    if (typeof value !== "string" || value.length === 0) {
        console.error(`Missing ${flag}`);
        process.exit(1);
    }
    return value;
}

const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${API_KEY}`,
};

async function api(path) {
    const response = await fetch(`${BASE_URL}${path}`, { headers });
    if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
    return response.json();
}

/**
 * Every enqueue needs a distinct player, otherwise the run measures duplicate
 * handling instead of matchmaking.
 *
 * Two autocannon traps are worth knowing here, because both fail silently — the
 * server still processes the requests, but no response is ever read back and the
 * run reports a flat zero:
 *
 *  - `idReplacement: true` substitutes a variable-length id into an already
 *    serialized body without recomputing content-length.
 *  - Returning a *new* request object from `setupRequest` has the same effect.
 *
 * So: mutate the request in place, and pad the counter to a fixed width so every
 * serialized body has the same byte length as the one content-length was
 * computed from.
 */
let playerCounter = 0;
const runId = Date.now().toString(36);

function buildBody() {
    playerCounter += 1;
    const member = { playerId: `perf-${runId}-${String(playerCounter).padStart(9, "0")}` };

    if (RATING_SPREAD !== null) {
        // Kept in the 1000-9999 range so the serialized rating is always 4 digits
        // and the body length stays constant.
        const offset = Math.floor(Math.random() * (RATING_SPREAD * 2 + 1)) - RATING_SPREAD;
        member.rating = Math.min(9999, Math.max(1000, 1500 + offset));
    }

    return JSON.stringify({
        projectId: PROJECT_ID,
        gameModeId: GAME_MODE_ID,
        environment: ENVIRONMENT,
        region: REGION,
        team: { members: [member] },
    });
}

function setupRequest(request) {
    request.body = buildBody();
    return request;
}

// The public API has no "list matches" route (only GET /matches/:id), so the
// harness counts straight from the database it is pointed at.
const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required(process.env.DATABASE_URL, "DATABASE_URL") }),
});

async function countMatches() {
    return prisma.match.count({ where: { projectId: PROJECT_ID } });
}

const before = await countMatches();
const startedAt = Date.now();

const result = await autocannon({
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION,
    requests: [
        {
            method: "POST",
            path: "/v1/queues/enqueue",
            headers,
            body: buildBody(),
            setupRequest,
        },
    ],
});

const elapsedSeconds = (Date.now() - startedAt) / 1000;

// The sweep runs every 5s and is the safety net behind the fire-and-forget
// attempt at enqueue time, so give it one full tick to drain what is left.
await new Promise((resolve) => setTimeout(resolve, 6000));

const after = await countMatches();
const pools = await api("/v1/queues/pools");
const stillQueued = pools.reduce((sum, pool) => sum + (pool.queuedCount ?? 0), 0);

const enqueued = result["2xx"];
const matchesCreated = after - before;

console.log(
    JSON.stringify(
        {
            config: { connections: CONNECTIONS, duration: DURATION, gameModeId: GAME_MODE_ID },
            http: {
                requestsPerSecond: result.requests.average,
                latencyMeanMs: result.latency.mean,
                latencyP50Ms: result.latency.p50,
                latencyP97_5Ms: result.latency.p97_5,
                latencyP99Ms: result.latency.p99,
                latencyMaxMs: result.latency.max,
                non2xx: result.non2xx,
                errors: result.errors,
                timeouts: result.timeouts,
            },
            path: {
                enqueued,
                matchesCreated,
                matchesPerSecond: Number((matchesCreated / elapsedSeconds).toFixed(1)),
                playersMatched: matchesCreated * 2,
                stillQueuedAfterOneSweep: stillQueued,
            },
        },
        null,
        2,
    ),
);

await prisma.$disconnect();
