import { Link } from "react-router-dom";

type ImportSource = "inventory" | "locations" | "build-queue" | "dashboard";

export default function ScreenshotImportButton({ source }: { source: ImportSource }) {
  return (
    <Link
      to={`/logistics/refinery-import?source=${source}`}
      className="logi-btn-ghost"
      style={{ textDecoration: "none" }}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      Screenshot Import
    </Link>
  );
}
