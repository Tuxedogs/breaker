import { Link } from 'react-router-dom';
import { mockLocations, mockInventory, mockMaterials } from '../../data/mock/logistics';
import LocationCard from '../../components/logistics/LocationCard';

export default function LocationsPage() {
  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Locations</span>
          </div>
          <h1 className="logi-page-title">Locations</h1>
          <p className="logi-page-subtitle">Material totals by storage location.</p>
        </div>
      </div>

      <div className="logi-location-grid">
        {mockLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            inventory={mockInventory}
            materials={mockMaterials}
          />
        ))}
      </div>
    </div>
  );
}
