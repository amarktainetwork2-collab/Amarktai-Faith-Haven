import { describe, expect, it } from "vitest";
import { BILLING_MANAGEMENT_ROLES, BUILDING_MANAGEMENT_ROLES, PORTAL_MANAGEMENT_ROLES, SALES_MANAGEMENT_ROLES, TASK_MANAGEMENT_ROLES, canManage, isControlledShareAvailable, isRoleAllowed, type PlatformRole } from "./platform";

describe("platform role policy", () => {
  it("allows operational roles to manage organisation work", () => {
    const managingRoles: PlatformRole[] = ["owner", "agency_admin", "agent", "building_manager", "operations"];
    managingRoles.forEach(role => expect(canManage(role)).toBe(true));
  });

  it("keeps analyst and resident roles out of management actions", () => {
    expect(canManage("analyst")).toBe(false);
    expect(canManage("resident")).toBe(false);
  });

  it("separates sales, building, task, and billing permissions by active membership role", () => {
    expect(isRoleAllowed("agent", SALES_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("building_manager", SALES_MANAGEMENT_ROLES)).toBe(false);
    expect(isRoleAllowed("building_manager", BUILDING_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("agent", BUILDING_MANAGEMENT_ROLES)).toBe(false);
    expect(isRoleAllowed("agent", TASK_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("building_manager", TASK_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("agency_admin", BILLING_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("operations", BILLING_MANAGEMENT_ROLES)).toBe(false);
    expect(isRoleAllowed("owner", PORTAL_MANAGEMENT_ROLES)).toBe(true);
    expect(isRoleAllowed("agent", PORTAL_MANAGEMENT_ROLES)).toBe(false);
  });

  it("never grants restricted roles write access through management policies", () => {
    const restrictedRoles: PlatformRole[] = ["analyst", "resident"];
    const policies = [SALES_MANAGEMENT_ROLES, BUILDING_MANAGEMENT_ROLES, TASK_MANAGEMENT_ROLES, BILLING_MANAGEMENT_ROLES];
    restrictedRoles.forEach(role => policies.forEach(policy => expect(isRoleAllowed(role, policy)).toBe(false)));
  });

  it("rejects revoked and expired controlled shares before property data can be read", () => {
    const now = new Date("2026-08-22T10:00:00.000Z");
    expect(isControlledShareAvailable({ revokedAt: null, expiresAt: new Date("2026-08-23T10:00:00.000Z") }, now)).toBe(true);
    expect(isControlledShareAvailable({ revokedAt: new Date("2026-08-21T10:00:00.000Z"), expiresAt: null }, now)).toBe(false);
    expect(isControlledShareAvailable({ revokedAt: null, expiresAt: new Date("2026-08-22T10:00:00.000Z") }, now)).toBe(false);
  });
});
