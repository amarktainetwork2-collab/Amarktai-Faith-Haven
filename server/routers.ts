import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auditEvents, buildings, documents, geoReports, geoSourceRuns, leads, levyEntries, maintenanceTickets, mediaJobs, notices, orders, organisationInvitations, organisationMembers, portalAdapters, portalExports, properties, propertyMedia, propertyShares, researchCreditLedger, researchJobs, tasks, units, users, viewings } from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { BILLING_MANAGEMENT_ROLES, BUILDING_MANAGEMENT_ROLES, PORTAL_MANAGEMENT_ROLES, SALES_MANAGEMENT_ROLES, TASK_MANAGEMENT_ROLES, getActiveOrganisationId, getDashboardSnapshot, getMemberRole, getOrganisationMemberships, getOrCreateOrganisation, getPropertyForOrganisation, getPublicShare, getReportSnapshot, requireOrganisationRole, type PlatformRole, writeAudit } from "./platform";
import { buildPayfastCheckout } from "./integrations/payfast";
import { getGenxState, getLicensedAmenityState, getPayfastState } from "./integrations/runtime";
import { storagePut } from "./storage";
import { REPORT_SOURCE_SUMMARY, createInitialBuyerReportSnapshot } from "./report";
import { getInvitationAcceptanceError } from "./invitationPolicy";
import { canAssignResidentToUnit } from "./unitAssignmentPolicy";
import { cancelGenxJob, createGenxJob, downloadGenxFile, getGenxCredits, getGenxJob, getGenxResultUrl } from "./integrations/genx";
import { canRetryGenxJob, getAvailableGenxCredits, shouldPersistGenxOutput } from "./mediaJobPolicy";
import { getGenxLifecycleTransition } from "./genxLifecyclePolicy";
import { RESEARCH_CREDIT_PACK, getResearchCreditBalance } from "./researchCreditPolicy";
import { getResearchProvenanceError } from "./researchProvenancePolicy";
import { buildCrimeReportEvidence } from "./reportEvidencePolicy";
import { fetchPublicAmenities } from "./integrations/publicAmenities";
import { fetchLicensedAmenities } from "./integrations/licensedAmenities";

const propertyInput = z.object({
  title: z.string().min(3).max(220), addressLine: z.string().min(3).max(255), suburb: z.string().max(120).optional(), city: z.string().max(120).optional(), province: z.string().max(120).optional(),
  priceZar: z.number().nonnegative().optional(), bedrooms: z.number().int().min(0).max(99).default(0), bathrooms: z.number().min(0).max(99).default(0), parking: z.number().int().min(0).max(99).default(0), floorAreaSqm: z.number().int().positive().optional(),
  propertyType: z.enum(["house", "apartment", "townhouse", "estate", "commercial", "land"]).default("house"), description: z.string().max(5000).optional(), features: z.array(z.string().max(80)).max(40).default([]),
});

const propertyUpdateInput = z.object({
  propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(),
  title: z.string().min(3).max(220).optional(), addressLine: z.string().min(3).max(255).optional(), suburb: z.string().max(120).optional(), city: z.string().max(120).optional(), province: z.string().max(120).optional(),
  priceZar: z.number().nonnegative().optional(), bedrooms: z.number().int().min(0).max(99).optional(), bathrooms: z.number().min(0).max(99).optional(), parking: z.number().int().min(0).max(99).optional(), floorAreaSqm: z.number().int().positive().optional(),
  propertyType: z.enum(["house", "apartment", "townhouse", "estate", "commercial", "land"]).optional(), description: z.string().max(5000).optional(), features: z.array(z.string().max(80)).max(40).optional(),
  listingStatus: z.enum(["draft", "review", "live", "under_offer", "sold", "archived"]).optional(),
});

function secureError(error: unknown): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to complete the request" });
}

