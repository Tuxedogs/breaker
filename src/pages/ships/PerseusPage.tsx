import ShipPage, { type ShipPageData, type ShipSurfacePreset } from "../../components/ships/ShipPage";

const perseusData: ShipPageData = {
  name: "RSI Perseus",
  tagLine: '"Firing"',
  summary:
    "While not intended to engage capital ships, we use it against them anyway. A unique combination of speed, firepower, and durability allows it to excel in roles beyond its original design.",
  overview:
    "The RSI Perseus heavy gunship is a sub-capital brawler optimized for harassment and close-range pressure on other large ships. To engage corvettes and frigates, leverage superior maneuverability to exploit blind spots and avoid fair trades. This is achieved mostly through relative tracking.",
  pilotingSummary:
    "Relative tracking is the core piloting pattern. Maintain aft-oriented pressure while preserving position control and turret uptime.",
  relativeTracking: [
    "Establish alignment beneath the target while oriented aft.",
    "Focus pressure on vulnerable components toward the rear.",
    "Coordinate pitch and controlled thrust to maintain stable tracking.",
    "Use lateral thrust only as needed; avoid destabilizing turret firing windows.",
  ],
  criticalNotes: [
    {
      title: "Main Guns",
      status: "Operational",
      points: ["Hit registration remains inconsistent.", "Approx. 1.5km max effective range."],
    },
    {
      title: "Torpedoes",
      status: "Operational",
      points: ["Stalker V.", "Extremely high hit rates when disciplined."],
    },
    {
      title: "Capital Railguns",
      status: "Caution",
      points: ["Deploy Polaris support.", "Use long-range sniping operations when needed."],
    },
  ],
  crewRoles: [
    {
      title: "Gunner",
      body: "Maintain turret discipline and stance control. Against smaller hulls, strip shields and finish components. Against larger hulls, deny clear lines and force tracking errors.",
    },
    {
      title: "Torpedo Control",
      body: "Lock torpedoes only when viable. Preserve bridge heat and avoid wasteful launches. Value volume and timing over isolated damage spikes.",
    },
    {
      title: "Coordination",
      body: "Keep callouts concise. Pilot and gunners should continuously share target state, drift corrections, and pressure windows.",
    },
  ],
  positioning: ["20,000m - Mid Zone", "2,500m - Risk Zone", "2,500m - X1IPS / X2IPS pressure window"],
  loadout: ["EX-CS Torpedoes", "S7 Ballistic (x2)", "S3 Laser Repeaters (x4)"],
  generalRules: ["Restock torpedo racks before recommit.", "Avoid off-bore torpedo launches."],
};

export default function PerseusPage() {
  const surfacePreset: ShipSurfacePreset = {
    panelBgClass: "bg-[rgba(0,0,0,0.40px,)]",
    panelBlurClass: "backdrop-blur-[12px]",
    subPanelBgClass: "bg-[rgba(0,0,0,0.40px,)]",
    subPanelBlurClass: "backdrop-blur-[12px]",
  };

  return <ShipPage accent="amber" data={perseusData} surfacePreset={surfacePreset} />;
}
