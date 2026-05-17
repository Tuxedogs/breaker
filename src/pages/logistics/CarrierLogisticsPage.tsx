import { Link } from "react-router-dom";
import "../../components/logistics/logistics.css";
import "../../components/logistics/carrier-logistics.css";
import CarrierLogisticsPanel from "../../components/logistics/CarrierLogisticsPanel";

export default function CarrierLogisticsPage() {
  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Carrier Logistics</span>
          </div>
          <h1 className="logi-page-title">Carrier Logistics</h1>
          <p className="logi-page-subtitle">Plan rearm and repair cargo loads for carrier support operations.</p>
        </div>
      </div>

      <CarrierLogisticsPanel />
    </div>
  );
}
