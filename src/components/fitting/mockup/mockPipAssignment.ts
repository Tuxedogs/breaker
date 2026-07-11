import type { PipAssignment } from "../../../lib/fitting/fittingTerminalTypes";

export const INITIAL_MOCK_PIP_ASSIGNMENT: PipAssignment = {
  weapons: 4,
  engines: 2,
  quantum: 3,
  radar: 2,
  lifeSupport: 2,
  cooler1: 2,
  cooler2: 2,
};

export function sumMockPipAssignment(assignment: PipAssignment): number {
  return Object.values(assignment).reduce((sum, value) => sum + value, 0);
}
