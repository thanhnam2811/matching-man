import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
// eslint-disable-next-line import/no-unassigned-import -- global stylesheet side-effect import
import "./globals.css";

export const metadata: Metadata = {
    title: "Matching Hub — Admin",
    description: "Operator dashboard for the matchmaking platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={cn("dark", GeistSans.variable, GeistMono.variable)}>
            <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
        </html>
    );
}