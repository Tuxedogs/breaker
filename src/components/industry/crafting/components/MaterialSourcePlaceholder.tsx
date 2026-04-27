export default function MaterialSourcePlaceholder() {
  return (
    <div className="craft-section craft-section--wip">
      <div className="craft-section-header">
        <span className="craft-section-title">Material Sources</span>
        <span className="craft-badge craft-badge--wip">Coming Soon</span>
      </div>
      <div className="craft-wip-body">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28" className="craft-wip-icon">
          <path d="M14.5 4l5.5 5.5-11 11L3.5 15 14.5 4zM9 9l6 6" />
        </svg>
        <div>
          <div className="craft-wip-title">Material source data coming soon</div>
          <div className="craft-wip-desc">
            Mining routes, trade routes, and spawn locations for each material will be added once location data is parsed from the game files.
          </div>
        </div>
      </div>
    </div>
  );
}
