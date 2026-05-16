export type JsonParseOptions = {
  label: string;
  url: string;
  allowEmpty?: boolean;
};

export class JsonResponseError extends Error {
  readonly status: number;
  readonly contentType: string;
  readonly bodyPreview: string;
  readonly url: string;
  readonly label: string;

  constructor(message: string, details: {
    status: number;
    contentType: string;
    bodyPreview: string;
    url: string;
    label: string;
  }) {
    super(message);
    this.name = "JsonResponseError";
    this.status = details.status;
    this.contentType = details.contentType;
    this.bodyPreview = details.bodyPreview;
    this.url = details.url;
    this.label = details.label;
  }
}

function getBodyPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<");
}

function makeJsonError(
  reason: string,
  response: Response,
  options: JsonParseOptions,
  text: string,
): JsonResponseError {
  const contentType = response.headers.get("content-type") || "";
  const bodyPreview = getBodyPreview(text);
  return new JsonResponseError(
    `${options.label} ${reason}. url=${options.url} status=${response.status} content-type=${contentType || "unknown"} body="${bodyPreview}"`,
    {
      status: response.status,
      contentType,
      bodyPreview,
      url: options.url,
      label: options.label,
    },
  );
}

export async function parseJsonResponse<T>(
  response: Response,
  options: JsonParseOptions,
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text.trim()) {
    if (options.allowEmpty) return undefined as T;
    throw makeJsonError("returned an empty response", response, options, text);
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const reason = looksLikeHtml(text) ? "returned HTML instead of JSON" : "returned non-JSON response";
    throw makeJsonError(reason, response, options, text);
  }

  if (looksLikeHtml(text)) {
    throw makeJsonError("returned HTML with a JSON content-type", response, options, text);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw makeJsonError("returned invalid JSON", response, options, text);
  }
}
