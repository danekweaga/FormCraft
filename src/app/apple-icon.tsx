import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#183fe6",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 118,
            height: 118,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 28,
              height: 118,
              background: "#F4F1EA",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 98,
              height: 28,
              background: "#F4F1EA",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 46,
              width: 72,
              height: 26,
              background: "#F4F1EA",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 14,
                height: 34,
                background: "#3d5cff",
                borderRadius: 3,
              }}
            />
            <div
              style={{
                width: 14,
                height: 52,
                background: "#3d5cff",
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
