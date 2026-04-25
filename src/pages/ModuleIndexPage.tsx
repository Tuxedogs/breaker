import { Navigate, useLocation } from "react-router-dom";

export default function ModuleIndexPage() {
  const location = useLocation();
  return <Navigate to={`/doctrine${location.search}`} replace />;
}
