import ShipPage, { type ShipPageData, type ShipSurfacePreset } from "../../components/ships/ShipPage";

const perseusData: ShipPageData = {
  name: "RSI Perseus",
  tagLine: '"Firing"',
  summary:
    "While not intended to engage capital ships, we use it against them anyway.",
  videoSrc: "/images/video/percy-position.mp4",
  videoCaption: "Piloting: Relative Tracking Engagement",
  overview:
    "The RSI Perseus heavy gunship is a sub-capital brawler optimized for harassment and close-range pressure on other large ships. To engage corvettes and frigates, leverage superior maneuverability to exploit blind spots and avoid fair trades.",
  pilotingSummary:
    "Relative tracking is the core piloting pattern against capital threats. Maintain aft-oriented pressure while preserving position control and turret uptime.",
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
      points: ["Deploy Polaris support.", "Use long-range sniping operations."],
    },
  ],
  crewRoles: [
    {
      title: "Gunners",
      body: "Maintain trigger discipline and spatial awareness. Against smaller hulls, hold fire until optimal ranges and delta. Against larger hulls, sub target vulnerable components.",
    },
    {
      title: "Engineering",
      body: "Gun 2's operator will flex into support roles as needed. Exponentially increasing overall ship survivability, and allowing for EVA/FPS operations.",
    },
    {
      title: "Coordination",
      body: "Keep callouts concise. Pilot and gunners should continuously share target state, platform stability, and pressure windows.",
    },
  ],
  positioning: ["5,600m - Max Range", "1,500m - Max Effective Range", "1,000m - Optimal Range"],
  loadout: ["Stalker V", "S3 GT-220 Mantis", "MRX Torrent PDC","2x JS-500", "2x Fullblock", "TS-2", "2x Blizzard",],
  loadoutLinkUrl: "https://www.spviewer.eu/",
  loadoutLinkLabel: "spviewer",
  generalRules: ["Fully stock torpedo racks before recommit.", "Fire off bore torpedoes when able, do not sacrifice uptime.", "Use main guns to finish off crippled targets."],
};

export default function PerseusPage() {
  const surfacePreset: ShipSurfacePreset = {
    panelBgClass: "bg-[rgba(0,0,0,0.30)]",
    panelBlurClass: "backdrop-blur-[8px]",
    subPanelBgClass: "bg-[rgba(0,0,0,0.30)]",
    subPanelBlurClass: "backdrop-blur-[8px]",
  };

  return <ShipPage accent="amber" data={perseusData} surfacePreset={surfacePreset} />;
}
