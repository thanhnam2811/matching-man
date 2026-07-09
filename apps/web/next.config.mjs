/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Keep dynamic route segments (the project tabs) in the client Router
        // Cache for a short window so switching back to an already-visited tab is
        // instant instead of re-hitting the API. Mutations still `revalidatePath`.
        staleTimes: { dynamic: 30, static: 180 },
    },
};

export default nextConfig;
