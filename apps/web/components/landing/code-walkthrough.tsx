"use client";

import * as React from "react";
import { Check, Copy, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Language = "typescript" | "python" | "go" | "curl";
export type StepId = "enqueue" | "ready-check" | "webhook";
export type TabView = "request" | "response";

interface StepDefinition {
    id: StepId;
    stepNumber: string;
    title: string;
    shortDesc: string;
    endpoint: string;
    method: "POST" | "GET" | "WEBHOOK";
    statusBadge: string;
    description: string;
    keyHighlights: string[];
}

const STEPS: StepDefinition[] = [
    {
        id: "enqueue",
        stepNumber: "01",
        title: "Enqueue Party / Player",
        shortDesc: "Submit party with MMR & ping metadata",
        endpoint: "/v1/queues/enqueue",
        method: "POST",
        statusBadge: "201 Created",
        description:
            "Game servers push solo players or premade parties into matchmaking pools with MMR ratings and multi-region ping latencies.",
        keyHighlights: ["Party & solo support", "Latency-based routing", "Idempotent submissions"],
    },
    {
        id: "ready-check",
        stepNumber: "02",
        title: "Ready Check Handshake",
        shortDesc: "2-way participant acceptance",
        endpoint: "/v1/matches/{matchId}/accept",
        method: "POST",
        statusBadge: "200 OK",
        description:
            "When candidate pools form, players confirm participation. The engine tracks atomic slot confirmations before server spin-up.",
        keyHighlights: ["Anti-AFK timer", "Escalating dodge penalties", "Auto-lockout protection"],
    },
    {
        id: "webhook",
        stepNumber: "03",
        title: "Verify HMAC Webhook",
        shortDesc: "Secure match delivery & launch",
        endpoint: "POST https://game.example.com/webhook",
        method: "WEBHOOK",
        statusBadge: "200 Verified",
        description:
            "Matching Hub delivers match allocations via HMAC SHA-256 signed webhooks with exponential backoff retries.",
        keyHighlights: ["SHA-256 signature verification", "Replay protection timestamp", "Complete slot allocation"],
    },
];

const LANGUAGES: { id: Language; label: string; fileExt: string }[] = [
    { id: "typescript", label: "TypeScript", fileExt: "ts" },
    { id: "python", label: "Python", fileExt: "py" },
    { id: "go", label: "Go", fileExt: "go" },
    { id: "curl", label: "cURL", fileExt: "sh" },
];

const SNIPPETS: Record<StepId, Record<Language, { code: string; filename: string }>> = {
    enqueue: {
        typescript: {
            filename: "enqueue-player.ts",
            code: `import { createHmac } from "node:crypto";

const API_KEY = process.env.MATCHING_HUB_API_KEY!;
const BASE_URL = "https://api.matchinghub.dev/v1";

interface EnqueuePayload {
  projectId: string;
  gameModeId: string;
  environment: "production" | "staging";
  region: string;
  team: {
    externalTeamId?: string;
    members: Array<{ playerId: string; rating?: number }>;
  };
  metadata?: Record<string, unknown>;
}

export async function enqueueParty() {
  const payload: EnqueuePayload = {
    projectId: "proj_99a8b7c6",
    gameModeId: "mode_ranked_5v5",
    environment: "production",
    region: "ap-southeast-1",
    team: {
      externalTeamId: "party_bravo_404",
      members: [
        { playerId: "usr_vanguard_01", rating: 1540 },
        { playerId: "usr_sentinel_02", rating: 1495 }
      ]
    },
    metadata: {
      partySize: 2,
      latencies: { "ap-southeast-1": 24, "ap-east-1": 68 }
    }
  };

  const response = await fetch(\`\${BASE_URL}/queues/enqueue\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": \`enq_\${Date.now()}_party_bravo\`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(\`Enqueue failed: \${response.statusText}\`);
  const data = await response.json();
  console.log("Enqueued successfully:", data.queueEntryId, data.poolKey);
  return data;
}`,
        },
        python: {
            filename: "enqueue_player.py",
            code: `import os
import time
import httpx

API_KEY = os.environ["MATCHING_HUB_API_KEY"]
BASE_URL = "https://api.matchinghub.dev/v1"

payload = {
    "projectId": "proj_99a8b7c6",
    "gameModeId": "mode_ranked_5v5",
    "environment": "production",
    "region": "ap-southeast-1",
    "team": {
        "externalTeamId": "party_bravo_404",
        "members": [
            {"playerId": "usr_vanguard_01", "rating": 1540},
            {"playerId": "usr_sentinel_02", "rating": 1495},
        ]
    },
    "metadata": {
        "partySize": 2,
        "latencies": {"ap-southeast-1": 24, "ap-east-1": 68}
    }
}

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Idempotency-Key": f"enq_{int(time.time())}_party_bravo"
}

with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
    response = client.post("/queues/enqueue", json=payload, headers=headers)
    response.raise_for_status()
    entry = response.json()
    print(f"Queue Entry ID: {entry['queueEntryId']} | Pool: {entry['poolKey']}")`,
        },
        go: {
            filename: "enqueue.go",
            code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type TeamMember struct {
	PlayerID string \`json:"playerId"\`
	Rating   int    \`json:"rating"\`
}

type EnqueueRequest struct {
	ProjectID   string                 \`json:"projectId"\`
	GameModeID  string                 \`json:"gameModeId"\`
	Environment string                 \`json:"environment"\`
	Region      string                 \`json:"region"\`
	Team        struct {
		ExternalTeamID string       \`json:"externalTeamId"\`
		Members        []TeamMember \`json:"members"\`
	} \`json:"team"\`
	Metadata    map[string]interface{} \`json:"metadata"\`
}

func main() {
	apiKey := os.Getenv("MATCHING_HUB_API_KEY")
	reqBody := EnqueueRequest{
		ProjectID:   "proj_99a8b7c6",
		GameModeID:  "mode_ranked_5v5",
		Environment: "production",
		Region:      "ap-southeast-1",
		Metadata: map[string]interface{}{
			"partySize": 2,
			"latencies": map[string]int{"ap-southeast-1": 24, "ap-east-1": 68},
		},
	}
	reqBody.Team.ExternalTeamID = "party_bravo_404"
	reqBody.Team.Members = []TeamMember{
		{PlayerID: "usr_vanguard_01", Rating: 1540},
		{PlayerID: "usr_sentinel_02", Rating: 1495},
	}

	payload, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://api.matchinghub.dev/v1/queues/enqueue", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", fmt.Sprintf("enq_%d_party_bravo", time.Now().Unix()))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusCreated {
		panic("enqueue request failed")
	}
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}`,
        },
        curl: {
            filename: "enqueue.sh",
            code: `curl -X POST https://api.matchinghub.dev/v1/queues/enqueue \\
  -H "Authorization: Bearer $MATCHING_HUB_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: enq_1724688000_party_bravo" \\
  -d '{
    "projectId": "proj_99a8b7c6",
    "gameModeId": "mode_ranked_5v5",
    "environment": "production",
    "region": "ap-southeast-1",
    "team": {
      "externalTeamId": "party_bravo_404",
      "members": [
        { "playerId": "usr_vanguard_01", "rating": 1540 },
        { "playerId": "usr_sentinel_02", "rating": 1495 }
      ]
    },
    "metadata": {
      "partySize": 2,
      "latencies": {
        "ap-southeast-1": 24,
        "ap-east-1": 68
      }
    }
  }'`,
        },
    },
    "ready-check": {
        typescript: {
            filename: "ready-check.ts",
            code: `const API_KEY = process.env.MATCHING_HUB_API_KEY!;
const BASE_URL = "https://api.matchinghub.dev/v1";

interface AcceptResponse {
  matchId: string;
  status: "pending_acceptance" | "confirmed";
  acceptedCount: number;
  requiredCount: number;
  isComplete: boolean;
}

// 1. Inspect active ready-check countdown
export async function getReadyCheckStatus(matchId: string) {
  const res = await fetch(\`\${BASE_URL}/matches/\${matchId}/ready-check\`, {
    headers: { "Authorization": \`Bearer \${API_KEY}\` }
  });
  return res.json();
}

// 2. Submit player handshake acceptance
export async function acceptMatch(matchId: string, playerId: string, teamId: string): Promise<AcceptResponse> {
  const response = await fetch(\`\${BASE_URL}/matches/\${matchId}/accept\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ playerId, teamId })
  });

  const result = await response.json();
  if (result.isComplete) {
    console.log("All players accepted! Server allocating instance...");
  }
  return result;
}`,
        },
        python: {
            filename: "ready_check.py",
            code: `import os
import httpx

API_KEY = os.environ["MATCHING_HUB_API_KEY"]
BASE_URL = "https://api.matchinghub.dev/v1"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def accept_match(match_id: str, player_id: str, team_id: str) -> dict:
    url = f"{BASE_URL}/matches/{match_id}/accept"
    payload = {"playerId": player_id, "teamId": team_id}
    
    with httpx.Client() as client:
        resp = client.post(url, json=payload, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        
        if data.get("isComplete"):
            print(f"Match {match_id} fully accepted! Preparing game server...")
        else:
            print(f"Accepted: {data['acceptedCount']}/{data['requiredCount']} slots ready.")
        return data`,
        },
        go: {
            filename: "ready_check.go",
            code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type AcceptPayload struct {
	PlayerID string \`json:"playerId"\`
	TeamID   string \`json:"teamId"\`
}

type AcceptResult struct {
	MatchID       string \`json:"matchId"\`
	Status        string \`json:"status"\`
	AcceptedCount int    \`json:"acceptedCount"\`
	RequiredCount int    \`json:"requiredCount"\`
	IsComplete    bool   \`json:"isComplete"\`
}

func AcceptMatch(matchID, playerID, teamID string) (*AcceptResult, error) {
	apiKey := os.Getenv("MATCHING_HUB_API_KEY")
	body, _ := json.Marshal(AcceptPayload{PlayerID: playerID, TeamID: teamID})
	
	req, _ := http.NewRequest("POST", fmt.Sprintf("https://api.matchinghub.dev/v1/matches/%s/accept", matchID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result AcceptResult
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}`,
        },
        curl: {
            filename: "accept.sh",
            code: `curl -X POST https://api.matchinghub.dev/v1/matches/match_88f912c4/accept \\
  -H "Authorization: Bearer $MATCHING_HUB_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "playerId": "usr_vanguard_01",
    "teamId": "party_bravo_404"
  }'`,
        },
    },
    webhook: {
        typescript: {
            filename: "webhook-handler.ts",
            code: `import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const WEBHOOK_SECRET = process.env.MATCHING_HUB_WEBHOOK_SECRET!; // whsec_...

export function verifyMatchingHubSignature(rawBody: string, timestamp: string, signatureHeader: string): boolean {
  const keyHex = WEBHOOK_SECRET.replace(/^whsec_/, "");
  const key = Buffer.from(keyHex, "hex");
  
  const computedHash = createHmac("sha256", key)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest("hex");
  
  const expectedSig = \`sha256=\${computedHash}\`;
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export async function handleWebhook(req: IncomingMessage, res: ServerResponse, rawBody: string) {
  const timestamp = req.headers["x-webhook-timestamp"] as string;
  const signature = req.headers["x-webhook-signature"] as string;
  const event = req.headers["x-webhook-event"] as string;

  if (!verifyMatchingHubSignature(rawBody, timestamp, signature)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: "Invalid HMAC signature" }));
  }

  const payload = JSON.parse(rawBody);
  if (event === "match.confirmed" || event === "match.created") {
    const { matchId, slots, gameModeId, regionKey } = payload.data;
    console.log(\`[SPAWN] Match ready: \${matchId} in \${regionKey} (\${slots.length} teams)\`);
    // Allocate server instance...
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ received: true }));
}`,
        },
        python: {
            filename: "webhook_handler.py",
            code: `import os
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException, Header

app = FastAPI()
WEBHOOK_SECRET = os.environ["MATCHING_HUB_WEBHOOK_SECRET"] # whsec_...

def verify_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    key_hex = WEBHOOK_SECRET.removeprefix("whsec_")
    key = bytes.fromhex(key_hex)
    
    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
    computed_hex = hmac.new(key, signed_payload, hashlib.sha256).hexdigest()
    expected_signature = f"sha256={computed_hex}"
    return hmac.compare_digest(expected_signature, signature)

@app.post("/webhook")
async def match_webhook(
    request: Request,
    x_webhook_signature: str = Header(...),
    x_webhook_timestamp: str = Header(...),
    x_webhook_event: str = Header(...)
):
    body_bytes = await request.body()
    if not verify_signature(body_bytes, x_webhook_timestamp, x_webhook_signature):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")
        
    payload = await request.json()
    if x_webhook_event in ("match.confirmed", "match.created"):
        match_data = payload.get("data", {})
        print(f"Launching server for match {match_data.get('match_id')} in {match_data.get('region')}")
        
    return {"received": True}`,
        },
        go: {
            filename: "webhook.go",
            code: `package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

func verifyWebhookSignature(body []byte, timestamp, signatureHeader, secret string) bool {
	cleanSecret := strings.TrimPrefix(secret, "whsec_")
	key, err := hex.DecodeString(cleanSecret)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(fmt.Sprintf("%s.", timestamp)))
	mac.Write(body)
	expectedSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expectedSig), []byte(signatureHeader))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("MATCHING_HUB_WEBHOOK_SECRET")
	timestamp := r.Header.Get("X-Webhook-Timestamp")
	sig := r.Header.Get("X-Webhook-Signature")
	event := r.Header.Get("X-Webhook-Event")

	body, _ := io.ReadAll(r.Body)
	if !verifyWebhookSignature(body, timestamp, sig, secret) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	if event == "match.confirmed" || event == "match.created" {
		fmt.Printf("Validated webhook %s! Allocating game server.\\n", event)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(\`{"received":true}\`))
}`,
        },
        curl: {
            filename: "verify_webhook.sh",
            code: `# Matching Hub webhook delivery payload:

POST https://game.example.com/api/matching-hub-webhook
X-Webhook-Event: match.confirmed
X-Webhook-Timestamp: 1724688015
X-Webhook-Signature: sha256=d3f82b7c4a1e905a3b7c89f012e45d6789abc01234def567890abcdef1234567
Content-Type: application/json

{
  "event": "match.confirmed",
  "eventId": "evt_998127364",
  "projectId": "proj_99a8b7c6",
  "occurredAt": "2026-08-26T10:00:15Z",
  "data": {
    "matchId": "match_88f912c4",
    "gameModeId": "mode_ranked_5v5",
    "environment": "production",
    "regionKey": "ap-southeast-1"
  }
}`,
        },
    },
};

const RESPONSES: Record<StepId, { status: string; body: string }> = {
    enqueue: {
        status: "201 Created",
        body: `{
  "queueEntryId": "qe_7f8a9b1c2d3e",
  "status": "queued",
  "poolKey": "proj_99a8b7c6:production:mode_ranked_5v5:ap-southeast-1",
  "queuedAt": "2026-08-26T10:00:00.124Z",
  "matchId": null
}`,
    },
    "ready-check": {
        status: "200 OK",
        body: `{
  "matchId": "match_88f912c4",
  "status": "confirmed",
  "acceptedCount": 2,
  "requiredCount": 2,
  "isComplete": true,
  "confirmedAt": "2026-08-26T10:00:08.512Z"
}`,
    },
    webhook: {
        status: "200 OK — Ack",
        body: `{
  "received": true,
  "gameServerInstanceId": "srv_sea_prod_8819",
  "status": "allocated"
}`,
    },
};

function highlightCode(line: string): React.ReactNode[] {
    const REGEX =
        /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|(\b(?:import|from|export|default|function|const|let|var|async|await|return|if|else|package|func|type|struct|def|with|as|class|panic|nil|true|false|null|undefined|interface)\b)|(\b(?:POST|GET|Bearer|X-[A-Za-z0-9_-]+)\b)|(\b\d+\b)/g;

    const nodes: React.ReactNode[] = [];
    let last = 0;
    let key = 0;

    for (let match = REGEX.exec(line); match !== null; match = REGEX.exec(line)) {
        if (match.index > last) {
            nodes.push(line.slice(last, match.index));
        }

        let className = "text-foreground";
        if (match[1]) {
            className = "text-muted-foreground/60 italic";
        } else if (match[2]) {
            className = "text-success";
        } else if (match[3]) {
            className = "text-warning font-medium";
        } else if (match[4]) {
            className = "text-primary font-semibold";
        } else if (match[5]) {
            className = "text-accent-foreground";
        }

        nodes.push(
            <span key={key++} className={className}>
                {match[0]}
            </span>,
        );
        last = match.index + match[0].length;
    }

    if (last < line.length) {
        nodes.push(line.slice(last));
    }

    return nodes;
}

export function CodeWalkthrough() {
    const [selectedStep, setSelectedStep] = React.useState<StepId>("enqueue");
    const [selectedLang, setSelectedLang] = React.useState<Language>("typescript");
    const [tabView, setTabView] = React.useState<TabView>("request");
    const [copied, setCopied] = React.useState(false);
    const copyTimer = React.useRef<number | undefined>(undefined);

    const currentStep = STEPS.find((s) => s.id === selectedStep) ?? STEPS[0];
    const currentSnippet = SNIPPETS[selectedStep][selectedLang];
    const currentResponse = RESPONSES[selectedStep];

    const activeContent = tabView === "request" ? currentSnippet.code : currentResponse.body;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(activeContent);
            setCopied(true);
            window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
        } catch {
            // Fallback
        }
    };

    return (
        <section className="mx-auto w-full max-w-6xl px-6 py-20" id="developer-hub">
            <div className="mb-12 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5 text-foreground" />
                    Developer Experience & SDK
                </span>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Integrate in minutes, not months
                </h2>
                <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground mx-auto">
                    A battle-tested matchmaking lifecycle with zero vendor lock-in. Pick your language, drop in your API
                    key, and handle callbacks.
                </p>
            </div>

            {/* Step Selection Tabs */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
                {STEPS.map((step) => {
                    const isActive = selectedStep === step.id;
                    return (
                        <button
                            key={step.id}
                            type="button"
                            onClick={() => setSelectedStep(step.id)}
                            className={cn(
                                "flex flex-col text-left p-4 rounded-xl border transition-all duration-150 relative overflow-hidden",
                                isActive
                                    ? "bg-card border-foreground/30 shadow-md ring-1 ring-border"
                                    : "bg-muted/10 border-border/70 hover:bg-muted/30 hover:border-border text-muted-foreground",
                            )}
                        >
                            <div className="flex items-center justify-between w-full mb-2">
                                <span
                                    className={cn(
                                        "font-mono text-xs font-bold px-2 py-0.5 rounded",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    STEP {step.stepNumber}
                                </span>
                                <Badge
                                    variant={isActive ? "default" : "outline"}
                                    className="text-[10px] uppercase font-mono"
                                >
                                    {step.method}
                                </Badge>
                            </div>
                            <span
                                className={cn(
                                    "text-sm font-semibold",
                                    isActive ? "text-foreground" : "text-muted-foreground",
                                )}
                            >
                                {step.title}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1 line-clamp-1">{step.shortDesc}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Interactive Code Window */}
            <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
                {/* Top Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                    {/* Left: Terminal dots + Filename */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full bg-destructive/80" />
                            <span className="size-2.5 rounded-full bg-warning/80" />
                            <span className="size-2.5 rounded-full bg-success/80" />
                        </div>
                        <div className="hidden sm:flex items-center gap-2 border-l pl-3 font-mono text-xs text-muted-foreground">
                            <Terminal className="size-3.5 text-muted-foreground" />
                            <span>{tabView === "request" ? currentSnippet.filename : "response.json"}</span>
                        </div>
                    </div>

                    {/* Middle: Language Selector */}
                    {tabView === "request" && (
                        <div className="flex items-center rounded-lg border bg-background/80 p-0.5 shadow-inner">
                            {LANGUAGES.map((lang) => {
                                const isLangActive = selectedLang === lang.id;
                                return (
                                    <button
                                        key={lang.id}
                                        type="button"
                                        onClick={() => setSelectedLang(lang.id)}
                                        className={cn(
                                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors font-mono",
                                            isLangActive
                                                ? "bg-card text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {lang.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Right: Request / Response Switcher + Copy Button */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center rounded-lg border bg-background/60 p-0.5">
                            <button
                                type="button"
                                onClick={() => setTabView("request")}
                                className={cn(
                                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                    tabView === "request"
                                        ? "bg-card text-foreground shadow-xs"
                                        : "text-muted-foreground",
                                )}
                            >
                                Request
                            </button>
                            <button
                                type="button"
                                onClick={() => setTabView("response")}
                                className={cn(
                                    "rounded px-2 py-0.5 text-xs font-medium transition-colors flex items-center gap-1",
                                    tabView === "response"
                                        ? "bg-card text-foreground shadow-xs"
                                        : "text-muted-foreground",
                                )}
                            >
                                Response
                                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopy}
                            aria-label="Copy Code"
                            className="inline-flex items-center gap-1.5 rounded-md border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="size-3.5 text-success" />
                                    <span className="text-success font-mono">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="size-3.5" />
                                    <span className="font-mono">Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Sub-header Information Pill */}
                <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2 font-mono text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="font-semibold text-foreground uppercase">{currentStep.method}</span>
                        <span className="text-muted-foreground">{currentStep.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="font-mono text-[11px] bg-background">
                            {tabView === "request"
                                ? `${currentSnippet.code.split("\n").length} lines`
                                : currentStep.statusBadge}
                        </Badge>
                    </div>
                </div>

                {/* Code Body */}
                <pre className="max-h-[460px] overflow-auto p-5 font-mono text-xs leading-relaxed text-foreground/90 selection:bg-primary/20">
                    <code>
                        {activeContent.split("\n").map((line, idx) => (
                            <div key={idx} className="table-row">
                                <span className="table-cell select-none pr-4 text-right text-muted-foreground/40 text-[11px] w-8">
                                    {idx + 1}
                                </span>
                                <span className="table-cell">{line.length > 0 ? highlightCode(line) : " "}</span>
                            </div>
                        ))}
                    </code>
                </pre>

                {/* Step Context & Architecture Footer */}
                <div className="grid grid-cols-1 gap-4 border-t bg-muted/10 p-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            <strong className="text-foreground">{currentStep.title}: </strong>
                            {currentStep.description}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {currentStep.keyHighlights.map((hl) => (
                            <span
                                key={hl}
                                className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                            >
                                <ShieldCheck className="size-3 text-success" />
                                {hl}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
