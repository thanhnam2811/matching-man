import { demoQueueEntry, isDemoEnabled } from "@/lib/demo";

export async function GET(request: Request) {
    if (!isDemoEnabled()) {
        return Response.json({ error: "Demo is not configured" }, { status: 503 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
    }

    try {
        return Response.json(await demoQueueEntry(id));
    } catch {
        return Response.json({ error: "Queue entry not found" }, { status: 404 });
    }
}
