import { ImageResponse } from "next/og";

// Industrial monochrome brand mark for "Matching Hub" as the browser-tab favicon.
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
                background: "#09090b",
                border: "1px solid #27272a",
            }}
        >
            <div style={{ display: "flex", alignItems: "center" }}>
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        background: "#fafafa",
                    }}
                />
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        background: "rgba(250, 250, 250, 0.55)",
                        marginLeft: -3,
                    }}
                />
            </div>
        </div>,
        { ...size },
    );
}
