import { describe, expect, it } from "vitest";
import { canRetryGenxJob, getAvailableGenxCredits, shouldPersistGenxOutput } from "./mediaJobPolicy";

describe("GenX media-job policy", () => {
  it("recognises documented credit-balance field variants and preserves unknown provider shapes", () => {
    expect(getAvailableGenxCredits({ credits: 12 })).toBe(12);
    expect(getAvailableGenxCredits({ available_credits: 4 })).toBe(4);
    expect(getAvailableGenxCredits({ balance: "unknown" })).toBeNull();
  });

  it("enforces the retry cap and allows retries only from failed jobs", () => {
    expect(canRetryGenxJob("failed", 0)).toBe(true);
    expect(canRetryGenxJob("failed", 1)).toBe(true);
    expect(canRetryGenxJob("failed", 2)).toBe(false);
    expect(canRetryGenxJob("running", 0)).toBe(false);
  });

  it("persists a completed provider output once and never duplicates an existing stored record", () => {
    expect(shouldPersistGenxOutput("completed", null)).toBe(true);
    expect(shouldPersistGenxOutput("completed", "organisations/1/media/file.png")).toBe(false);
    expect(shouldPersistGenxOutput("running", null)).toBe(false);
  });
});
