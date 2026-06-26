import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ambit — autonomous networking";

// The branded link-preview card (Slack, iMessage, Twitter, LinkedIn).
export default function OpengraphImage() {
  const atom = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 48" fill="none" stroke="#a99bff" stroke-width="2.2"><ellipse cx="24" cy="24" rx="18" ry="6.5" transform="rotate(20 24 24)"/><ellipse cx="24" cy="24" rx="18" ry="6.5" transform="rotate(78 24 24)"/><circle cx="24" cy="24" r="3.4" fill="#a99bff"/><circle cx="40.9" cy="30.2" r="2.6" fill="#a99bff"/></svg>`;
  const atomSrc = `data:image/svg+xml,${encodeURIComponent(atom)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "#0b0a16",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px", marginBottom: "48px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={atomSrc} width={84} height={84} alt="" />
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-1px" }}>Ambit</div>
        </div>

        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: "-2px", lineHeight: 1.05 }}>
          Your network,
        </div>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: "-2px", lineHeight: 1.05 }}>
          <span style={{ color: "#a99bff" }}>on autopilot.</span>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.6)", marginTop: "34px" }}>
          Autonomous networking. The right person, one message away.
        </div>
      </div>
    ),
    { ...size },
  );
}
