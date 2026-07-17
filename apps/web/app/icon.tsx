import { ImageResponse } from "next/og";

// Mirrors components/brand-mark.tsx (gradient square + two dots) as the browser-tab favicon.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center" }}>
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 9999,
                        background: "rgba(255,255,255,0.95)",
                    }}
                />
                <div
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 9999,
                        background: "rgba(255,255,255,0.6)",
                        marginLeft: -3,
                    }}
                />
            </div>
        </div>,
        { ...size },
    );
}
