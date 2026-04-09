import { useLocation } from "react-router-dom";

const BASE_BG = "#0f0f11";

export default function Background() {
  const { pathname } = useLocation();

  const bgColor = pathname.startsWith("/tools/")
    ? `color-mix(in srgb, rgb(251 113 133) 3%, ${BASE_BG})`
    : `color-mix(in srgb, var(--module-accent, transparent) 4%, ${BASE_BG})`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        backgroundColor: bgColor,
      }}
    />
  );
}