async function getAuthorisedOrganisationId(
  user: { id: number; name?: string | null },
  requestedOrganisationId: number | undefined,
  allowedRoles: PlatformRole[],
  action: string,
) {
  const organisationId = await getActiveOrganisationId(user, requestedOrganisationId);
  await requireOrganisationRole(user.id, organisationId, allowedRoles, action);
  return organisationId;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  platform: router({
    snapshot: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => getDashboardSnapshot(ctx.user, input?.organisationId)),
    organisations: protectedProcedure.query(async ({ ctx }) => getOrganisationMemberships(ctx.user)),
    members: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BUILDING_MANAGEMENT_ROLES, "view organisation members"); return db.select({ userId: organisationMembers.userId, name: users.name, email: users.email, role: organisationMembers.role }).from(organisationMembers).innerJoin(users, eq(users.id, organisationMembers.userId)).where(and(eq(organisationMembers.organisationId, organisationId), eq(organisationMembers.status, "active"))).orderBy(asc(users.name)); } catch (error) { return secureError(error); }
    }),
    integrations: protectedProcedure.query(() => ({ genx: getGenxState(), payfast: getPayfastState(), licensedAmenity: getLicensedAmenityState() })),
    audit: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(50).default(15) })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, ["owner", "agency_admin", "operations"], "view operational audit records"); return db.select({ id: auditEvents.id, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, metadata: auditEvents.metadata, createdAt: auditEvents.createdAt }).from(auditEvents).where(eq(auditEvents.organisationId, organisationId)).orderBy(desc(auditEvents.createdAt)).limit(input.limit); } catch (error) { return secureError(error); }
    }),
    sourceRuns: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(30).default(12) })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await getAuthorisedOrganisationId(ctx.user, input.organisationId, ["owner", "agency_admin", "operations", "analyst"], "view source refresh records"); return db.select().from(geoSourceRuns).orderBy(desc(geoSourceRuns.createdAt)).limit(input.limit); } catch (error) { return secureError(error); }
    }),
    invite: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), email: z.string().email(), role: z.enum(["agency_admin", "agent", "building_manager", "operations", "analyst", "resident"]) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getActiveOrganisationId(ctx.user, input.organisationId); const actorRole = await getMemberRole(ctx.user.id, organisationId); if (!( ["owner", "agency_admin"] as PlatformRole[]).includes(actorRole)) throw new Error("Only an owner or agency administrator can invite members"); const token = nanoid(40); const expiresAt = new Date(Date.now() + 7 * 86400000); const row = await db.insert(organisationInvitations).values({ organisationId, email: input.email.toLowerCase(), role: input.role, token, expiresAt, invitedByUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "organisation.invitation_created", entityType: "organisation_invitation", entityId: row[0]!.id, metadata: { role: input.role } }); return { id: row[0]!.id, token, expiresAt }; } catch (error) { return secureError(error); }
    }),
    acceptInvite: protectedProcedure.input(z.object({ token: z.string().min(20).max(96) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const invitation = await db.select().from(organisationInvitations).where(eq(organisationInvitations.token, input.token)).limit(1); const row = invitation[0]; if (!row) throw new Error("This invitation is unavailable"); const acceptanceError = getInvitationAcceptanceError({ invitedEmail: row.email, acceptingEmail: ctx.user.email, acceptedAt: row.acceptedAt, expiresAt: row.expiresAt }); if (acceptanceError) throw new Error(acceptanceError); const accepted = await db.update(organisationInvitations).set({ acceptedAt: new Date() }).where(and(eq(organisationInvitations.id, row.id), isNull(organisationInvitations.acceptedAt))); if (!accepted[0].affectedRows) throw new Error("This invitation has already been accepted"); await db.insert(organisationMembers).values({ organisationId: row.organisationId, userId: ctx.user.id, role: row.role, status: "active" }).onDuplicateKeyUpdate({ set: { role: row.role, status: "active" } }); await writeAudit({ organisationId: row.organisationId, actorUserId: ctx.user.id, action: "organisation.invitation_accepted", entityType: "organisation_invitation", entityId: row.id, metadata: { role: row.role } }); return { organisationId: row.organisationId, role: row.role }; } catch (error) { return secureError(error); }
    }),
  }),
  property: router({
    create: protectedProcedure.input(propertyInput.extend({ organisationId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const { organisationId: requestedOrganisationId, ...propertyInputData } = input;
        const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, SALES_MANAGEMENT_ROLES, "manage property listings");
        const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "property"}-${nanoid(6).toLowerCase()}`;
        const result = await db.insert(properties).values({ ...propertyInputData, organisationId, agentUserId: ctx.user.id, slug, priceZar: input.priceZar?.toFixed(2), bathrooms: input.bathrooms.toFixed(1) }).$returningId();
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.created", entityType: "property", entityId: result[0]!.id });
        return { id: result[0]!.id, slug };
      } catch (error) { return secureError(error); }
    }),
    update: protectedProcedure.input(propertyUpdateInput).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const { propertyId, organisationId: requestedOrganisationId, listingStatus, ...changes } = input;
        const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, SALES_MANAGEMENT_ROLES, "manage property listings");
        const property = await getPropertyForOrganisation(propertyId, organisationId);
        const updateValues = { ...changes, priceZar: changes.priceZar === undefined ? undefined : changes.priceZar.toFixed(2), bathrooms: changes.bathrooms === undefined ? undefined : changes.bathrooms.toFixed(1), ...(listingStatus ? { listingStatus, ...(listingStatus === "live" && !property.publishedAt ? { publishedAt: new Date() } : {}) } : {}) };
        await db.update(properties).set(updateValues).where(and(eq(properties.id, propertyId), eq(properties.organisationId, organisationId)));
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.updated", entityType: "property", entityId: propertyId, metadata: { listingStatus } });
        return { success: true };
      } catch (error) { return secureError(error); }
    }),
    report: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const organisationId = await getActiveOrganisationId(ctx.user, input.organisationId); await getPropertyForOrganisation(input.propertyId, organisationId);
      return getReportSnapshot(input.propertyId);
    }),
    createShare: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), permission: z.enum(["property", "report"]), expiresInDays: z.number().int().min(1).max(90).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "manage controlled shares"); await getPropertyForOrganisation(input.propertyId, organisationId);
        const token = nanoid(32); const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400000) : undefined;
        await db.insert(propertyShares).values({ propertyId: input.propertyId, token, permission: input.permission, expiresAt, createdByUserId: ctx.user.id });
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.share_created", entityType: "property", entityId: input.propertyId, metadata: { permission: input.permission } });
        return { token, expiresAt };
      } catch (error) { return secureError(error); }
    }),
    shares: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "view controlled shares"); await getPropertyForOrganisation(input.propertyId, organisationId); return db.select().from(propertyShares).where(eq(propertyShares.propertyId, input.propertyId)); } catch (error) { return secureError(error); }
    }),
    revokeShare: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), shareId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "manage controlled shares"); await getPropertyForOrganisation(input.propertyId, organisationId); const result = await db.update(propertyShares).set({ revokedAt: new Date() }).where(and(eq(propertyShares.id, input.shareId), eq(propertyShares.propertyId, input.propertyId))); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.share_revoked", entityType: "property_share", entityId: input.shareId }); return { success: Boolean(result[0].affectedRows) }; } catch (error) { return secureError(error); }
    }),
    uploadMedia: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), fileName: z.string().min(1).max(160), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(1).max(7_000_000), altText: z.string().max(280).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "upload property media"); await getPropertyForOrganisation(input.propertyId, organisationId);
        const data = Buffer.from(input.base64, "base64"); if (!data.length || data.length > 5 * 1024 * 1024) throw new Error("Images must be no larger than 5 MB.");
        const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
        const safeStem = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "property-media";
        const uploaded = await storagePut(`organisations/${organisationId}/properties/${input.propertyId}/${safeStem}.${extension}`, data, input.mimeType);
        const row = await db.insert(propertyMedia).values({ propertyId: input.propertyId, storageKey: uploaded.key, url: uploaded.url, altText: input.altText, mediaType: "image" }).$returningId();
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.media_uploaded", entityType: "property_media", entityId: row[0]!.id, metadata: { propertyId: input.propertyId, mimeType: input.mimeType } });
        return { id: row[0]!.id, url: uploaded.url };
      } catch (error) { return secureError(error); }
    }),
    media: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "view property media"); await getPropertyForOrganisation(input.propertyId, organisationId); return db.select().from(propertyMedia).where(eq(propertyMedia.propertyId, input.propertyId)).orderBy(asc(propertyMedia.position), asc(propertyMedia.createdAt)); } catch (error) { return secureError(error); }
    }),
    updateMedia: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), mediaId: z.number().int().positive(), altText: z.string().max(280).nullable().optional(), mediaType: z.enum(["image", "video", "floorplan", "document"]).optional(), position: z.number().int().min(0).max(999).optional() }).refine(input => input.altText !== undefined || input.mediaType !== undefined || input.position !== undefined, { message: "At least one media field is required" })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "manage property media"); await getPropertyForOrganisation(input.propertyId, organisationId); const media = await db.select().from(propertyMedia).where(and(eq(propertyMedia.id, input.mediaId), eq(propertyMedia.propertyId, input.propertyId))).limit(1); if (!media[0]) throw new Error("Media item not found"); const { propertyId: _propertyId, organisationId: _organisationId, mediaId, ...changes } = input; await db.update(propertyMedia).set(changes).where(eq(propertyMedia.id, mediaId)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "property.media_updated", entityType: "property_media", entityId: mediaId }); return { success: true }; } catch (error) { return secureError(error); }
    }),
    createReport: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "generate buyer reports"); const property = await getPropertyForOrganisation(input.propertyId, organisationId);
        const snapshot = createInitialBuyerReportSnapshot(property);
        await db.insert(geoReports).values({ propertyId: input.propertyId, snapshot, sourceSummary: REPORT_SOURCE_SUMMARY });
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "report.generated", entityType: "property", entityId: input.propertyId }); return snapshot;
      } catch (error) { return secureError(error); }
    }),
    portalAdapters: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "view portal adapters"); return db.select().from(portalAdapters).where(eq(portalAdapters.organisationId, organisationId)).orderBy(asc(portalAdapters.displayName)); } catch (error) { return secureError(error); }
    }),
    createPortalAdapter: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), portalKey: z.string().min(2).max(100).regex(/^[a-z0-9_-]+$/), displayName: z.string().min(2).max(160), status: z.enum(["draft", "approved", "disabled"]), approvalReference: z.string().max(255).optional() }).refine(input => input.status !== "approved" || Boolean(input.approvalReference?.trim()), { message: "An approval reference is required before an adapter can be marked approved" })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...adapter } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, PORTAL_MANAGEMENT_ROLES, "manage portal adapters"); const row = await db.insert(portalAdapters).values({ ...adapter, approvalReference: adapter.approvalReference?.trim() || null, organisationId, configuredByUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "portal.adapter_created", entityType: "portal_adapter", entityId: row[0]!.id, metadata: { portalKey: adapter.portalKey, status: adapter.status } }); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    export: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), portalKey: z.string().min(2).max(100) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "prepare portal exports"); const property = await getPropertyForOrganisation(input.propertyId, organisationId); const adapter = await db.select().from(portalAdapters).where(and(eq(portalAdapters.organisationId, organisationId), eq(portalAdapters.portalKey, input.portalKey), eq(portalAdapters.status, "approved"))).limit(1); if (!adapter[0]) throw new Error("An approved portal adapter is required before an export can be prepared"); const payload = { schema: "amarktai-property-export/v1", generatedAt: new Date().toISOString(), property };
        const row = await db.insert(portalExports).values({ organisationId, propertyId: property.id, portalKey: input.portalKey, payload, createdByUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "portal.export_created", entityType: "property", entityId: property.id, metadata: { portalKey: input.portalKey } }); return { exportId: row[0]!.id, payload }; } catch (error) { return secureError(error); }
    }),
  }),
  amenity: router({
    sources: protectedProcedure.query(() => ({
      public: { key: "public_osm", label: "Public mapped amenities", ready: true, detail: "A user-triggered, cached South African amenity lookup with visible OpenStreetMap provenance." },
      licensed: { key: "licensed_provider", label: "Licensed data provider", ready: getLicensedAmenityState().configured, detail: getLicensedAmenityState().configured ? "Provider contract is configured for deployment review." : "Visible now; activation needs a licensed provider name, endpoint, secret, field mapping, and terms at deployment." },
    })),
    refresh: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), propertyId: z.number().int().positive(), sourcePath: z.enum(["public_osm", "licensed_provider"]) })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "refresh buyer-intelligence amenity data");
        const property = await getPropertyForOrganisation(input.propertyId, organisationId);
        if (input.sourcePath === "licensed_provider") {
          const licensed = getLicensedAmenityState();
          if (!licensed.configured) throw new Error("The licensed provider option is selected but remains unavailable until its deployment-only provider contract is configured.");
          return await fetchLicensedAmenities({ provider: process.env.LICENSED_AMENITY_PROVIDER!, propertyId: property.id });
        }
        const previous = await getReportSnapshot(property.id);
        const priorSnapshot = previous?.snapshot as Record<string, unknown> | undefined;
        if (previous?.validUntil && previous.validUntil > new Date() && priorSnapshot?.amenitySourcePath === "public_osm") {
          return { sourcePath: "public_osm" as const, cached: true, amenityCount: Array.isArray(priorSnapshot.amenities) ? priorSnapshot.amenities.length : 0, validUntil: previous.validUntil };
        }
        const address = [property.addressLine, property.suburb, property.city, property.province, "South Africa"].filter(Boolean).join(", ");
        const result = await fetchPublicAmenities({ address, latitude: property.latitude, longitude: property.longitude });
        const snapshot = { ...createInitialBuyerReportSnapshot(property), amenities: result.amenities.map(item => ({ type: item.type, detail: item.name, latitude: item.latitude, longitude: item.longitude })), amenitySourcePath: "public_osm", amenityProvenance: { label: "OpenStreetMap public services", urls: result.sourceUrls, retrievedAt: result.retrievedAt, coverage: result.coverage, attribution: "© OpenStreetMap contributors" } };
        const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.update(properties).set({ latitude: result.coordinates.latitude.toFixed(7), longitude: result.coordinates.longitude.toFixed(7) }).where(eq(properties.id, property.id));
        await db.insert(geoReports).values({ propertyId: property.id, snapshot, sourceSummary: `OpenStreetMap public amenity lookup · ${result.amenities.length} places · retrieved ${result.retrievedAt.slice(0, 10)}`, validUntil });
        await db.insert(geoSourceRuns).values({ sourceKey: "public_osm_amenities", status: "ready", sourceVersion: "nominatim-overpass", recordCount: result.amenities.length, sourceUrl: "https://nominatim.openstreetmap.org/; https://overpass-api.de/", completedAt: new Date() });
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "amenity.public_refreshed", entityType: "property", entityId: property.id, metadata: { sourcePath: "public_osm", amenityCount: result.amenities.length, coverage: result.coverage, validUntil: validUntil.toISOString() } });
        return { sourcePath: "public_osm" as const, cached: false, amenityCount: result.amenities.length, validUntil };
      } catch (error) { return secureError(error); }
    }),
  }),
  lead: router({
    create: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), name: z.string().min(2).max(160), email: z.string().email().optional(), phone: z.string().max(40).optional(), propertyId: z.number().int().positive().optional(), notes: z.string().max(3000).optional() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...leadInput } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, SALES_MANAGEMENT_ROLES, "manage leads"); if (leadInput.propertyId) await getPropertyForOrganisation(leadInput.propertyId, organisationId); const row = await db.insert(leads).values({ ...leadInput, organisationId, assignedUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "lead.created", entityType: "lead", entityId: row[0]!.id }); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    scheduleViewing: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), propertyId: z.number().int().positive(), leadId: z.number().int().positive().optional(), scheduledAt: z.date(), notes: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "schedule viewings"); await getPropertyForOrganisation(input.propertyId, organisationId); if (input.leadId) { const lead = await db.select().from(leads).where(and(eq(leads.id, input.leadId), eq(leads.organisationId, organisationId))).limit(1); if (!lead[0]) throw new Error("Lead not found"); } const row = await db.insert(viewings).values({ organisationId, propertyId: input.propertyId, leadId: input.leadId, agentUserId: ctx.user.id, scheduledAt: input.scheduledAt, notes: input.notes }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "viewing.scheduled", entityType: "viewing", entityId: row[0]!.id, metadata: { propertyId: input.propertyId, leadId: input.leadId } }); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    updateStage: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), leadId: z.number().int().positive(), stage: z.enum(["new", "contacted", "viewing", "offer", "won", "lost"]) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "manage leads"); const lead = await db.select().from(leads).where(and(eq(leads.id, input.leadId), eq(leads.organisationId, organisationId))).limit(1); if (!lead[0]) throw new Error("Lead not found"); await db.update(leads).set({ stage: input.stage, ...(input.stage === "contacted" ? { lastContactedAt: new Date() } : {}) }).where(eq(leads.id, input.leadId)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "lead.stage_updated", entityType: "lead", entityId: input.leadId, metadata: { stage: input.stage } }); return { success: true }; } catch (error) { return secureError(error); }
    }),
    updateNotes: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), leadId: z.number().int().positive(), notes: z.string().max(3000) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "manage leads"); const lead = await db.select().from(leads).where(and(eq(leads.id, input.leadId), eq(leads.organisationId, organisationId))).limit(1); if (!lead[0]) throw new Error("Lead not found"); await db.update(leads).set({ notes: input.notes || null }).where(eq(leads.id, input.leadId)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "lead.notes_updated", entityType: "lead", entityId: input.leadId }); return { success: true }; } catch (error) { return secureError(error); }
    }),
  }),
  operations: router({
    createTask: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), title: z.string().min(3).max(220), dueAt: z.date().optional(), priority: z.enum(["low", "medium", "high"]).default("medium"), propertyId: z.number().int().positive().optional(), buildingId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...taskInput } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, TASK_MANAGEMENT_ROLES, "manage tasks"); if (taskInput.propertyId) await getPropertyForOrganisation(taskInput.propertyId, organisationId); if (taskInput.buildingId) { const building = await db.select().from(buildings).where(and(eq(buildings.id, taskInput.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); } const row = await db.insert(tasks).values({ ...taskInput, organisationId, assignedUserId: ctx.user.id }).$returningId(); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    completeTask: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, TASK_MANAGEMENT_ROLES, "manage tasks"); const task = await db.select().from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.organisationId, organisationId))).limit(1); if (!task[0]) throw new Error("Task not found"); await db.update(tasks).set({ status: "completed", completedAt: new Date() }).where(eq(tasks.id, input.taskId)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "task.completed", entityType: "task", entityId: input.taskId }); return { success: true }; } catch (error) { return secureError(error); }
    }),
    createBuilding: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), name: z.string().min(3).max(180), addressLine: z.string().min(3).max(255), city: z.string().max(120).optional() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...buildingInput } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, BUILDING_MANAGEMENT_ROLES, "manage buildings"); const row = await db.insert(buildings).values({ ...buildingInput, organisationId, managerUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "building.created", entityType: "building", entityId: row[0]!.id }); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    createTicket: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), buildingId: z.number().int().positive(), title: z.string().min(3).max(220), description: z.string().max(3000).optional(), priority: z.enum(["low", "medium", "high", "urgent"]).default("medium") })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...ticketInput } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, BUILDING_MANAGEMENT_ROLES, "manage maintenance tickets"); const building = await db.select().from(buildings).where(and(eq(buildings.id, input.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); const row = await db.insert(maintenanceTickets).values({ ...ticketInput, organisationId, raisedByUserId: ctx.user.id, assignedUserId: ctx.user.id }).$returningId(); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    createUnit: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), buildingId: z.number().int().positive(), unitNumber: z.string().min(1).max(60) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BUILDING_MANAGEMENT_ROLES, "manage units"); const building = await db.select().from(buildings).where(and(eq(buildings.id, input.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); const row = await db.insert(units).values({ buildingId: input.buildingId, unitNumber: input.unitNumber }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "unit.created", entityType: "unit", entityId: row[0]!.id }); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
    assignUnitOccupant: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), unitId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BUILDING_MANAGEMENT_ROLES, "assign unit residents"); const unit = await db.select({ id: units.id }).from(units).innerJoin(buildings, eq(buildings.id, units.buildingId)).where(and(eq(units.id, input.unitId), eq(buildings.organisationId, organisationId))).limit(1); if (!unit[0]) throw new Error("Unit not found"); const member = await db.select().from(organisationMembers).where(and(eq(organisationMembers.organisationId, organisationId), eq(organisationMembers.userId, input.userId), eq(organisationMembers.status, "active"))).limit(1); if (!canAssignResidentToUnit(member[0])) throw new Error("Only an active resident member can be assigned to a unit"); await db.update(units).set({ residentUserId: input.userId }).where(eq(units.id, input.unitId)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "unit.resident_assigned", entityType: "unit", entityId: input.unitId, metadata: { userId: input.userId } }); return { success: true }; } catch (error) { return secureError(error); }
    }),
    createLevyEntry: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), buildingId: z.number().int().positive(), unitId: z.number().int().positive(), entryType: z.enum(["charge", "payment", "adjustment"]), amountZar: z.number().positive(), description: z.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BUILDING_MANAGEMENT_ROLES, "manage levy entries"); const building = await db.select().from(buildings).where(and(eq(buildings.id, input.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); const unit = await db.select().from(units).where(and(eq(units.id, input.unitId), eq(units.buildingId, input.buildingId))).limit(1); if (!unit[0]) throw new Error("Unit not found"); const row = await db.insert(levyEntries).values({ organisationId, buildingId: input.buildingId, unitId: input.unitId, entryType: input.entryType, amountZar: input.amountZar.toFixed(2), description: input.description, createdByUserId: ctx.user.id }); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "levy.entry_created", entityType: "levy_entry", metadata: { buildingId: input.buildingId, unitId: input.unitId, entryType: input.entryType } }); return { inserted: row[0].affectedRows }; } catch (error) { return secureError(error); }
    }),
    uploadDocument: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), buildingId: z.number().int().positive().optional(), propertyId: z.number().int().positive().optional(), title: z.string().min(2).max(220), visibility: z.enum(["internal", "owners", "residents", "public"]).default("internal"), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]), base64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BUILDING_MANAGEMENT_ROLES, "upload documents"); if (!input.buildingId && !input.propertyId) throw new Error("A building or property is required"); if (input.buildingId) { const building = await db.select().from(buildings).where(and(eq(buildings.id, input.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); } if (input.propertyId) await getPropertyForOrganisation(input.propertyId, organisationId); const body = Buffer.from(input.base64, "base64"); if (!body.length || body.length > 5 * 1024 * 1024) throw new Error("Documents must be no larger than 5 MB"); const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType.split("/")[1]; const safeTitle = input.title.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "document"; const stored = await storagePut(`organisations/${organisationId}/documents/${safeTitle}-${nanoid(8)}.${extension}`, body, input.mimeType); const row = await db.insert(documents).values({ organisationId, buildingId: input.buildingId, propertyId: input.propertyId, title: input.title, storageKey: stored.key, url: stored.url, visibility: input.visibility, uploadedByUserId: ctx.user.id }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "document.uploaded", entityType: "document", entityId: row[0]!.id, metadata: { buildingId: input.buildingId, propertyId: input.propertyId, visibility: input.visibility } }); return { id: row[0]!.id, url: stored.url }; } catch (error) { return secureError(error); }
    }),
    publishNotice: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), buildingId: z.number().int().positive(), title: z.string().min(3).max(220), body: z.string().min(3).max(5000), audience: z.enum(["all", "owners", "residents"]).default("all") })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { organisationId: requestedOrganisationId, ...noticeInput } = input; const organisationId = await getAuthorisedOrganisationId(ctx.user, requestedOrganisationId, BUILDING_MANAGEMENT_ROLES, "publish building notices"); const building = await db.select().from(buildings).where(and(eq(buildings.id, input.buildingId), eq(buildings.organisationId, organisationId))).limit(1); if (!building[0]) throw new Error("Building not found"); const row = await db.insert(notices).values({ ...noticeInput, organisationId, createdByUserId: ctx.user.id, publishedAt: new Date() }).$returningId(); return { id: row[0]!.id }; } catch (error) { return secureError(error); }
    }),
  }),
  media: router({
    credits: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "view GenX credits"); if (!getGenxState().configured) return { configured: false, credits: null as Record<string, unknown> | null }; return { configured: true, credits: await getGenxCredits() }; } catch (error) { return secureError(error); }
    }),
    request: protectedProcedure.input(z.object({ propertyId: z.number().int().positive(), organisationId: z.number().int().positive().optional(), templateKey: z.string().min(2).max(100), model: z.string().min(2).max(160), params: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "request media jobs"); const property = await getPropertyForOrganisation(input.propertyId, organisationId); if (!getGenxState().configured) throw new Error("GenX is unavailable until the deployment-only GENX_API_KEY is configured."); const credits = await getGenxCredits(); const availableCredits = getAvailableGenxCredits(credits); if (availableCredits !== null && availableCredits <= 0) throw new Error("GenX has no available credits for this request."); const idempotencyKey = `amp-${organisationId}-${nanoid(24)}`; const inputSnapshot = { propertyId: property.id, title: property.title, templateKey: input.templateKey, model: input.model, params: input.params }; const row = await db.insert(mediaJobs).values({ organisationId, propertyId: property.id, requestedByUserId: ctx.user.id, templateKey: input.templateKey, inputSnapshot, idempotencyKey }).$returningId(); try { const created = await createGenxJob({ model: input.model, params: input.params, metadata: { organisationId: String(organisationId), propertyId: String(property.id), mediaJobId: String(row[0]!.id), templateKey: input.templateKey }, idempotencyKey }); await db.update(mediaJobs).set({ providerJobId: created.providerJobId, status: created.status === "queued" ? "queued" : "running" }).where(eq(mediaJobs.id, row[0]!.id)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "media.job_submitted", entityType: "media_job", entityId: row[0]!.id, metadata: { provider: "genx", providerJobId: created.providerJobId, model: input.model } }); return { id: row[0]!.id, providerJobId: created.providerJobId, status: created.status }; } catch (dispatchError) { await db.update(mediaJobs).set({ status: "failed", errorMessage: dispatchError instanceof Error ? dispatchError.message : "Unable to submit GenX job" }).where(eq(mediaJobs.id, row[0]!.id)); throw dispatchError; } } catch (error) { return secureError(error); }
    }),
    sync: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), mediaJobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "refresh media jobs"); const job = await db.select().from(mediaJobs).where(and(eq(mediaJobs.id, input.mediaJobId), eq(mediaJobs.organisationId, organisationId))).limit(1); if (!job[0]?.providerJobId) throw new Error("This media job has not been submitted to GenX."); if (!getGenxState().configured) throw new Error("GenX is unavailable until the deployment-only GENX_API_KEY is configured."); const provider = await getGenxJob(job[0].providerJobId); const transition = getGenxLifecycleTransition({ currentStatus: job[0].status, providerStatus: provider.status, existingOutputStorageKey: job[0].outputStorageKey }); const providerResultUrl = transition.status === "completed" ? provider.resultUrl ?? await getGenxResultUrl(job[0].providerJobId) : undefined; let outputUrl = job[0].outputUrl ?? undefined; let outputStorageKey = job[0].outputStorageKey ?? undefined; if (transition.shouldPersistOutput && shouldPersistGenxOutput(provider.status, outputStorageKey)) { const output = await downloadGenxFile(job[0].providerJobId); const extension = output.contentType === "image/png" ? "png" : output.contentType === "image/jpeg" ? "jpg" : output.contentType === "video/mp4" ? "mp4" : "bin"; const stored = await storagePut(`organisations/${organisationId}/media/genx-${job[0].id}-${nanoid(8)}.${extension}`, output.bytes, output.contentType); outputUrl = stored.url; outputStorageKey = stored.key; } const costCredits = typeof provider.usage?.credits === "number" ? Math.max(0, Math.round(provider.usage.credits)) : job[0].costCredits; await db.update(mediaJobs).set({ status: transition.status, outputUrl: outputUrl ?? providerResultUrl, outputStorageKey, providerUsage: provider.usage, errorMessage: provider.errorMessage, costCredits, completedAt: transition.completed ? new Date() : null }).where(eq(mediaJobs.id, job[0].id)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "media.job_synced", entityType: "media_job", entityId: job[0].id, metadata: { status: transition.status, storedOutput: Boolean(outputStorageKey) } }); return { status: transition.status, outputUrl: outputUrl ?? providerResultUrl ?? null, errorMessage: provider.errorMessage ?? null }; } catch (error) { return secureError(error); }
    }),
    retry: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), mediaJobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "retry media jobs"); const job = await db.select().from(mediaJobs).where(and(eq(mediaJobs.id, input.mediaJobId), eq(mediaJobs.organisationId, organisationId))).limit(1); const current = job[0]; if (!current || !canRetryGenxJob(current.status, current.retryCount)) throw new Error("Only failed media jobs below the retry limit can be retried."); if (!getGenxState().configured) throw new Error("GenX is unavailable until the deployment-only GENX_API_KEY is configured."); const snapshot = current.inputSnapshot as { model?: unknown; params?: unknown; templateKey?: unknown }; if (typeof snapshot.model !== "string" || !snapshot.params || typeof snapshot.params !== "object") throw new Error("This media job does not have a valid documented GenX request snapshot."); const idempotencyKey = `amp-${organisationId}-${nanoid(24)}`; const created = await createGenxJob({ model: snapshot.model, params: snapshot.params as Record<string, unknown>, metadata: { organisationId: String(organisationId), mediaJobId: String(current.id), templateKey: String(snapshot.templateKey ?? current.templateKey) }, idempotencyKey }); await db.update(mediaJobs).set({ providerJobId: created.providerJobId, idempotencyKey, status: created.status === "queued" ? "queued" : "running", retryCount: current.retryCount + 1, errorMessage: null, outputUrl: null, outputStorageKey: null, completedAt: null }).where(eq(mediaJobs.id, current.id)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "media.job_retried", entityType: "media_job", entityId: current.id, metadata: { retryCount: current.retryCount + 1, providerJobId: created.providerJobId } }); return { status: created.status, providerJobId: created.providerJobId }; } catch (error) { return secureError(error); }
    }),
    cancel: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), mediaJobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "cancel media jobs"); const job = await db.select().from(mediaJobs).where(and(eq(mediaJobs.id, input.mediaJobId), eq(mediaJobs.organisationId, organisationId))).limit(1); if (!job[0]?.providerJobId) throw new Error("This media job has not been submitted to GenX."); if (!getGenxState().configured) throw new Error("GenX is unavailable until the deployment-only GENX_API_KEY is configured."); await cancelGenxJob(job[0].providerJobId); await db.update(mediaJobs).set({ status: "cancelled", completedAt: new Date() }).where(eq(mediaJobs.id, job[0].id)); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "media.job_cancelled", entityType: "media_job", entityId: job[0].id }); return { success: true }; } catch (error) { return secureError(error); }
    }),
  }),
  research: router({
    status: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "view buyer-intelligence research"); const [ledger, jobs] = await Promise.all([db.select({ credits: researchCreditLedger.credits }).from(researchCreditLedger).where(eq(researchCreditLedger.organisationId, organisationId)), db.select().from(researchJobs).where(eq(researchJobs.organisationId, organisationId)).orderBy(desc(researchJobs.createdAt)).limit(20)]); return { internalCredits: getResearchCreditBalance(ledger), providerConfigured: getGenxState().configured, providerSessionContractReady: false, jobs }; } catch (error) { return secureError(error); }
    }),
    request: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), propertyId: z.number().int().positive().optional(), researchType: z.enum(["amenities", "services", "crime", "market"]), locationLabel: z.string().min(3).max(255), question: z.string().min(8).max(1800) })).mutation(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "request buyer-intelligence research"); if (input.propertyId) await getPropertyForOrganisation(input.propertyId, organisationId); const ledger = await db.select({ credits: researchCreditLedger.credits }).from(researchCreditLedger).where(eq(researchCreditLedger.organisationId, organisationId)); const balance = getResearchCreditBalance(ledger); if (balance < 1) throw new Error("Your organisation needs a research-credit top-up before a research request can be queued."); const idempotencyKey = `research-${organisationId}-${nanoid(24)}`; const row = await db.insert(researchJobs).values({ organisationId, propertyId: input.propertyId, requestedByUserId: ctx.user.id, idempotencyKey, researchType: input.researchType, locationLabel: input.locationLabel, status: "awaiting_provider_contract", requestedCredits: 1, inputSnapshot: { question: input.question, sourcePolicy: "Return dated, attributable sources. Do not issue safety verdicts. Treat crime and service claims as source- and period-specific." } }).$returningId(); await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "research.request_queued", entityType: "research_job", entityId: row[0]!.id, metadata: { researchType: input.researchType, locationLabel: input.locationLabel, creditsReserved: 0, providerSessionContractReady: false } }); return { id: row[0]!.id, status: "awaiting_provider_contract" as const, message: "The request is saved but no research credits have been debited. It will remain inactive until GenX publishes the documented session web-search message contract." }; } catch (error) { return secureError(error); }
    }),
    recordVerifiedResult: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), researchJobId: z.number().int().positive(), summary: z.string().min(20).max(6000), caveats: z.string().min(10).max(2500), geographicScope: z.string().min(3).max(255), generatedAt: z.string().datetime(), sources: z.array(z.object({ label: z.string().min(2).max(180), url: z.string().url().max(1000), retrievedAt: z.string().datetime(), coverage: z.string().min(3).max(500), period: z.string().max(160).optional() })).min(1).max(20) })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, SALES_MANAGEMENT_ROLES, "record verified buyer-intelligence results");
        const job = await db.select().from(researchJobs).where(and(eq(researchJobs.id, input.researchJobId), eq(researchJobs.organisationId, organisationId))).limit(1);
        if (!job[0]) throw new Error("Research request not found");
        if (job[0].status === "completed") throw new Error("Completed research results are immutable; create a new request for a revised source set.");
        const provenanceError = getResearchProvenanceError({ researchType: job[0].researchType, sources: input.sources, generatedAt: input.generatedAt, geographicScope: input.geographicScope });
        if (provenanceError) throw new Error(provenanceError);
        const sourceSnapshot = { sources: input.sources, geographicScope: input.geographicScope, generatedAt: input.generatedAt, recordedBy: "verified_manual_review" };
        const resultSnapshot = { summary: input.summary, caveats: input.caveats, sourceLabel: "Verified source review; not a safety verdict" };
        await db.update(researchJobs).set({ status: "completed", sourceSnapshot, resultSnapshot, completedAt: new Date(), errorMessage: null }).where(eq(researchJobs.id, job[0].id));
        if (job[0].propertyId) {
          const property = await getPropertyForOrganisation(job[0].propertyId, organisationId);
          const previous = await db.select().from(geoReports).where(eq(geoReports.propertyId, job[0].propertyId)).orderBy(desc(geoReports.generatedAt)).limit(1);
          const priorSnapshot = previous[0]?.snapshot ?? createInitialBuyerReportSnapshot(property);
          const priorResearch = Array.isArray((priorSnapshot as { research?: unknown }).research) ? (priorSnapshot as { research: unknown[] }).research : [];
          const priorCrime = Array.isArray((priorSnapshot as { crime?: unknown }).crime) ? (priorSnapshot as { crime: unknown[] }).crime : [];
          const reportResearch = { type: job[0].researchType, locationLabel: job[0].locationLabel, geographicScope: input.geographicScope, generatedAt: input.generatedAt, summary: input.summary, caveats: input.caveats, sources: input.sources, label: "Verified source review; not a safety verdict" };
          const crimeEvidence = buildCrimeReportEvidence({ researchType: job[0].researchType, geographicScope: input.geographicScope, generatedAt: input.generatedAt, summary: input.summary, caveats: input.caveats, sources: input.sources });
          await db.insert(geoReports).values({ propertyId: job[0].propertyId, snapshot: { ...priorSnapshot, research: [...priorResearch, reportResearch], crime: crimeEvidence ? [...priorCrime, crimeEvidence] : priorCrime }, sourceSummary: input.sources.map(source => `${source.label} (${source.retrievedAt.slice(0, 10)})`).join("; ").slice(0, 1000) });
        }
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "research.verified_result_recorded", entityType: "research_job", entityId: job[0].id, metadata: { researchType: job[0].researchType, sourceCount: input.sources.length, linkedPropertyReport: Boolean(job[0].propertyId), debitedCredits: 0 } });
        return { success: true };
      } catch (error) { return secureError(error); }
    }),
  }),
  billing: router({
    createCheckout: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional(), productKey: z.enum(["professional_monthly", "media_credit_pack", "research_credit_pack"]) })).mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb(); if (!db) throw new Error("Database unavailable");
        const baseUrl = process.env.APP_BASE_URL;
        if (!baseUrl || !baseUrl.startsWith("https://")) throw new Error("Checkout is unavailable until APP_BASE_URL is set to the deployed HTTPS domain.");
        const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BILLING_MANAGEMENT_ROLES, "create billing checkouts");
        const products = { professional_monthly: { amount: "499.00", name: "Amarktai Property Professional" }, media_credit_pack: { amount: "250.00", name: "Amarktai Property media credit pack" }, research_credit_pack: { amount: RESEARCH_CREDIT_PACK.amountZar, name: RESEARCH_CREDIT_PACK.name } } as const;
        const product = products[input.productKey]; const merchantReference = `AMP-${Date.now()}-${nanoid(8)}`;
        const row = await db.insert(orders).values({ organisationId, createdByUserId: ctx.user.id, merchantReference, productKey: input.productKey, amountZar: product.amount }).$returningId();
        const checkout = buildPayfastCheckout({ merchantReference, amountZar: product.amount, itemName: product.name, returnUrl: `${baseUrl}/app/settings?payment=return`, cancelUrl: `${baseUrl}/app/settings?payment=cancelled`, notifyUrl: `${baseUrl}/api/payfast/itn` });
        await writeAudit({ organisationId, actorUserId: ctx.user.id, action: "billing.checkout_created", entityType: "order", entityId: row[0]!.id, metadata: { productKey: input.productKey } });
        return { orderId: row[0]!.id, ...checkout };
      } catch (error) { return secureError(error); }
    }),
    researchCreditBalance: protectedProcedure.input(z.object({ organisationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const organisationId = await getAuthorisedOrganisationId(ctx.user, input.organisationId, BILLING_MANAGEMENT_ROLES, "view research credits"); const entries = await db.select({ credits: researchCreditLedger.credits }).from(researchCreditLedger).where(eq(researchCreditLedger.organisationId, organisationId)); return { credits: getResearchCreditBalance(entries), packCredits: RESEARCH_CREDIT_PACK.credits, packAmountZar: RESEARCH_CREDIT_PACK.amountZar }; } catch (error) { return secureError(error); }
    }),
  }),
  public: router({
    share: publicProcedure.input(z.object({ token: z.string().min(8).max(96) })).query(({ input }) => getPublicShare(input.token)),
  }),
});

export type AppRouter = typeof appRouter;
