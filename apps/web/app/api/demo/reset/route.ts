import { demoDequeue, isDemoEnabled } from "@/lib/demo";

export async function POST(request: Request) {
    if (!isDemoEnabled()) {
        return Response.json({ error: "Demo is not configured" }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as { queueEntryIds?: string[] } | null;
    const ids = Array.isArray(body?.queueEntryIds) ? body.queueEntryIds.slice(0, 50) : [];

    await Promise.allSettled(ids.map((id) => demoDequeue(String(id))));

    return Response.json({ ok: true, cancelled: ids.length });
}