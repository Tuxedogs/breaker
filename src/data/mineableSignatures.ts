export interface MineableSignature {
  name: string;
  values: number[];
}

export const MINEABLE_SIGNATURES: MineableSignature[] = [
  { name: "Agricium",       values: [3885, 7770, 11655, 15540, 19425] },
  { name: "Aluminium",      values: [4285, 8570, 12855, 17140, 21425, 25710] },
  { name: "Aslarite",       values: [3840, 7680, 11520, 15360, 19200] },
  { name: "Beryl",          values: [3540, 7080, 10620, 14160] },
  { name: "Bexalite",       values: [3600, 7200, 10800, 14400] },
  { name: "Borase",         values: [3570, 7140, 10710, 14280] },
  { name: "Copper",         values: [4240, 8480, 12720, 16960, 21200, 25440] },
  { name: "Corundum",       values: [4225, 8450, 12675, 16900, 21125, 25350] },
  { name: "FPS Mineables",  values: [3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000, 27000, 30000] },
  { name: "Gold",           values: [3585, 7170, 10755, 14340] },
  { name: "Hephaestanite",  values: [4180, 8360, 12540, 16720, 20900, 25080] },
  { name: "Ice",            values: [4300, 8600, 12900, 17200, 21500, 25800] },
  { name: "Iron",           values: [4270, 8540, 12810, 17080, 21350, 25620] },
  { name: "Laranite",       values: [3825, 7650, 11475, 15300, 19125] },
  { name: "Lindinium",      values: [3400, 6800, 10200] },
  { name: "Ouratite",       values: [3370, 6740, 10110] },
  { name: "Quantainium",    values: [3170, 6340] },
  { name: "Quartz",         values: [4210, 8420, 12630, 16840, 21050, 25260] },
  { name: "Riccite",        values: [3385, 6770, 10155] },
  { name: "ROC Mineables",  values: [4000, 8000, 12000, 16000, 20000, 24000, 28000] },
  { name: "Salvage",        values: [2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 26000, 28000, 30000] },
  { name: "Savrillium",     values: [3200, 6400] },
  { name: "Silicon",        values: [4255, 8510, 12765, 17020, 21275, 25530] },
  { name: "Stileron",       values: [3185, 6370] },
  { name: "Taranite",       values: [3555, 7110, 10665, 14220] },
  { name: "Tin",            values: [4195, 8390, 12585, 16780, 20975, 25170] },
  { name: "Titanium",       values: [3855, 7710, 11565, 15420, 19275] },
  { name: "Torite",         values: [3900, 7800, 11700, 15600, 19500] },
  { name: "Tungsten",       values: [3870, 7740, 11610, 15480, 19350] },
];
