import { describe, expect, it } from "vitest";
import { canAssignResidentToUnit } from "./unitAssignmentPolicy";

describe("unit resident-assignment policy", () => {
  it("accepts only an active resident membership", () => {
    expect(canAssignResidentToUnit({ role: "resident", status: "active" })).toBe(true);
  });

  it("rejects missing, suspended, invited, and non-resident memberships", () => {
    expect(canAssignResidentToUnit(null)).toBe(false);
    expect(canAssignResidentToUnit({ role: "resident", status: "invited" })).toBe(false);
    expect(canAssignResidentToUnit({ role: "resident", status: "suspended" })).toBe(false);
    expect(canAssignResidentToUnit({ role: "agent", status: "active" })).toBe(false);
  });
});
