export type GenxLifecycleStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export function getGenxLifecycleTransition(input: { currentStatus: GenxLifecycleStatus; providerStatus: GenxLifecycleStatus; existingOutputStorageKey?: string | null }) {
  const terminal = ["completed", "failed", "cancelled"].includes(input.providerStatus);
  return {
    status: input.providerStatus,
    completed: terminal,
    shouldPersistOutput: input.providerStatus === "completed" && !input.existingOutputStorageKey,
    preservesStoredOutput: Boolean(input.existingOutputStorageKey),
  };
}
