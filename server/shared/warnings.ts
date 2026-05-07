export interface ApiWarning {
  code: string;
  message: string;
  path?: string;
  materialId?: string;
  materialName?: string;
}

export function addWarning<T extends ApiWarning>(warnings: T[], warning: T): void {
  warnings.push(warning);
}
