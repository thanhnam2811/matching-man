import { getCurrentUser } from "@/lib/api";

export async function GET() {
    try {
        const user = await getCurrentUser();
        return Response.json({ authenticated: true, email: user.email, name: user.name });
    } catch {
        return Response.json({ authenticated: false });
    }
}
