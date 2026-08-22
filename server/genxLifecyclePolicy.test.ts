import { describe, expect, it } from "vitest";
import { getGenxLifecycleTransition } from "./genxLifecyclePolicy";

describe("GenX lifecycle policy", () => {
  it("keeps queued and running jobs non-terminal", () => {
    expect(getGenxLifecycleTransition({ currentStatus: "queued", providerStatus: "queued" })).toMatchObject({ status: "queued", completed: false, shouldPersistOutput: false });
    expect(getGenxLifecycleTransition({ currentStatus: "queued", providerStatus: "running" })).toMatchObject({ status: "running", completed: false, shouldPersistOutput: false });
  });

  it("persists completed output exactly once", () => {
    expect(getGenxLifecycleTransition({ currentStatus: "running", providerStatus: "completed" })).toMatchObject({ completed: true, shouldPersistOutput: true });
    expect(getGenxLifecycleTransition({ currentStatus: "completed", providerStatus: "completed", existingOutputStorageKey: "org/file.png" })).toMatchObject({ completed: true, shouldPersistOutput: false, preservesStoredOutput: true });
  });

  it("marks failed and cancelled provider outcomes terminal without output persistence", () => {
    expect(getGenxLifecycleTransition({ currentStatus: "running", providerStatus: "failed" })).toMatchObject({ completed: true, shouldPersistOutput: false });
    expect(getGenxLifecycleTransition({ currentStatus: "running", providerStatus: "cancelled" })).toMatchObject({ completed: true, shouldPersistOutput: false });
  });
});
