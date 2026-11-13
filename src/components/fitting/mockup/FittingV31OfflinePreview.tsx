import WorkspaceTabs from "../../shared/WorkspaceTabs";
import WorkspacePanel from "../../shared/WorkspacePanel";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./fitting-v31-offline-preview.css";

/**
 * V31b design reference when Vite fixtures have no Fitting API.
 * All ship stats and region overlays in this view are explicitly illustrative.
 * The production fitting path is FittingMockupShell with live API data.
 */
type Category = "power" | "shield" | "weapons" | "racks" | "missiles" | "quantum";
type Region = { id: string; category: Category; x: number; y: number; label: string };
const groups: { id: Category; label: string; size: string; count: number; example: string }[] = [
  { id: "power", label: "Power Plant", size: "S1", count: 1, example: "JS-300" },
  { id: "shield", label: "Shield Generator", size: "S1", count: 1, example: "FR-86" },
  { id: "weapons", label: "Ship Weapons", size: "S3", count: 3, example: "Weapon hardpoint" },
  { id: "racks", label: "Missile Rack", size: "S3", count: 1, example: "Missile rack" },
  { id: "missiles", label: "Missiles", size: "S2", count: 4, example: "Missile payload" },
  { id: "quantum", label: "Quantum Drive", size: "S1", count: 1, example: "Quantum drive" },
];
const regions: Region[] = [
  { id:"demo-power-0",category:"power",x:48.8,y:50,label:"Power plant" },
  { id:"demo-shield-0",category:"shield",x:57.7,y:52,label:"Shield generator" },
  { id:"demo-weapons-0",category:"weapons",x:29.4,y:60,label:"Left weapon" },
  { id:"demo-weapons-1",category:"weapons",x:70.2,y:60,label:"Right weapon" },
  { id:"demo-weapons-2",category:"weapons",x:49.4,y:31,label:"Central weapon" },
  { id:"demo-racks-0",category:"racks",x:80.5,y:64,label:"Missile rack" },
  { id:"demo-missiles-0",category:"missiles",x:20.1,y:62,label:"Missile payload" },
  { id:"demo-quantum-0",category:"quantum",x:49.1,y:72,label:"Quantum drive" },
];
const tabs = ["Stats", "Performance", "Source / views"] as const;
type Tab = typeof tabs[number];

