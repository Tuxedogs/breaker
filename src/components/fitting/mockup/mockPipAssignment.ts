import {
  DEFAULT_PIP_ASSIGNMENT,
  type PipAssignment,
} from "../../../lib/fitting/fittingTerminalTypes";

/**
 * The mockup no longer invents a ship-wide starting allocation. The fitting
 * page may replace this with a source-backed allocation once its component
 * demand has loaded.
 */
export const INITIAL_MOCK_PIP_ASSIGNMENT: PipAssignment = { ...DEFAULT_PIP_ASSIGNMENT };

export function sumMockPipAssignment(assignment: PipAssignment): number {
  return Object.values(assignment).reduce((sum, value) => sum + value, 0);
}
