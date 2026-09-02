import { ImageResponse } from "next/og";

/*
 * Social preview card.
 *
 * Composed from the official five-circle logomark on the interface ground, so a
 * link shared to a student in a chat carries the same identity as the poster.
 * Rendered at build/request time — no binary asset is committed.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "LOGOS — The Tokyo International School Math Club. Fridays, 15:30 to 16:30, Room 101.";

const CIRCLES = [
  { cx: 150, cy: 150 },
  { cx: 198, cy: 198 },
  { cx: 102, cy: 102 },
  { cx: 102, cy: 198 },
  { cx: 198, cy: 102 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#100d12",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="96" height="96" viewBox="0 0 300 300">
          {CIRCLES.map((circle) => (
            <circle
              key={`${circle.cx}-${circle.cy}`}
              cx={circle.cx}
              cy={circle.cy}
              r={96}
              fill="none"
              stroke="#c4b5fd"
              strokeWidth={12}
            />
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: 12,
            color: "#f3eff5",
          }}
        >
          LOGOS
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 700,
            color: "#f3eff5",
            lineHeight: 1.1,
          }}
        >
          Mathematics, taken seriously.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#a79fae",
          }}
        >
          The student-led mathematics club of Tokyo International School
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 20,
          fontSize: 26,
          color: "#c4b5fd",
          borderTop: "1px solid #2c2532",
          paddingTop: 28,
        }}
      >
        <span>Fridays</span>
        <span style={{ color: "#443b4c" }}>·</span>
        <span>15:30–16:30</span>
        <span style={{ color: "#443b4c" }}>·</span>
        <span>Room 101</span>
        <span style={{ color: "#443b4c" }}>·</span>
        <span>Grades 9–12</span>
      </div>
    </div>,
    size,
  );
}
