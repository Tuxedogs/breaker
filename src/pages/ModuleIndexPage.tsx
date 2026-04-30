import { Navigate, useLocation } from "react-router-dom";

export default function ModuleIndexPage() {
  const location = useLocation();
  return <Navigate to={`/dashboard/doctrine/library${location.search}`} replace />;
}
