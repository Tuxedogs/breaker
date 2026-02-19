import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import DoctrineFirstFramework from "./pages/DoctrineFirstFramework";
import HeroOpening from "./pages/HeroOpening";
import WipPage from "./pages/WipPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HeroOpening />} />
        <Route path="framework" element={<DoctrineFirstFramework />} />
        <Route path="ships/:shipId" element={<WipPage section="Ships" />} />
        <Route path="systems/:systemId" element={<WipPage section="Systems" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
