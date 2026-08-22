export const GENX_DEFAULT_BASE_URL = "https://query.genx.sh";

export type GenxJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type GenxJob = { id: string; status: GenxJobStatus; resultUrl?: string; errorMessage?: string; usage?: Record<string, unknown> };
export type GenxSession = { sessionId: string };

type GenxClientOptions = { apiKey?: string; baseUrl?: string; fetcher?: typeof fetch };

function configuration(options: GenxClientOptions = {}) {
  const apiKey = options.apiKey ?? process.env.GENX_API_KEY;
  if (!apiKey) throw new Error("GenX is unavailable until the deployment-only GENX_API_KEY is configured.");
  return { apiKey, baseUrl: (options.baseUrl ?? process.env.GENX_BASE_URL ?? GENX_DEFAULT_BASE_URL).replace(/\/$/, ""), fetcher: options.fetcher ?? fetch };
}

function normaliseStatus(value: unknown): GenxJobStatus {
  if (value === "completed") return "completed";
  if (value === "failed") return "failed";
  if (value === "cancelled") return "cancelled";
  if (value === "processing" || value === "running") return "running";
  return "queued";
}

async function request(path: string, init: RequestInit = {}, options: GenxClientOptions = {}) {
  const config = configuration(options);
  const response = await config.fetcher(`${config.baseUrl}/api/v1${path}`, { ...init, headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? `GenX request failed: ${body.error}` : `GenX request failed with status ${response.status}`);
  return body;
}

export async function createGenxJob(input: { model: string; params: Record<string, unknown>; metadata: Record<string, string>; idempotencyKey: string }, options: GenxClientOptions = {}) {
  const body = await request("/generate", { method: "POST", body: JSON.stringify({ model: input.model, params: input.params, metadata: input.metadata, idempotency_key: input.idempotencyKey }) }, options);
  const providerJobId = typeof body.job_id === "string" ? body.job_id : typeof body.id === "string" ? body.id : null;
  if (!providerJobId) throw new Error("GenX did not return a job ID.");
  return { providerJobId, status: normaliseStatus(body.status) };
}

/** Creates a documented chat session. Sending messages remains disabled until GenX documents that request schema and source-attribution contract. */
export async function createGenxSession(input: { model: string; systemPrompt: string }, options: GenxClientOptions = {}): Promise<GenxSession> {
  const body = await request("/sessions", { method: "POST", body: JSON.stringify({ model: input.model, system_prompt: input.systemPrompt }) }, options);
  const sessionId = typeof body.session_id === "string" ? body.session_id : typeof body.id === "string" ? body.id : null;
  if (!sessionId) throw new Error("GenX did not return a session ID.");
  return { sessionId };
}

export async function getGenxJob(providerJobId: string, options: GenxClientOptions = {}): Promise<GenxJob> {
  const body = await request(`/jobs/${encodeURIComponent(providerJobId)}`, {}, options);
  return { id: typeof body.job_id === "string" ? body.job_id : typeof body.id === "string" ? body.id : providerJobId, status: normaliseStatus(body.status), resultUrl: typeof body.result_url === "string" ? body.result_url : undefined, errorMessage: typeof body.error === "string" ? body.error : typeof body.error_message === "string" ? body.error_message : undefined, usage: body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : undefined };
}

export async function getGenxResultUrl(providerJobId: string, options: GenxClientOptions = {}) {
  const body = await request(`/jobs/${encodeURIComponent(providerJobId)}/result`, {}, options);
  return typeof body.result_url === "string" ? body.result_url : null;
}

export async function downloadGenxFile(providerJobId: string, options: GenxClientOptions = {}) {
  const config = configuration(options);
  const response = await config.fetcher(`${config.baseUrl}/api/v1/jobs/${encodeURIComponent(providerJobId)}/file`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  if (!response.ok) throw new Error(`GenX output download failed with status ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("GenX output is empty or exceeds the 20 MB managed storage limit.");
  return { bytes, contentType: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream" };
}

export async function getGenxCredits(options: GenxClientOptions = {}) {
  return request("/account/credits", {}, options);
}

export async function cancelGenxJob(providerJobId: string, options: GenxClientOptions = {}) {
  return request(`/jobs/${encodeURIComponent(providerJobId)}/cancel`, { method: "POST" }, options);
}
