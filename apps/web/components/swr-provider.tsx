"use client";

import { SWRConfig } from "swr";
import { jsonFetcher } from "@/lib/swr";

// Global SWR defaults. Reads are SSR-first (Server Components fetch with the
// token server-side and pass the result as `fallbackData`); SWR then keeps those
// views fresh with stale-while-revalidate against same-origin proxy routes.
export function SwrProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher: jsonFetcher,
                revalidateOnFocus: true,
                keepPreviousData: true,
                dedupingInterval: 2000,
            }}
        >
            {children}
        </SWRConfig>
    );
}
