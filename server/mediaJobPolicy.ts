export function getAvailableGenxCredits(credits: Record<string, unknown>) {
  if (typeof credits.credits === "number") return credits.credits;
  if (typeof credits.available_credits === "number") return credits.available_credits;
  return null;
}

export function canRetryGenxJob(status: string, retryCount: number) {
  return status === "failed" && retryCount >= 0 && retryCount < 2;
}

export function shouldPersistGenxOutput(status: string, outputStorageKey: string | null | undefined) {
  return status === "completed" && !outputStorageKey;
}
