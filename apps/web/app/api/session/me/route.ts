import { getCurrentUser } from "@/lib/api";

export async function GET() {
    try {
        const user = await getCurrentUser();
        return Response.json({ authenticated: true, email: user.email });
    } catch {
        return Response.json({ authenticated: false });
    }
}
