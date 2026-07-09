const itemTurretIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemTurret.svg", import.meta.url).href;
const itemGunIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemGun.svg", import.meta.url).href;
const turretSeatIcon = new URL("../../assets/icons/engineering/Engineering_Icon_RoomTurretSeat.svg", import.meta.url).href;
const radarIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemRadar.svg", import.meta.url).href;
const quantumDriveIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemQuantumDrive.svg", import.meta.url).href;
const powerPlantIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemPowerPlant.svg", import.meta.url).href;
const missileIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemMissile.svg", import.meta.url).href;
const lifeSupportIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemLifeSupport.svg", import.meta.url).href;
const jumpDriveIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemJumpDrive.svg", import.meta.url).href;
const coolerIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemCooler.svg", import.meta.url).href;
const batteryIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemBattery.svg", import.meta.url).href;
const shieldIcon = new URL("../../assets/icons/engineering/Engineering_Icon_ItemShieldGenerator.svg", import.meta.url).href;

export type FittingSlotIconInput = {
  slotKind?: string | null;
  componentType?: string | null;
  hardpointType?: string | null;
  turretControlType?: string | null;
  itemType?: string | null;
  portType?: string | null;
};

function normalized(...values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

export function getFittingSlotIcon(input: FittingSlotIconInput): string {
  const text = normalized(
    input.slotKind,
    input.componentType,
    input.hardpointType,
    input.turretControlType,
    input.itemType,
    input.portType,
  );

  if (text.includes("manned turret") || text.includes("turret group") || text.includes("turretbase")) {
    return itemTurretIcon;
  }
  if (
    text.includes("pilot slaved")
    || text.includes("pilot-slaved")
    || text.includes("remote turret")
    || text.includes("seat controlled")
    || text.includes("seat-controlled")
    || text.includes("gun turret")
  ) {
    return turretSeatIcon;
  }
  if (text.includes("radar") || text.includes("scanner")) return radarIcon;
  if (text.includes("jump drive")) return jumpDriveIcon;
  if (text.includes("quantum") || text.includes("qt drive")) return quantumDriveIcon;
  if (text.includes("power plant") || text.includes("powerplant")) return powerPlantIcon;
  if (text.includes("missile") || text.includes("bomb") || text.includes("torpedo")) return missileIcon;
  if (text.includes("life support")) return lifeSupportIcon;
  if (text.includes("cooler")) return coolerIcon;
  if (text.includes("battery")) return batteryIcon;
  if (text.includes("shield")) return shieldIcon;
  if (text.includes("weapon") || text.includes("gun") || text.includes("hardpoint")) return itemGunIcon;

  return itemGunIcon;
}
