import { type DemoMode, demoEnqueue, isDemoEnabled } from "@/lib/demo";

export async function POST(request: Request) {
    if (!isDemoEnabled()) {
        return Response.json({ error: "Demo is not configured" }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as { mode?: string; rating?: number } | null;
    const mode: DemoMode = body?.mode === "casual" ? "casual" : "skill";
    const rating =
        typeof body?.rating === "number" && Number.isFinite(body.rating)
            ? Math.max(100, Math.min(4000, Math.round(body.rating)))
            : 800 + Math.floor(Math.random() * 1400);

    try {
        const result = await demoEnqueue(mode, rating);
        return Response.json(result);
    } catch {
        return Response.json({ error: "Enqueue failed" }, { status: 502 });
    }
}