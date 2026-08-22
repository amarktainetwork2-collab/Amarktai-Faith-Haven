import { describe, expect, it } from "vitest";
import { cancelGenxJob, createGenxJob, createGenxSession, downloadGenxFile, getGenxCredits, getGenxJob, getGenxResultUrl } from "./genx";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("GenX Router client", () => {
  it("submits documented asynchronous generation fields with an idempotency key", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await createGenxJob({ model: "grok-imagine", params: { prompt: "A restrained property exterior" }, metadata: { organisationId: "3" }, idempotencyKey: "idem-1" }, { apiKey: "test-key", baseUrl: "https://query.example", fetcher: async (url, init) => { calls.push({ url: String(url), init }); return response({ job_id: "job-7", status: "queued" }); } });
    expect(result).toEqual({ providerJobId: "job-7", status: "queued" });
    expect(calls[0]?.url).toBe("https://query.example/api/v1/generate");
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ model: "grok-imagine", idempotency_key: "idem-1" });
  });

  it("creates a documented GenX session without inventing a message or web-search payload", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await createGenxSession({ model: "claude-sonnet-4-6", systemPrompt: "Return attributable property research." }, { apiKey: "test-key", baseUrl: "https://query.example", fetcher: async (url, init) => { calls.push({ url: String(url), init }); return response({ session_id: "session-7" }); } });
    expect(result).toEqual({ sessionId: "session-7" });
    expect(calls[0]?.url).toBe("https://query.example/api/v1/sessions");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ model: "claude-sonnet-4-6", system_prompt: "Return attributable property research." });
  });

  it("normalises status, result, credits, and cancellation paths without exposing provider credentials", async () => {
    const paths: string[] = [];
    const fetcher: typeof fetch = async url => { paths.push(String(url)); if (String(url).endsWith("/result")) return response({ result_url: "https://output.example/file.png" }); if (String(url).endsWith("/credits")) return response({ credits: 42 }); if (String(url).endsWith("/cancel")) return response({ status: "cancelled" }); return response({ id: "job-9", status: "processing", result_url: "https://output.example/file.png", usage: { credits: 2 } }); };
    const options = { apiKey: "test-key", baseUrl: "https://query.example", fetcher };
    await expect(getGenxJob("job-9", options)).resolves.toMatchObject({ id: "job-9", status: "running", usage: { credits: 2 } });
    await expect(getGenxResultUrl("job-9", options)).resolves.toBe("https://output.example/file.png");
    await expect(getGenxCredits(options)).resolves.toMatchObject({ credits: 42 });
    await expect(cancelGenxJob("job-9", options)).resolves.toMatchObject({ status: "cancelled" });
    expect(paths).toEqual(["https://query.example/api/v1/jobs/job-9", "https://query.example/api/v1/jobs/job-9/result", "https://query.example/api/v1/account/credits", "https://query.example/api/v1/jobs/job-9/cancel"]);
  });

  it("downloads completed provider output through the documented file endpoint", async () => {
    const output = await downloadGenxFile("job-file", { apiKey: "test-key", baseUrl: "https://query.example", fetcher: async url => { expect(String(url)).toBe("https://query.example/api/v1/jobs/job-file/file"); return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } }); } });
    expect(output.contentType).toBe("image/png");
    expect([...output.bytes]).toEqual([1, 2, 3]);
  });
});
