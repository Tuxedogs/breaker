import { useLocation } from "react-router-dom";

export default function Background() {
  const { pathname } = useLocation();

  let bgClass = "/src/public/images/bg-states/starting.png";

  if (pathname.startsWith("/docs/systems") || pathname.startsWith("/docs/getting-started")) bgClass = "bg-systems";
  else if (pathname.startsWith("/docs/ships")) bgClass = "bg-ships";
  else if (pathname.startsWith("/docs/doctrine") || pathname.startsWith("/docs/writing-mdx")) bgClass = "bg-doctrine";

  return <div className={`app-bg ${bgClass}`} />;
}
