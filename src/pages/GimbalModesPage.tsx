import { Link } from 'react-router-dom'
import '../tools/gunnery/gunnery.css'
import { ModeRecommender } from '../tools/gunnery/components/mode/ModeRecommender'

export default function GimbalModesPage() {
  return (
    <div className="gun-tool">
      <div className="gun-page-header">
        <div className="gun-page-header-left">
          <Link to="/doctrine" className="gun-page-breadcrumb">← Doctrine Library</Link>
          <h1 className="gun-page-title">Gimbal Modes</h1>
          <p className="gun-page-subtitle">AM vs PM targeting doctrine — when to use each mode</p>
        </div>
      </div>

      <div className="gun-layout">
        <div className="gun-content gun-content--scroll">
          <ModeRecommender />
        </div>
      </div>
    </div>
  )
}
