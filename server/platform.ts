import { and, desc, eq, inArray } from "drizzle-orm";
import {
  auditEvents,
  buildings,
  documents,
  geoReports,
  leads,
  levyEntries,
  maintenanceTickets,
  mediaJobs,
  notices,
  organisationMembers,
  organisations,
  properties,
  propertyShares,
  tasks,
  units,
  viewings,
} from "../drizzle/schema";
import { getDb } from "./db";
import { scopeResidentRecords } from "./residentScope";

export type PlatformRole = "owner" | "agency_admin" | "agent" | "building_manager" | "operations" | "analyst" | "resident";

export const SALES_MANAGEMENT_ROLES: PlatformRole[] = ["owner", "agency_admin", "agent", "operations"];
export const BUILDING_MANAGEMENT_ROLES: PlatformRole[] = ["owner", "agency_admin", "building_manager", "operations"];
export const TASK_MANAGEMENT_ROLES: PlatformRole[] = ["owner", "agency_admin", "agent", "building_manager", "operations"];
export const BILLING_MANAGEMENT_ROLES: PlatformRole[] = ["owner", "agency_admin"];
export const PORTAL_MANAGEMENT_ROLES: PlatformRole[] = ["owner", "agency_admin"];

export function isControlledShareAvailable(share: { revokedAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  return !share.revokedAt && (!share.expiresAt || share.expiresAt > now);
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "amarktai";
}

export async function getOrCreateOrganisation(user: { id: number; name?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const member = await db.select().from(organisationMembers).where(and(eq(organisationMembers.userId, user.id), eq(organisationMembers.status, "active"))).limit(1);
  if (member[0]) return member[0].organisationId;

  const baseSlug = `${slugify(user.name || "amarktai")}-${user.id}`;
  const organisation = await db.insert(organisations).values({
    name: user.name ? `${user.name}'s agency` : "Amarktai Property workspace",
    slug: baseSlug,
    createdByUserId: user.id,
  }).$returningId();
  const organisationId = organisation[0]!.id;
  await db.insert(organisationMembers).values({ organisationId, userId: user.id, role: "owner" });
  return organisationId;
}

export async function getMemberRole(userId: number, organisationId: number): Promise<PlatformRole> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const member = await db.select({ role: organisationMembers.role }).from(organisationMembers).where(and(eq(organisationMembers.userId, userId), eq(organisationMembers.organisationId, organisationId), eq(organisationMembers.status, "active"))).limit(1);
  if (!member[0]) throw new Error("No active membership for this organisation");
  return member[0].role as PlatformRole;
}

export async function requireOrganisationRole(userId: number, organisationId: number, allowedRoles: PlatformRole[], action: string) {
  const role = await getMemberRole(userId, organisationId);
  if (!isRoleAllowed(role, allowedRoles)) {
    throw new Error(`You do not have permission to ${action} in this organisation`);
  }
  return role;
}

export function isRoleAllowed(role: PlatformRole, allowedRoles: PlatformRole[]) {
  return allowedRoles.includes(role);
}

export async function getActiveOrganisationId(user: { id: number; name?: string | null }, requestedOrganisationId?: number) {
  if (!requestedOrganisationId) return getOrCreateOrganisation(user);
  await getMemberRole(user.id, requestedOrganisationId);
  return requestedOrganisationId;
}

export function canManage(role: PlatformRole) {
  return ["owner", "agency_admin", "agent", "building_manager", "operations"].includes(role);
}

export function canManageSales(role: PlatformRole) {
  return SALES_MANAGEMENT_ROLES.includes(role);
}

export function canManageBuildings(role: PlatformRole) {
  return BUILDING_MANAGEMENT_ROLES.includes(role);
}

export async function writeAudit(input: { organisationId?: number; actorUserId?: number; action: string; entityType: string; entityId?: string | number; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({
    organisationId: input.organisationId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ? String(input.entityId) : undefined,
    metadata: input.metadata,
  });
}

export async function getOrganisationMemberships(user: { id: number; name?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await getOrCreateOrganisation(user);
  return db.select({ organisationId: organisations.id, name: organisations.name, slug: organisations.slug, plan: organisations.plan, role: organisationMembers.role })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisationMembers.organisationId, organisations.id))
    .where(and(eq(organisationMembers.userId, user.id), eq(organisationMembers.status, "active")));
}

export async function getDashboardSnapshot(user: { id: number; name?: string | null }, requestedOrganisationId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const organisationId = requestedOrganisationId ?? await getOrCreateOrganisation(user);
  const role = await getMemberRole(user.id, organisationId);
  const [propertyRows, leadRows, taskRows, buildingRows, ticketRows, jobRows, viewingRows, noticeRows, documentRows, levyEntryRows] = await Promise.all([
    db.select().from(properties).where(eq(properties.organisationId, organisationId)).orderBy(desc(properties.updatedAt)).limit(8),
    db.select().from(leads).where(eq(leads.organisationId, organisationId)).orderBy(desc(leads.updatedAt)).limit(8),
    db.select().from(tasks).where(and(eq(tasks.organisationId, organisationId), inArray(tasks.status, ["open", "in_progress"]))).orderBy(desc(tasks.createdAt)).limit(8),
    db.select().from(buildings).where(eq(buildings.organisationId, organisationId)).limit(8),
    db.select().from(maintenanceTickets).where(eq(maintenanceTickets.organisationId, organisationId)).orderBy(desc(maintenanceTickets.updatedAt)).limit(8),
    db.select().from(mediaJobs).where(eq(mediaJobs.organisationId, organisationId)).orderBy(desc(mediaJobs.createdAt)).limit(8),
    db.select().from(viewings).where(eq(viewings.organisationId, organisationId)).orderBy(desc(viewings.scheduledAt)).limit(8),
    db.select().from(notices).where(role === "resident" ? and(eq(notices.organisationId, organisationId), inArray(notices.audience, ["all", "residents"])) : eq(notices.organisationId, organisationId)).orderBy(desc(notices.createdAt)).limit(8),
    db.select().from(documents).where(role === "resident" ? and(eq(documents.organisationId, organisationId), inArray(documents.visibility, ["residents", "public"])) : eq(documents.organisationId, organisationId)).orderBy(desc(documents.createdAt)).limit(8),
    db.select().from(levyEntries).where(eq(levyEntries.organisationId, organisationId)).orderBy(desc(levyEntries.occurredAt)).limit(8),
  ]);
  const unitRows = await getBuildingUnits(buildingRows.map(building => building.id));
  if (role === "resident") {
    const scoped = scopeResidentRecords({ userId: user.id, buildings: buildingRows, units: unitRows, tickets: ticketRows, levyEntries: levyEntryRows, notices: noticeRows, documents: documentRows });
    return {
      organisationId,
      role,
      properties: [],
      leads: [],
      tasks: [],
      buildings: scoped.buildings,
      units: scoped.units,
      tickets: scoped.tickets,
      mediaJobs: [],
      viewings: [],
      notices: scoped.notices,
      documents: scoped.documents,
      levyEntries: scoped.levyEntries,
    };
  }
  return { organisationId, role, properties: propertyRows, leads: leadRows, tasks: taskRows, buildings: buildingRows, units: unitRows, tickets: ticketRows, mediaJobs: jobRows, viewings: viewingRows, notices: noticeRows, documents: documentRows, levyEntries: levyEntryRows };
}

export async function getPropertyForOrganisation(propertyId: number, organisationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const property = await db.select().from(properties).where(and(eq(properties.id, propertyId), eq(properties.organisationId, organisationId))).limit(1);
  if (!property[0]) throw new Error("Property not found");
  return property[0];
}

export async function getReportSnapshot(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const report = await db.select().from(geoReports).where(eq(geoReports.propertyId, propertyId)).orderBy(desc(geoReports.generatedAt)).limit(1);
  return report[0] ?? null;
}

export async function getPublicShare(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const share = await db.select().from(propertyShares).where(eq(propertyShares.token, token)).limit(1);
  if (!share[0] || !isControlledShareAvailable(share[0])) return null;
  const property = await db.select().from(properties).where(eq(properties.id, share[0].propertyId)).limit(1);
  if (!property[0]) return null;
  return { share: share[0], property: property[0], report: await getReportSnapshot(property[0].id) };
}

export async function getBuildingUnits(buildingIds: number[]) {
  const db = await getDb();
  if (!db || buildingIds.length === 0) return [];
  return db.select().from(units).where(inArray(units.buildingId, buildingIds));
}
