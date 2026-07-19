export type Channel = "LIVE" | "PTU";
export type Confidence = "high" | "medium" | "low";

export interface RegistryEnvelope<T extends Record<string, unknown>> {
  schemaVersion?: number;
  channel?: string;
  buildId?: string;
  generatedAt?: string;
  registry?: string;
  recordCount?: number;
  recordSchemaVersion?: number;
  records: T[];
}

export interface DatasetSelection {
  channel: Channel;
  buildId: string;
  fittingRoot: string;
  explicitBuild: boolean;
  legacyStorageFallback: boolean;
}

export interface ApiMeta {
  apiVersion: "1";
  artifactSchemaVersion: number;
  channel: Channel;
  buildId: string;
  generatedAt: string;
}

export interface RouteResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  requestId: string;
  errors: Array<{ path: string; code: string; message: string }>;
}

export class FittingHttpError extends Error {
  status: number;
  code: string;
  title: string;
  errors: ProblemBody["errors"];

  constructor(status: number, code: string, title: string, detail: string, errors: ProblemBody["errors"] = []) {
    super(detail);
    this.status = status;
    this.code = code;
    this.title = title;
    this.errors = errors;
  }
}