export default function FittingV31OfflinePreview() {
  const [selectedId,setSelectedId] = useState(regions[0].id);
  const [category,setCategory] = useState<Category|"all">("all");
  const [showRegions,setShowRegions] = useState(true);
  const [zoom,setZoom] = useState(1);
  const [tab,setTab] = useState<Tab>("Stats");
  const selected = regions.find((region)=>region.id===selectedId) ?? regions[0];
  const selectedGroup = groups.find((group)=>group.id===selected.category) ?? groups[0];
  function chooseCategory(next: Category) {
    setCategory(next);
    setSelectedId(regions.find((region)=>region.category===next)?.id ?? regions[0].id);
  }
  return (
    <main className="fit-v31-offline" aria-label="Fitting reference preview">
      <header className="fit-v31-offline-hero">
        <div>
          <span>BREAKER / INDUSTRY / MODULE 05</span>
          <h1>FITTING TERMINAL</h1>
          <p>Select a demonstration hardpoint. Live equipment swaps require the Fitting API.</p>
        </div>
        <div className="fit-v31-offline-hero-tags"><span>EQUIPMENT DECISIONS</span><span>OFFLINE VISUAL FIXTURE</span></div>
      </header>
      <div className="fit-v31-offline-workspace">
        <WorkspacePanel as="aside" tone="filter" className="fit-v31-offline-left">
          <label className="fit-v31-offline-ship-select">
            <span>Selected ship</span>
            <select aria-label="Selected demo airframe" defaultValue="gladius">
              <option value="gladius">Aegis Gladius</option>
            </select>
          </label>
          <div className="fit-v31-offline-schematic">
            <svg viewBox="0 0 400 180" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label="Gladius illustrative top schematic">
              <path d="M200 13 220 65 316 102 360 120 354 138 270 127 235 154 223 166 177 166 165 154 130 127 46 138 40 120 84 102 180 65Z" fill="#12334a"/>
              <path d="M190 53 200 22 210 53 209 139 200 150 191 139Z"/>
              <path d="M72 112 179 77M328 112 221 77M122 133 171 117M278 133 229 117M200 2v16"/>
            </svg>
            <small>TOP / SCHEMATIC REFERENCE</small>
          </div>
          <p className="fit-v31-offline-context">ROLE <strong>Light fighter</strong> &nbsp; LOADOUT <strong>Demo</strong></p>
          <header className="fit-v31-offline-subhead">COMPONENTS <small>HARDPOINTS</small></header>
          <div className="fit-v31-offline-components">
            {groups.map((group) => (
              <button key={group.id} type="button"
                className={selected.category===group.id ? "is-selected" : ""}
                aria-pressed={selected.category===group.id}
                onClick={()=>chooseCategory(group.id)}>
                <span aria-hidden="true">◇</span>
                <span><strong>{group.label}</strong><small>{group.size} · {group.count} {group.count===1?"slot":"slots"}</small></span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <p className="fit-v31-offline-note">Illustrative Gladius slots from V31b. Fitting sources and compatibility are unavailable offline.</p>
        </WorkspacePanel>
        <WorkspacePanel as="section" tone="primary" className="fit-v31-offline-center">
          <div className="fit-v31-offline-import"><strong>SAMPLE FRONT RENDER</strong><small>Gladius front view reused from V31b · Not extracted EHP equipment data</small></div>
          <div className="fit-v31-offline-diagram">
            <div className="fit-v31-offline-views" role="group" aria-label="Ship render views">
              <button className="is-active" aria-pressed="true">Front</button>
              {["Top","Bottom","Port","Stbd"].map((view)=><button key={view} type="button" disabled title="No reference render supplied">{view}</button>)}
              <button type="button" onClick={()=>setZoom(1)} title="Reset zoom">Fit</button>
            </div>
            <div className="fit-v31-offline-stage">
              <div className="fit-v31-offline-image-area" style={{ transform: "scale("+zoom+")" }}>
                <img src="/assets/fitting/v31-gladius-demo-front.webp" alt="Aegis Gladius demonstration front render from V31b" />
                {showRegions && regions.filter((region)=>category==="all"||region.category===category).map((region)=>(
                  <button key={region.id} type="button"
                    className={"fit-v31-offline-hit fit-v31-offline-hit--"+region.category+(selectedId===region.id?" is-selected":"")}
                    style={{left:region.x+"%",top:region.y+"%"}}
                    aria-label={"Inspect "+region.label} aria-pressed={selectedId===region.id}
                    onClick={()=>setSelectedId(region.id)}><span /></button>
                ))}
              </div>
              <span className="fit-v31-offline-stage-label">FRONT / SAMPLE REGION MAPPING</span>
              <span className="fit-v31-offline-stage-source">Reference illustration, not verified EHP geometry</span>
              <div className="fit-v31-offline-zoom">
                <button type="button" onClick={()=>setZoom((value)=>Math.max(.8,Math.round((value-.1)*10)/10))} aria-label="Zoom out">−</button>
                <output>{Math.round(zoom*100)}%</output>
                <button type="button" onClick={()=>setZoom((value)=>Math.min(1.5,Math.round((value+.1)*10)/10))} aria-label="Zoom in">+</button>
              </div>
            </div>
            <div className="fit-v31-offline-legend">
              {([{id:"all",label:"All"},{id:"power",label:"Power"},{id:"shield",label:"Defense"},{id:"weapons",label:"Weapons"},{id:"quantum",label:"Quantum"}] as const).map((item)=>(
                <button key={item.id} type="button" className={category===item.id?"is-active":""}
                  onClick={()=>setCategory(item.id)}>{item.label}</button>
              ))}
              <label><input type="checkbox" checked={showRegions} onChange={(event)=>setShowRegions(event.target.checked)} /> Hit regions</label>
            </div>
          </div>
          <div className="fit-v31-offline-installed">
            <div><span>SHIP LOADOUT / {selectedGroup.label.toUpperCase()}</span><h2>Installed equipment</h2></div>
            <button type="button" disabled title="Live fitting data is unavailable in local fixtures">Change selected (offline)</button>
            <div className="fit-v31-offline-installed-row"><strong>{selectedGroup.label}</strong><span>{selectedGroup.example} · Sample only</span><span>{selectedGroup.size}</span></div>
          </div>
        </WorkspacePanel>
        <WorkspacePanel as="aside" tone="inspector" className="fit-v31-offline-right">
          <section className="fit-v31-offline-stats">
            <div className="fit-v31-offline-stats-title"><strong>Aegis Gladius</strong><small>ILLUSTRATIVE</small></div>
            <WorkspaceTabs
              className="fit-v31-offline-tabs"
              options={tabs.map((name) => ({ value: name, label: name }))}
              value={tab}
              onChange={setTab}
              label="Reference stats"
            />
            {tab==="Stats" ? <div className="fit-v31-offline-stat-list">
              <div><span>Power generation · demo</span><b>3,200 W</b></div>
              <div><span>Shield capacity · demo</span><b>1,900 HP</b></div>
              <div><span>Shield regen · demo</span><b>95 HP/s</b></div>
              <div><span>Total weapon DPS · demo</span><b>1,560</b></div>
              <div><span>Equipment slots · demo</span><b>11</b></div>
            </div> : tab==="Performance" ? <p className="fit-v31-offline-notice">Performance calculations require live ship, equipment and power simulation data. Demo figures are not authoritative.</p> : <p className="fit-v31-offline-notice">The front render and hit-region positions are taken from V31b. Other views require imported ship renders.</p>}
          </section>
          <section className="fit-v31-offline-inspector">
            <span>{selectedGroup.label.toUpperCase()} / DEMO MOUNT</span>
            <h2>{selectedGroup.example}</h2>
            <p>Selected reference: {selected.label}. This is a visual inspection only, not an equipped component.</p>
            <Link to="/industry/crafting">Browse Crafting</Link>
          </section>
          <div className="fit-v31-offline-notice">This is a local-fixtures design reference. No equipment changes or statistics are being saved.</div>
        </WorkspacePanel>
      </div>
    </main>
  );
}
