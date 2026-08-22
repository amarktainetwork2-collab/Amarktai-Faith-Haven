import { describe, expect, it } from "vitest";
import { getInvitationAcceptanceError } from "./invitationPolicy";

describe("invitation acceptance policy", () => {
  const now = new Date("2026-08-22T10:00:00.000Z");

  it("accepts only a current invitation for the case-insensitive matching email", () => {
    expect(getInvitationAcceptanceError({ invitedEmail: "Resident@Example.com", acceptingEmail: "resident@example.com", acceptedAt: null, expiresAt: new Date("2026-08-23T10:00:00.000Z") }, now)).toBeNull();
  });

  it("rejects missing email, mismatched email, accepted links, and expired links", () => {
    expect(getInvitationAcceptanceError({ invitedEmail: "resident@example.com", acceptingEmail: null, acceptedAt: null, expiresAt: new Date("2026-08-23T10:00:00.000Z") }, now)).toContain("email address");
    expect(getInvitationAcceptanceError({ invitedEmail: "resident@example.com", acceptingEmail: "other@example.com", acceptedAt: null, expiresAt: new Date("2026-08-23T10:00:00.000Z") }, now)).toContain("different email");
    expect(getInvitationAcceptanceError({ invitedEmail: "resident@example.com", acceptingEmail: "resident@example.com", acceptedAt: now, expiresAt: new Date("2026-08-23T10:00:00.000Z") }, now)).toContain("unavailable");
    expect(getInvitationAcceptanceError({ invitedEmail: "resident@example.com", acceptingEmail: "resident@example.com", acceptedAt: null, expiresAt: now }, now)).toContain("unavailable");
  });
});
