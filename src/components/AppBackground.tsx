import { useLocation } from "react-router-dom";

export default function AppBackground() {
  const { pathname } = useLocation();
  const backgroundImage =
    pathname === "/ships/perseus"
      ? 'url("/images/bg-states/percy-final.png")'
      : 'url("/images/bg-states/starting.png")';

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
