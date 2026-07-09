import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { SwrProvider } from "@/components/swr-provider";
// eslint-disable-next-line import/no-unassigned-import -- global stylesheet side-effect import
import "./globals.css";

export const metadata: Metadata = {
    title: "Matching Hub — Admin",
    description: "Operator dashboard for the matchmaking platform",
};

// Applied before first paint so the stored theme never flashes. Defaults to dark
// when no preference is saved.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark', t ? t!=='light' : true);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className="min-h-screen bg-background font-sans antialiased">
                <SwrProvider>{children}</SwrProvider>
                <Toaster />
            </body>
        </html>
    );
}
