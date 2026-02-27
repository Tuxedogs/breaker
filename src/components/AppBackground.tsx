import { useLocation } from "react-router-dom";
import { moduleById } from "../data/modules";

const shipBackgroundBySlug: Record<string, string> = {
  perseus: "/images/bg-states/percy-final.png",
};

function resolveShipSlug(pathname: string, search: string): string | null {
  if (pathname.startsWith("/ships/")) {
    const slug = pathname.split("/")[2];
    return slug || null;
  }

  if (pathname.startsWith("/module/")) {
    const moduleId = pathname.split("/")[2];
    const module = moduleId ? moduleById.get(moduleId) : undefined;
    return module?.ships?.[0] ?? null;
  }

  if (pathname === "/modules") {
    const params = new URLSearchParams(search);
    return params.get("ship");
  }

  return null;
}

export default function AppBackground() {
  const { pathname, search } = useLocation();
  const shipSlug = resolveShipSlug(pathname, search);
  const shipBackground = shipSlug ? shipBackgroundBySlug[shipSlug] : undefined;
  const backgroundImage = shipBackground ? `url("${shipBackground}")` : 'url("/images/bg-states/starting.png")';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage }}
      />
      <div className="app-grain absolute inset-0" />
    </div>
  );
}
