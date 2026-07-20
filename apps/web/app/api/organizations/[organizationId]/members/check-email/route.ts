import { proxyGet } from "@/lib/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
    const { organizationId } = await params;
    const email = new URL(request.url).searchParams.get("email") ?? "";
    return proxyGet<{ exists: boolean }>(
        `/organizations/${organizationId}/members/check-email?email=${encodeURIComponent(email)}`,
    );
}
